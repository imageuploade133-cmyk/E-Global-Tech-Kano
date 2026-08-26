import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    // Forward Bearer token, body payload ({ channel: "whatsapp" | "email" }), and secure S2S Api Key to payment gateway VM backend
    const response = await fetch(`${GATEWAY_URL}/api/auth/pin-reset-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "x-api-key": gatewayApiKey,
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || result.error || "Failed to dispatch PIN reset OTP." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      channel: result.channel || body.channel || "whatsapp",
      message: result.message || "PIN reset OTP dispatched successfully.",
      ...(result.devOtpCode ? { devOtpCode: result.devOtpCode } : {}),
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset OTP Proxy] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch PIN reset OTP." }, { status: 500 });
  }
}
