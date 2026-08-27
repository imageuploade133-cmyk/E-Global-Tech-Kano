import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const body = await req.json().catch(() => ({}));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 12000); // 12-second timeout before Vercel gateway times out

    // Forward Bearer token, body payload, and secure S2S Api Key to payment gateway
    const response = await fetch(`${GATEWAY_URL}/api/auth/pin-reset-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
        "x-api-key": gatewayApiKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const responseText = await response.text().catch(() => "");
    let result: Record<string, any> = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      if (responseText.includes("504") || responseText.includes("Gateway Time-out")) {
        result = { error: "Gateway timed out while connecting to server. Please try again in a few seconds." };
      } else {
        result = { error: responseText || "Server returned non-JSON response." };
      }
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: result.error || result.message || "Failed to dispatch PIN reset OTP." },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: result.message || "PIN reset OTP sent successfully.",
      ...(result.devOtpCode ? { devOtpCode: result.devOtpCode } : {}),
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset OTP Proxy] Error:", error);
    const isTimeout = error.name === "AbortError";
    const errorMessage = isTimeout
      ? "Server connection timed out. Please try again in a few seconds."
      : (error.message || "Failed to dispatch PIN reset OTP.");

    return NextResponse.json({ error: errorMessage }, { status: isTimeout ? 504 : 500 });
  }
}
