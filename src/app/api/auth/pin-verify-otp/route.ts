import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";
import { getGatewayUrl } from "@/lib/gateway-util";

const GATEWAY_URL = getGatewayUrl();

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    };
    if (gatewayApiKey) headers["x-api-key"] = gatewayApiKey;

    let response = await fetch(`${GATEWAY_URL}/api/auth/pin-verify-otp`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    let responseText = await response.text().catch(() => "");

    // Fallback: If gateway doesn't have /api/auth/pin-verify-otp (404), route to /api/auth/verify-otp
    if (response.status === 404 || responseText.includes("Cannot POST")) {
      let userPhone = (body.phoneNumber || body.phone || "").trim();
      if (!userPhone && authUser?.uid) {
        try {
          const uSnap = await adminDb.collection("users").doc(authUser.uid).get();
          if (uSnap.exists) {
            const uData = uSnap.data() || {};
            userPhone = (uData.phoneNumber || uData.phone || authUser.email || "").trim();
          }
        } catch {
          // Ignore lookup fail
        }
      }

      if (userPhone) {
        const cleanPhone = userPhone.replace(/[^\d+]/g, "");
        const fallbackRes = await fetch(`${GATEWAY_URL}/api/auth/verify-otp`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phoneNumber: cleanPhone,
            otpCode,
            type: "pin_reset",
            ...body
          }),
          signal: controller.signal,
        });

        if (fallbackRes) {
          response = fallbackRes;
          responseText = await response.text().catch(() => "");
        }
      }
    }

    clearTimeout(timeoutId);

    let result: Record<string, any> = {};

    try {
      result = responseText ? JSON.parse(responseText) : {};
    } catch {
      if (responseText.includes("504") || responseText.includes("Gateway Time-out")) {
        result = { error: "Gateway timed out while connecting to server. Please try again in a few seconds." };
      } else if (responseText.includes("Cannot POST") || responseText.includes("<!DOCTYPE")) {
        result = { error: "WhatsApp OTP verification service is currently unavailable." };
      } else {
        result = { error: responseText || "Server returned non-JSON response." };
      }
    }

    if (!response.ok) {
      let rawErr = String(result.error || result.message || "Failed to verify OTP.");
      if (
        rawErr.includes("Cannot POST") ||
        rawErr.includes("<!DOCTYPE") ||
        rawErr.includes("html") ||
        response.status === 404 ||
        response.status === 502 ||
        response.status === 503
      ) {
        rawErr = "WhatsApp OTP verification service is currently unavailable.";
      }
      return NextResponse.json(
        { error: rawErr },
        { status: response.status }
      );
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
