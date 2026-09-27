import { describe, it, expect, beforeEach, afterEach } from "bun:test";

export interface TestSendEmailParams {
  to: string;
  subject: string;
  html: string;
  useCpanelConfig?: boolean;
}

export interface TestWhatsappConfig {
  apiUrl: string;
  apiKey: string;
  instanceId: string;
}

export function sanitizeEmailApiUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  let clean = url.trim();
  if (clean.includes("whatsapp-5fda.onrender.com")) {
    clean = clean.replace("whatsapp-5fda.onrender.com", "whatsapp-b5os.onrender.com");
  }
  if (clean.includes("etechglobalhub.duckdns.org")) {
    return "";
  }
  return clean;
}

export function sanitizeWhatsappApiUrl(url?: string | null): string {
  if (!url || typeof url !== "string") return "";
  let clean = url.trim().replace(/\/+$/, "");
  if (clean.includes("whatsapp-5fda.onrender.com")) {
    clean = clean.replace("whatsapp-5fda.onrender.com", "whatsapp-b5os.onrender.com");
  }
  return clean;
}

export async function resolveEmailConfig(params: TestSendEmailParams, firestoreConfig?: any) {
  const envEmailUrl = sanitizeEmailApiUrl(process.env.EMAIL_API_URL);
  let apiKey = (process.env.EMAIL_API_KEY && !process.env.EMAIL_API_KEY.includes("***"))
    ? process.env.EMAIL_API_KEY
    : (process.env.WHATSAPP_API_KEY && !process.env.WHATSAPP_API_KEY.includes("***"))
      ? process.env.WHATSAPP_API_KEY
      : process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";
  let instanceId = process.env.EMAIL_INSTANCE_ID || process.env.WHATSAPP_INSTANCE_ID || "inst_33647102";
  let emailApiUrl = envEmailUrl;

  if (params.useCpanelConfig === true && firestoreConfig) {
    const firestoreUrl = sanitizeEmailApiUrl(firestoreConfig.emailApiUrl || firestoreConfig.whatsappApiUrl);
    if (firestoreUrl) {
      emailApiUrl = firestoreUrl.includes("/api/email")
        ? firestoreUrl
        : `${firestoreUrl.replace(/\/$/, "")}/api/email/send`;
    }
    if (firestoreConfig.emailApiKey && !firestoreConfig.emailApiKey.includes("***")) apiKey = firestoreConfig.emailApiKey;
    if (firestoreConfig.emailInstanceId) instanceId = firestoreConfig.emailInstanceId;
  }

  if (!emailApiUrl) {
    const waUrl = process.env.WHATSAPP_API_URL ? process.env.WHATSAPP_API_URL.replace(/\/$/, "") : "";
    if (waUrl && !waUrl.includes("etechglobalhub.duckdns.org")) {
      emailApiUrl = waUrl.includes("/api/email") ? waUrl : `${waUrl}/api/email/send`;
    } else {
      emailApiUrl = "https://whatsapp-b5os.onrender.com/api/email/send";
    }
  }

  return { emailApiUrl, apiKey, instanceId };
}

export async function resolveWhatsappConfig(options?: { useCpanelConfig?: boolean }, firestoreConfig?: any): Promise<TestWhatsappConfig> {
  let apiUrl = sanitizeWhatsappApiUrl(process.env.WHATSAPP_API_URL);
  let apiKey = process.env.WHATSAPP_API_KEY || process.env.PAYMENT_GATEWAY_API_KEY || "";
  let instanceId = process.env.WHATSAPP_INSTANCE_ID || "default";

  if (options?.useCpanelConfig === true && firestoreConfig) {
    const firestoreUrl = sanitizeWhatsappApiUrl(firestoreConfig.whatsappApiUrl);
    if (firestoreUrl) apiUrl = firestoreUrl;
    if (firestoreConfig.whatsappApiKey && !firestoreConfig.whatsappApiKey.includes("***")) apiKey = firestoreConfig.whatsappApiKey;
    if (firestoreConfig.whatsappInstanceId) instanceId = firestoreConfig.whatsappInstanceId;
  }

  if (!apiUrl) {
    apiUrl = sanitizeWhatsappApiUrl(process.env.PAYMENT_GATEWAY_URL) || "https://whatsapp-b5os.onrender.com";
  }

  return { apiUrl, apiKey, instanceId };
}

