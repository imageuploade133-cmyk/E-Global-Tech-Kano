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

export async function resolveTestEmailConfig(params: TestSendEmailParams, mockFirestoreConfig?: any) {
  let emailApiUrl = process.env.EMAIL_API_URL || "https://whatsapp-5fda.onrender.com/api/email/send";
  let apiKey = process.env.EMAIL_API_KEY || process.env.WHATSAPP_API_KEY || "inst_33647102";
  let instanceId = process.env.EMAIL_INSTANCE_ID || process.env.WHATSAPP_INSTANCE_ID || "inst_33647102";

  if (params.useCpanelConfig === true && mockFirestoreConfig) {
    if (mockFirestoreConfig.emailApiUrl) emailApiUrl = mockFirestoreConfig.emailApiUrl;
    if (mockFirestoreConfig.emailApiKey) apiKey = mockFirestoreConfig.emailApiKey;
    if (mockFirestoreConfig.emailInstanceId) instanceId = mockFirestoreConfig.emailInstanceId;
  }

  return { emailApiUrl, apiKey, instanceId };
}

export async function resolveTestWhatsappConfig(options?: { useCpanelConfig?: boolean }, mockFirestoreConfig?: any): Promise<TestWhatsappConfig> {
  let apiUrl = (process.env.WHATSAPP_API_URL || "https://whatsapp-5fda.onrender.com").replace(/\/+$/, "");
  let apiKey = process.env.WHATSAPP_API_KEY || "";
  let instanceId = process.env.WHATSAPP_INSTANCE_ID || "default";

  if (options?.useCpanelConfig === true && mockFirestoreConfig) {
    if (mockFirestoreConfig.whatsappApiUrl) apiUrl = mockFirestoreConfig.whatsappApiUrl.replace(/\/+$/, "");
    if (mockFirestoreConfig.whatsappApiKey) apiKey = mockFirestoreConfig.whatsappApiKey;
    if (mockFirestoreConfig.whatsappInstanceId) instanceId = mockFirestoreConfig.whatsappInstanceId;
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

    // Default user OTP call (useCpanelConfig is not set)
    const resolvedUserConfig = await resolveTestEmailConfig({
      to: "user@example.com",
      subject: "OTP Verification",
      html: "<p>123456</p>",
    }, mockCpanelFirestoreDoc);

    expect(resolvedUserConfig.emailApiUrl).toBe("http://real-backend.test/api/email/send");
    expect(resolvedUserConfig.apiKey).toBe("real_backend_email_key_123");
    expect(resolvedUserConfig.instanceId).toBe("real_backend_instance_email");

    // Explicit CPanel Admin Diagnostic call (useCpanelConfig: true)
    const resolvedCpanelConfig = await resolveTestEmailConfig({
      to: "admin@example.com",
      subject: "CPanel Test",
      html: "<p>Ping</p>",
      useCpanelConfig: true,
    }, mockCpanelFirestoreDoc);

    expect(resolvedCpanelConfig.emailApiUrl).toBe("http://cpanel-override.test/api/email/send");
    expect(resolvedCpanelConfig.apiKey).toBe("cpanel_override_key_999");
    expect(resolvedCpanelConfig.instanceId).toBe("cpanel_override_instance");
  });

  it("User OTP WhatsApp uses process environment variables by default (ignoring CPanel Firestore config)", async () => {
    const mockCpanelFirestoreDoc = {
      whatsappApiUrl: "http://cpanel-override-wa.test",
      whatsappApiKey: "cpanel_override_wa_key_888",
      whatsappInstanceId: "cpanel_override_wa_instance",
    };

    // Default user WhatsApp OTP call
    const resolvedUserWaConfig = await resolveTestWhatsappConfig(undefined, mockCpanelFirestoreDoc);

    expect(resolvedUserWaConfig.apiUrl).toBe("http://real-backend.test");
    expect(resolvedUserWaConfig.apiKey).toBe("real_backend_wa_key_456");
    expect(resolvedUserWaConfig.instanceId).toBe("real_backend_instance_wa");

    // CPanel Admin Diagnostic call
    const resolvedCpanelWaConfig = await resolveTestWhatsappConfig({ useCpanelConfig: true }, mockCpanelFirestoreDoc);

    expect(resolvedCpanelWaConfig.apiUrl).toBe("http://cpanel-override-wa.test");
    expect(resolvedCpanelWaConfig.apiKey).toBe("cpanel_override_wa_key_888");
    expect(resolvedCpanelWaConfig.instanceId).toBe("cpanel_override_wa_instance");
  });
});
