import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber, otpCode } = body;

    if (!phonePrefix || !phoneNumber || !otpCode) {
      return NextResponse.json({ error: "Phone prefix, phone number, and OTP code are required." }, { status: 400 });
    }

    const cleanPrefix = phonePrefix.trim().replace(/\D/g, "");
    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    const fullPhoneNumber = `${cleanPrefix}${cleanNum}`;

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const response = await fetch(`${GATEWAY_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
      },
      body: JSON.stringify({
        phoneNumber: fullPhoneNumber,
        otp: otpCode,
        type: "signup"
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Failed to verify WhatsApp OTP." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message || "WhatsApp number verified successfully."
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP Proxy] Verify OTP route error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify WhatsApp OTP." }, { status: 500 });
  }
}
