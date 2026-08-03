import { NextResponse } from "next/server";
import { OtpStoreService } from "@/lib/otp-store";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber } = body;

    if (!phonePrefix || !phoneNumber) {
      return NextResponse.json({ error: "Phone prefix and phone number are required." }, { status: 400 });
    }

    const cleanPrefix = phonePrefix.trim();
    const cleanPhone = phoneNumber.trim().replace(/\D/g, "");

    if (cleanPhone.length < 7) {
      return NextResponse.json({ error: "Invalid phone number length." }, { status: 400 });
    }

    const fullPhone = `${cleanPrefix}${cleanPhone}`;

    // Rate limiting: 1 request per phone number per 60 seconds
    const existingSession = await OtpStoreService.getOtp(fullPhone);
    const now = Date.now();

    if (existingSession) {
      if (existingSession.cooldownUntil) {
        const cooldownTime = new Date(existingSession.cooldownUntil).getTime();
        if (now < cooldownTime) {
          const waitSeconds = Math.ceil((cooldownTime - now) / 1000);
          return NextResponse.json({
            error: `Please wait ${waitSeconds} seconds before requesting another OTP.`,
            cooldownUntil: existingSession.cooldownUntil
          }, { status: 429 });
        }
      }
    }

    // Generate secure 6-digit OTP code
    const otpCode = crypto.randomInt(100000, 1000000).toString();

    // Secure server-side hashing (OTP is never saved plain in DB)
    const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");

    // 5 minutes expiration
    const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
    // 60 seconds cooldown
    const cooldownUntil = new Date(now + 60 * 1000).toISOString();

    // Store secure session
    await OtpStoreService.setOtp(fullPhone, {
      phoneNumber: fullPhone,
      otpHash,
      expiresAt,
      cooldownUntil,
      verified: false,
      attempts: 0,
      updatedAt: new Date().toISOString()
    });

    // Format number for Whatsapp api (digits only, e.g., 2348012345678)
    const cleanNumberForWhatsapp = fullPhone.replace(/\D/g, "");

    // Professional Randomized Templates to prevent sender number from getting banned
    const templates = [
      `Hello! Your E-Tech Global Hub verification code is *${otpCode}*. It will expire in 5 minutes. Please do not share this code with anyone.`,
      `Your requested secure one-time passcode for E-Tech Global Hub is *${otpCode}*. This code is valid for 5 minutes. Security notice: We will never ask for your password or pin.`,
      `Use code *${otpCode}* to verify your WhatsApp number on E-Tech Global Hub. This OTP expires in 5 minutes. Thank you!`,
      `[E-Tech Global Hub] One-Time Password: *${otpCode}*. To complete your registration, enter this code in your signup screen. Valid for 5 minutes.`
    ];
    const selectedTemplate = templates[Math.floor(Math.random() * templates.length)];

    // Send WhatsApp via configured environment variables
    const gatewayUrl = process.env.WHATSAPP_API_URL;
    const apiKey = process.env.WHATSAPP_API_KEY;
    const instanceId = process.env.WHATSAPP_INSTANCE_ID;

    let sentSuccessfully = false;

    if (gatewayUrl && apiKey && instanceId) {
      const targetUrl = `${gatewayUrl.replace(/\/$/, "")}/api/send/text`;
      try {
        const response = await fetch(targetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": apiKey,
            "X-Instance-ID": instanceId,
          },
          body: JSON.stringify({
            number: cleanNumberForWhatsapp,
            message: selectedTemplate,
          }),
        });

        if (response.ok) {
          sentSuccessfully = true;
          console.log(`[WhatsApp OTP] Successfully sent OTP to ${cleanNumberForWhatsapp}`);
        } else {
          const errText = await response.text();
          console.error(`[WhatsApp OTP] Gateway error: Status ${response.status}, body: ${errText}`);
        }
      } catch (fetchErr) {
        console.error("[WhatsApp OTP] Network error connecting to WhatsApp Gateway:", fetchErr);
      }
    } else {
      console.warn("[WhatsApp OTP] Gateway is not fully configured in environment. Set WHATSAPP_API_URL, WHATSAPP_API_KEY, and WHATSAPP_INSTANCE_ID.");
    }

    // Dev Fallback and testing logs
    if (process.env.NODE_ENV !== "production") {
      console.log(`\n==============================================`);
      console.log(`[DEV FALLBACK] WHATSAPP OTP FOR ${fullPhone}:`);
      console.log(`CODE: ${otpCode}`);
      console.log(`MESSAGE: ${selectedTemplate}`);
      console.log(`==============================================\n`);
    }

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to WhatsApp.",
      cooldownUntil,
      // For developer ease of local testing, we output fallback boolean
      devFallback: process.env.NODE_ENV !== "production" && !sentSuccessfully
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP] Error in send-otp route:", error);
    return NextResponse.json({ error: error.message || "Failed to send WhatsApp OTP." }, { status: 500 });
  }
}
