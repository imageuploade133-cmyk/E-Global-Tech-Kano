import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber } = body;

    if (!phonePrefix || !phoneNumber) {
      return NextResponse.json({ error: "Phone prefix and phone number are required." }, { status: 400 });
    }

    const cleanPrefix = phonePrefix.trim().replace(/\D/g, "");
    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    const fullPhoneNumber = `${cleanPrefix}${cleanNum}`;

    // Server-side cooldown check (60s rate limit lock against duplicate OTP spam)
    const now = Date.now();
    const cooldownRef = adminDb.collection("otp_cooldowns").doc(`signup_${fullPhoneNumber}`);
    const cooldownSnap = await cooldownRef.get();
    if (cooldownSnap.exists) {
      const cooldownData = cooldownSnap.data() || {};
      const lastSent = cooldownData.lastSentAt || 0;
      if (now - lastSent < 60000) {
        const remaining = Math.ceil((60000 - (now - lastSent)) / 1000);
        return NextResponse.json(
          { error: `Please wait ${remaining} seconds before requesting another OTP code.` },
          { status: 429 }
        );
      }
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const response = await fetch(`${GATEWAY_URL}/api/auth/send-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
      },
      body: JSON.stringify({
        phoneNumber: fullPhoneNumber,
        type: "signup"
      }),
    });

    const responseText = await response.text();
    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("[WhatsApp OTP Send Proxy] Received non-JSON response from gateway:", responseText);
      return NextResponse.json({
        error: `Database Gateway unreachable or returned an invalid response (HTTP ${response.status}).`
      }, { status: 502 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Failed to send WhatsApp OTP." }, { status: response.status });
    }

    // Set server-side OTP request cooldown lock
    await cooldownRef.set({
      fullPhoneNumber,
      lastSentAt: now,
      updatedAt: new Date(now).toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: result.message || "OTP sent successfully to WhatsApp.",
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP Proxy] Send OTP route error:", error);
    return NextResponse.json({ error: error.message || "Failed to send WhatsApp OTP." }, { status: 500 });
  }
}
