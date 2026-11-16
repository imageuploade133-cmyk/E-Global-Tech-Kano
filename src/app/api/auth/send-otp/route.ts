import { NextResponse } from "next/server";

const GATEWAY_URL = (process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055").trim().replace(/\/+$/, "");

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channel = "whatsapp", phonePrefix, phoneNumber, email } = body;

    if (channel === "email") {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
      }
    } else if (!phonePrefix || !phoneNumber) {
      return NextResponse.json({ error: "Phone prefix and phone number are required for WhatsApp verification." }, { status: 400 });
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;
    if (!gatewayApiKey) {
      return NextResponse.json({ error: "OTP gateway authentication is not configured. Please contact support." }, { status: 503 });
    }

    const fullPhoneNumber = channel === "email"
      ? undefined
      : `${String(phonePrefix).replace(/\D/g, "")}${String(phoneNumber).replace(/\D/g, "")}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);
    let response: Response;
    try {
      response = await fetch(`${GATEWAY_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": gatewayApiKey },
        body: JSON.stringify(channel === "email"
          ? { channel: "email", email: String(email).trim().toLowerCase(), type: "signup" }
          : { phoneNumber: fullPhoneNumber, type: "signup" }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text().catch(() => "");
    let result: any = {};
    try { result = responseText ? JSON.parse(responseText) : {}; }
    catch {
      console.error("[OTP Send Proxy] Gateway returned a non-JSON response.");
      return NextResponse.json({ error: "OTP gateway returned an invalid response. Please try again." }, { status: 502 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: result.message || result.error || "Failed to send OTP." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      channel,
      message: result.message || "OTP sent successfully.",
      ...(result.devOtpCode ? { devOtpCode: result.devOtpCode } : {}),
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === "AbortError";
    console.error("[OTP Send Proxy Error]:", error.message);
    return NextResponse.json(
      { error: isTimeout ? "OTP gateway connection timed out. Please try again." : "OTP gateway is currently unavailable. Please try again." },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
