import { adminDb } from "@/lib/firebase-admin";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface EmailServerConfig {
  apiUrl: string;
  apiKey: string;
  fromName: string;
  fromEmail: string;
}

/**
 * Resolves server-side Email API credentials.
 * Prioritizes EMAIL_API_URL / EMAIL_API_KEY / WHATSAPP_API_URL / WHATSAPP_API_KEY,
 * falling back to Firestore config/whatsapp_api or config/app if env is missing.
 */
export async function getEmailServerConfig(): Promise<EmailServerConfig> {
  let apiUrl = (process.env.EMAIL_API_URL || process.env.WHATSAPP_API_URL || "https://whatsapp-5fda.onrender.com").replace(/\/+$/, "");
  let apiKey = process.env.EMAIL_API_KEY || process.env.WHATSAPP_API_KEY || "";
  const fromName = process.env.EMAIL_FROM_NAME || "E-Global Pay";
  let fromEmail = process.env.EMAIL_FROM || "no-reply@e-globaltechhub.com";

  try {
    const docSnap = await adminDb.collection("config").doc("whatsapp_api").get();
    if (docSnap.exists) {
      const data = docSnap.data() || {};
      if (data.emailApiUrl) apiUrl = data.emailApiUrl.replace(/\/+$/, "");
      else if (data.whatsappApiUrl) apiUrl = data.whatsappApiUrl.replace(/\/+$/, "");

      if (data.emailApiKey) apiKey = data.emailApiKey;
      else if (data.whatsappApiKey) apiKey = data.whatsappApiKey;
    }

    const appSnap = await adminDb.collection("config").doc("app").get();
    if (appSnap.exists) {
      const appData = appSnap.data() || {};
      if (appData.supportEmail) fromEmail = appData.supportEmail;
    }
  } catch (err: any) {
    console.warn("[getEmailServerConfig] Config fetch warning:", err.message);
  }

  return { apiUrl, apiKey, fromName, fromEmail };
}

/**
 * Sends a generic HTML email via VM Email API.
 */
export async function sendEmail(options: EmailOptions): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getEmailServerConfig();
    if (!config.apiUrl) {
      return { success: false, error: "Email API URL is not configured." };
    }

    const targetUrl = `${config.apiUrl}/api/email/send`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      headers["x-api-key"] = config.apiKey;
      headers["X-API-Key"] = config.apiKey;
    }

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        to: options.to,
        subject: options.subject,
        html: options.html,
      }),
      cache: "no-store",
    });

    const resText = await res.text();
    let resData: any = {};
    try {
      resData = JSON.parse(resText);
    } catch {
      resData = { textResponse: resText };
    }

    if (!res.ok) {
      const errMsg = resData.message || resData.error || `Email API returned status ${res.status}`;
      console.error("[sendEmail Error]:", errMsg);
      return { success: false, error: errMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.error("[sendEmail Exception]:", err.message);
    return { success: false, error: err.message };
  }
}

/**
 * Dispatches welcome email to newly registered user.
 * Catches errors safely to ensure registration is not blocked.
 */
export async function sendWelcomeEmail(email: string, name: string): Promise<boolean> {
  const userName = name || "Valued Customer";
  const subject = "Welcome to E-Global Pay";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; rounded-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
        <h1 style="color: #FC7A00; margin: 0; font-size: 24px;">E-Global Pay</h1>
        <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">SECURE DIGITAL WALLET & VTU PAYMENTS</p>
      </div>
      <div style="padding: 24px 0; color: #1f2937; line-height: 1.6;">
        <h2 style="font-size: 18px; color: #111827;">Hello ${userName},</h2>
        <p>Welcome to <strong>E-Global Pay</strong>! Your account has been created successfully.</p>
        <p>You can now manage your digital balances, pay utility bills, transfer funds, and purchase airtime/data seamlessly.</p>
        <div style="background-color: #fff7ed; border-left: 4px solid #FC7A00; padding: 12px 16px; margin: 20px 0; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #9a3412; font-size: 13px;">Security Reminder:</p>
          <p style="margin: 4px 0 0 0; color: #c2410c; font-size: 12px;">Never share your Access PIN, OTP codes, or login password with anyone. E-Global Pay staff will never ask for your confidential security codes.</p>
        </div>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-Global Pay. All rights reserved.</p>
      </div>
    </div>
  `;

  try {
    const res = await sendEmail({ to: email, subject, html });
    if (!res.success) {
      console.warn(`[Email Service] Failed to send welcome email to ${email}:`, res.error);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn(`[Email Service] Failed to send welcome email to ${email}:`, err.message);
    return false;
  }
}

/**
 * Dispatches 6-digit OTP code to user's registered email address for PIN recovery.
 */
export async function sendEmailOtp(email: string, name: string, otpCode: string): Promise<{ success: boolean; error?: string }> {
  const userName = name || "User";
  const subject = "Your E-Global Pay OTP";

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
      <div style="text-align: center; padding-bottom: 20px; border-bottom: 1px solid #f3f4f6;">
        <h1 style="color: #FC7A00; margin: 0; font-size: 24px;">E-Global Pay</h1>
        <p style="color: #6b7280; font-size: 12px; margin-top: 4px;">SECURITY VERIFICATION</p>
      </div>
      <div style="padding: 24px 0; color: #1f2937; line-height: 1.6; text-align: center;">
        <h2 style="font-size: 18px; color: #111827;">Hello ${userName},</h2>
        <p style="color: #4b5563; font-size: 14px;">Your 6-digit verification code to reset your Access PIN is:</p>
        <div style="display: inline-block; background-color: #f3f4f6; border: 1px border-dashed #9ca3af; padding: 14px 28px; border-radius: 12px; font-size: 28px; font-weight: bold; letter-spacing: 6px; color: #111827; margin: 16px 0;">
          ${otpCode}
        </div>
        <p style="color: #6b7280; font-size: 12px; margin-top: 8px;">This code will expire in <strong>10 minutes</strong>.</p>
        <div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px 16px; margin: 24px 0; text-align: left; border-radius: 4px;">
          <p style="margin: 0; font-weight: bold; color: #991b1b; font-size: 12px;">Security Warning:</p>
          <p style="margin: 4px 0 0 0; color: #b91c1c; font-size: 11px;">Never share this code with anyone. If you did not request this OTP, please secure your account immediately.</p>
        </div>
      </div>
      <div style="text-align: center; padding-top: 20px; border-top: 1px solid #f3f4f6; color: #9ca3af; font-size: 11px;">
        <p style="margin: 0;">&copy; ${new Date().getFullYear()} E-Global Pay. All rights reserved.</p>
      </div>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}
