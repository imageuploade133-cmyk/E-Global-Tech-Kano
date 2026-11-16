import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = (process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055").trim().replace(/\/+$/, "");

export async function POST(req: Request) {
  try {
    const authUser = await authenticateUserRequest(req).catch(() => null);
    if (!authUser?.uid) {
      return NextResponse.json({ error: "Authentication required to verify OTP." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const otpCode = String(body.otpCode || "").trim();
    const channel = body.channel === "email" ? "email" : "whatsapp";
    if (!/^[0-9]{6}$/.test(otpCode)) {
      return NextResponse.json({ error: "Please enter a valid 6-digit OTP code." }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(authUser.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const payload: Record<string, any> = { channel, otpCode };
    if (channel === "email") {
      payload.email = String(userData.email || userData.emailAddress || authUser.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.email)) {
        return NextResponse.json({ error: "No valid registered email address found on this profile." }, { status: 400 });
      }
    } else {
      payload.phoneNumber = String(userData.phoneNumber || userData.phone || "").trim();
      if (!payload.phoneNumber) {
        return NextResponse.json({ error: "No registered phone number found on this profile." }, { status: 400 });
      }
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;
    if (!gatewayApiKey) {
      return NextResponse.json({ error: "OTP gateway authentication is not configured. Please contact support." }, { status: 503 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);
    let response: Response;
    try {
      response = await fetch(`${GATEWAY_URL}/api/auth/pin-verify-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": req.headers.get("Authorization") || "",
          "x-api-key": gatewayApiKey,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text().catch(() => "");
    let result: any = {};
    try { result = responseText ? JSON.parse(responseText) : {}; }
    catch {
      console.error("[PIN Reset Verify OTP Proxy] Gateway returned a non-JSON response.");
      return NextResponse.json({ error: "OTP gateway returned an invalid response. Please try again." }, { status: 502 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: result.message || result.error || "Failed to verify OTP." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message || "OTP verified successfully. Proceed to reset PIN.",
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === "AbortError";
    console.error("[PIN Reset Verify OTP Proxy] Error:", error.message);
    return NextResponse.json(
      { error: isTimeout ? "OTP gateway connection timed out. Please try again." : "OTP gateway is currently unavailable. Please try again." },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