describe("User OTP & Verification Backend Configuration Isolation", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.EMAIL_API_URL = "http://real-backend.test/api/email/send";
    process.env.EMAIL_API_KEY = "real_backend_email_key_123";
    process.env.EMAIL_INSTANCE_ID = "real_backend_instance_email";
    process.env.WHATSAPP_API_URL = "http://real-backend.test";
    process.env.WHATSAPP_API_KEY = "real_backend_wa_key_456";
    process.env.WHATSAPP_INSTANCE_ID = "real_backend_instance_wa";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("User OTP Email uses process environment variables by default (ignoring CPanel Firestore config)", async () => {
    const mockCpanelFirestoreDoc = {
      emailApiUrl: "http://cpanel-override.test/api/email/send",
      emailApiKey: "cpanel_override_key_999",
      emailInstanceId: "cpanel_override_instance",
    };

    const resolvedUserConfig = await resolveEmailConfig({
      to: "user@example.com",
      subject: "OTP Verification",
      html: "<p>123456</p>",
    }, mockCpanelFirestoreDoc);

    expect(resolvedUserConfig.emailApiUrl).toBe("http://real-backend.test/api/email/send");
    expect(resolvedUserConfig.apiKey).toBe("real_backend_email_key_123");
    expect(resolvedUserConfig.instanceId).toBe("real_backend_instance_email");

    const resolvedCpanelConfig = await resolveEmailConfig({
      to: "admin@example.com",
      subject: "CPanel Test",
      html: "<p>Ping</p>",
      useCpanelConfig: true,
    }, mockCpanelFirestoreDoc);

    expect(resolvedCpanelConfig.emailApiUrl).toBe("http://cpanel-override.test/api/email/send");
    expect(resolvedCpanelConfig.apiKey).toBe("cpanel_override_key_999");
    expect(resolvedCpanelConfig.instanceId).toBe("cpanel_override_instance");
  });

  it("Migrates legacy whatsapp-5fda.onrender.com domain to whatsapp-b5os.onrender.com", async () => {
    process.env.EMAIL_API_URL = "https://whatsapp-5fda.onrender.com/api/email/send";

    const resolved = await resolveEmailConfig({
      to: "user@example.com",
      subject: "OTP",
      html: "<p>123</p>",
    });

    expect(resolved.emailApiUrl).toBe("https://whatsapp-b5os.onrender.com/api/email/send");
  });

  it("User OTP WhatsApp uses process environment variables by default (ignoring CPanel Firestore config)", async () => {
    const mockCpanelFirestoreDoc = {
      whatsappApiUrl: "http://cpanel-override-wa.test",
      whatsappApiKey: "cpanel_override_wa_key_888",
      whatsappInstanceId: "cpanel_override_wa_instance",
    };

    const resolvedUserWaConfig = await resolveWhatsappConfig(undefined, mockCpanelFirestoreDoc);

    expect(resolvedUserWaConfig.apiUrl).toBe("http://real-backend.test");
    expect(resolvedUserWaConfig.apiKey).toBe("real_backend_wa_key_456");
    expect(resolvedUserWaConfig.instanceId).toBe("real_backend_instance_wa");

    const resolvedCpanelWaConfig = await resolveWhatsappConfig({ useCpanelConfig: true }, mockCpanelFirestoreDoc);

    expect(resolvedCpanelWaConfig.apiUrl).toBe("http://cpanel-override-wa.test");
    expect(resolvedCpanelWaConfig.apiKey).toBe("cpanel_override_wa_key_888");
    expect(resolvedCpanelWaConfig.instanceId).toBe("cpanel_override_wa_instance");
  });
});
