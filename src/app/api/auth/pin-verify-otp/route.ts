import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "";
    const body = await req.json();

    // Forward Bearer token, body payload, and secure S2S Api Key to payment gateway
    const response = await fetch(`${GATEWAY_URL}/api/auth/pin-verify-otp`, {
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
      return NextResponse.json({ error: result.message || "Failed to verify OTP." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message || "WhatsApp OTP verified successfully. Proceed to reset PIN."
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset Verify OTP Proxy] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify OTP." }, { status: 500 });
  }
}
