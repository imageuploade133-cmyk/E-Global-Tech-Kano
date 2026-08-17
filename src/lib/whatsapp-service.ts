import { adminDb } from "@/lib/firebase-admin";

interface WhatsappConfig {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

// In-memory lock to prevent duplicate concurrent actions
let isActionInFlight = false;
let lastActionTime = 0;

/**
 * Resolves server-side WhatsApp environment configuration.
 * Prioritizes process.env, falling back to Firestore config/whatsapp_api if process.env is missing.
 */
export async function getWhatsappServerConfig(): Promise<WhatsappConfig> {
  let apiUrl = (process.env.WHATSAPP_API_URL || "https://whatsapp-5fda.onrender.com").replace(/\/+$/, "");
  let apiKey = process.env.WHATSAPP_API_KEY || "";
  let instanceId = process.env.WHATSAPP_INSTANCE_ID || "default";

  try {
    const docSnap = await adminDb.collection("config").doc("whatsapp_api").get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      if (data.whatsappApiUrl) apiUrl = data.whatsappApiUrl.replace(/\/+$/, "");
      if (data.whatsappApiKey) apiKey = data.whatsappApiKey;
      if (data.whatsappInstanceId) instanceId = data.whatsappInstanceId;
    }
  } catch (err: any) {
    console.warn("[getWhatsappServerConfig] Firestore config lookup warning:", err.message);
  }

  return { apiUrl, apiKey, instanceId };
}

/**
 * Write to CPanel admin audit logs for security tracking.
 */
export async function logWhatsappAdminAudit(adminUid: string, adminEmail: string, action: string, details?: any) {
  try {
    await adminDb.collection("admin_audit_logs").add({
      adminUid,
      adminEmail: adminEmail || "admin",
      action,
      details: details || {},
      category: "whatsapp",
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn("[logWhatsappAdminAudit] Failed to record audit log:", err.message);
  }
}

/**
 * Executes a server-side fetch call to the WhatsApp API backend.
 * Secrets (apiKey, basic auth) are attached in server headers and NEVER returned.
 */
export async function callWhatsappBackend(
  endpointPath: string,
  method: "GET" | "POST" | "DELETE" = "GET",
  body?: any,
  timeoutMs: number = 8000
): Promise<{ ok: boolean; status: number; data?: any; error?: string }> {
  const config = await getWhatsappServerConfig();

  if (!config.apiUrl) {
    return { ok: false, status: 500, error: "WHATSAPP_API_URL is not configured on server." };
  }

  const cleanPath = endpointPath.startsWith("/") ? endpointPath : `/${endpointPath}`;
  const targetUrl = `${config.apiUrl}${cleanPath}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (config.apiKey) {
    headers["apikey"] = config.apiKey;
    headers["Authorization"] = `Bearer ${config.apiKey}`;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(targetUrl, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });

    clearTimeout(timeoutId);

    let resData: any = null;
    const text = await response.text();
    if (text) {
      try {
        resData = JSON.parse(text);
      } catch {
        resData = { textResponse: text };
      }
    }

    if (!response.ok) {
      const errMsg = resData?.message || resData?.error || `WhatsApp API returned HTTP ${response.status}`;
      return { ok: false, status: response.status, data: resData, error: errMsg };
    }

    return { ok: true, status: response.status, data: resData };
  } catch (err: any) {
    if (err.name === "AbortError") {
      return { ok: false, status: 504, error: "WhatsApp API connection timed out." };
    }
    return { ok: false, status: 502, error: err.message || "Failed to communicate with WhatsApp API server." };
  }
}

/**
 * Acquire concurrency lock for connect/reconnect/disconnect actions to prevent duplicate requests.
 */
export function acquireWhatsappActionLock(): boolean {
  const now = Date.now();
  // Clear stale lock if older than 15 seconds
  if (isActionInFlight && now - lastActionTime > 15000) {
    isActionInFlight = false;
  }

  if (isActionInFlight) {
    return false;
  }

  isActionInFlight = true;
  lastActionTime = now;
  return true;
}

export function releaseWhatsappActionLock() {
  isActionInFlight = false;
}
