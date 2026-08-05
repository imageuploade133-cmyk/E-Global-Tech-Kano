import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

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

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

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

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Failed to send WhatsApp OTP." }, { status: response.status });
    }

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
