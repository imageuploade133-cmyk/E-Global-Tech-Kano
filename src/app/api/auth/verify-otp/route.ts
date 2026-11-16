import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";
import { getGatewayUrl } from "@/lib/gateway-util";

const GATEWAY_URL = getGatewayUrl();

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { channel = "whatsapp", phonePrefix, phoneNumber, email, otpCode } = body;
    const submittedOtp = String(otpCode || "").trim();

    if (!/^[0-9]{6}$/.test(submittedOtp)) {
      return NextResponse.json({ error: "A valid 6-digit OTP code is required." }, { status: 400 });
    }
    if (channel === "email") {
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim())) {
        return NextResponse.json({ error: "Valid email address is required for Email verification." }, { status: 400 });
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
      response = await fetch(`${GATEWAY_URL}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-api-key": gatewayApiKey },
        body: JSON.stringify(channel === "email"
          ? { channel: "email", email: String(email).trim().toLowerCase(), otpCode: submittedOtp, type: "signup" }
          : { phoneNumber: fullPhoneNumber, otp: submittedOtp, type: "signup" }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text().catch(() => "");
    let result: any = {};
    try {
      result = JSON.parse(responseText);
    } catch {
      console.error("[WhatsApp OTP Verify Proxy] Received non-JSON response from gateway:", responseText);
      if (responseText.includes("Cannot POST") || responseText.includes("<!DOCTYPE") || response.status === 404) {
        return NextResponse.json({
          error: "WhatsApp OTP verification service is currently unavailable."
        }, { status: 502 });
      }
      return NextResponse.json({
        error: `Database Gateway unreachable or returned an invalid response (HTTP ${response.status}).`
      }, { status: 502 });
    }

    if (!response.ok) {
      let rawErr = String(result.message || result.error || "Failed to verify WhatsApp OTP.");
      if (rawErr.includes("Cannot POST") || rawErr.includes("<!DOCTYPE")) {
        rawErr = "WhatsApp OTP verification service is currently unavailable.";
      }
      return NextResponse.json({ error: rawErr }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      channel,
      message: result.message || (channel === "email" ? "Email address verified successfully!" : "WhatsApp number verified successfully."),
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === "AbortError";
    console.error("[OTP Verify Proxy Error]:", error.message);
    return NextResponse.json(
      { error: isTimeout ? "OTP gateway connection timed out. Please try again." : "OTP gateway is currently unavailable. Please try again." },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
