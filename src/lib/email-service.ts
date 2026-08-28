import { adminDb } from "@/lib/firebase-admin";
import { CommunicationBrandingConfig, DEFAULT_COMMUNICATION_BRANDING, renderTemplateVariables } from "@/lib/communication-defaults";

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

/**
 * Server-side Email Service calling the WhatsAPI Email API Gateway.
 */
export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const emailApiUrl = process.env.EMAIL_API_URL || "https://whatsapp-5fda.onrender.com/api/email/send";
  const apiKey = process.env.EMAIL_API_KEY || process.env.WHATSAPP_API_KEY || "inst_33647102";
  const instanceId = process.env.EMAIL_INSTANCE_ID || process.env.WHATSAPP_INSTANCE_ID || "inst_33647102";

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000);

    const res = await fetch(emailApiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        "Authorization": `Bearer ${apiKey}`,
        "X-Instance-ID": instanceId,
      },
      body: JSON.stringify({
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text || "",
        replyTo: params.replyTo || "",
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      return true;
    }
    const errText = await res.text();
    console.warn(`[sendEmail] Dispatch failed with status ${res.status}:`, errText);
    return false;
  } catch (err: any) {
    console.error("[sendEmail] Exception dispatching email:", err.message);
    return false;
  }
}

/**
 * Sends welcome email to newly registered user using customized communication branding template.
 */
export async function sendWelcomeEmail(toEmail: string, userName?: string): Promise<boolean> {
  try {
    let config = { ...DEFAULT_COMMUNICATION_BRANDING };
    try {
      const docSnap = await adminDb.collection("config").doc("communication_branding").get();
      if (docSnap.exists) {
        const stored = docSnap.data() as Partial<CommunicationBrandingConfig>;
        config = {
          sender: { ...DEFAULT_COMMUNICATION_BRANDING.sender, ...(stored.sender || {}) },
          emailOtp: { ...DEFAULT_COMMUNICATION_BRANDING.emailOtp, ...(stored.emailOtp || {}) },
          whatsappOtp: { ...DEFAULT_COMMUNICATION_BRANDING.whatsappOtp, ...(stored.whatsappOtp || {}) },
          welcomeEmail: { ...DEFAULT_COMMUNICATION_BRANDING.welcomeEmail, ...(stored.welcomeEmail || {}) },
        };
      }
    } catch {
      // Fallback to default
    }

    const tpl = config.welcomeEmail;
    const brandName = config.sender.senderName || "E-Global Pay";
    const name = userName || "Valued Customer";
    const replyTo = config.sender.replyToEmail || config.sender.senderEmail;

    const subject = renderTemplateVariables(tpl.subject, { brandName, name, email: toEmail });

    const logoHtml = tpl.logoUrl || config.sender.logoUrl
      ? `<img src="${tpl.logoUrl || config.sender.logoUrl}" alt="${brandName}" style="max-height: 48px; width: auto; margin-bottom: 16px;" />`
      : `<h2 style="color: ${tpl.primaryColor || "#FC7A00"}; margin: 0 0 16px 0;">${brandName}</h2>`;

    const bannerHtml = tpl.bannerUrl
      ? `<div style="margin-bottom: 20px; text-align: center;"><img src="${tpl.bannerUrl}" alt="Banner" style="max-width: 100%; border-radius: 12px;" /></div>`
      : "";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
        <div style="text-align: center;">${logoHtml}</div>
        ${bannerHtml}
        <h1 style="color: #1a202c; font-size: 20px; font-weight: 800; text-align: center; margin-bottom: 12px;">${renderTemplateVariables(tpl.heading, { brandName, name })}</h1>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">${renderTemplateVariables(tpl.greeting, { name })}</p>
        <p style="color: #4a5568; font-size: 14px; line-height: 1.6;">${renderTemplateVariables(tpl.welcomeMessage, { brandName, name, email: toEmail })}</p>
        <div style="text-align: center; margin: 28px 0;">
          <a href="${tpl.ctaButtonUrl || "#"}" style="background-color: ${tpl.primaryColor || "#FC7A00"}; color: #ffffff; padding: 12px 28px; font-size: 13px; font-weight: bold; text-decoration: none; border-radius: 10px; display: inline-block;">${tpl.ctaButtonText || "Access Wallet Dashboard"}</a>
        </div>
        <hr style="border: none; border-top: 1px solid #edf2f7; margin: 24px 0;" />
        <p style="color: #a0aec0; font-size: 11px; text-align: center; margin: 0;">${tpl.footer || config.sender.footerText}</p>
      </div>
    `;

    return await sendEmail({
      to: toEmail,
      subject,
      html: htmlBody,
      replyTo,
    });
  } catch (err: any) {
    console.error("[sendWelcomeEmail] Failed to send welcome email:", err.message);
    return false;
  }
}
