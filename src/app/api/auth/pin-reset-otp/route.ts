import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";
import { sendEmail } from "@/lib/email-service";
import { getGatewayUrl } from "@/lib/gateway-util";

const GATEWAY_URL = getGatewayUrl();

export async function POST(req: Request) {
  try {
    const authUser = await authenticateUserRequest(req).catch(() => null);
    if (!authUser?.uid) {
      return NextResponse.json({ error: "Authentication required to reset PIN." }, { status: 401 });
    }

    const userSnap = await adminDb.collection("users").doc(authUser.uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const body = await req.json().catch(() => ({}));
    const channel = body.channel === "email" ? "email" : "whatsapp";
    const payload: Record<string, any> = { channel };

    if (channel === "email") {
      const userEmail = String(userData.email || userData.emailAddress || authUser.email || "").trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userEmail)) {
        return NextResponse.json({ error: "No valid registered email address found on this profile." }, { status: 400 });
      }
      payload.email = userEmail;
    } else {
      const phoneNumber = String(userData.phoneNumber || userData.phone || "").trim();
      if (!phoneNumber) {
        return NextResponse.json({ error: "No registered phone number found on this profile." }, { status: 400 });
      }
      payload.phoneNumber = phoneNumber;
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;
    if (!gatewayApiKey) {
      return NextResponse.json({ error: "OTP gateway authentication is not configured. Please contact support." }, { status: 503 });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 50000);

    const authHeader = req.headers.get("Authorization") || "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": authHeader,
    };
    if (gatewayApiKey) headers["x-api-key"] = gatewayApiKey;

    let response = await fetch(`${GATEWAY_URL}/api/auth/pin-reset-otp`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    let responseText = await response.text().catch(() => "");

    // Fallback: If gateway doesn't have /api/auth/pin-reset-otp (404), route to /api/auth/send-otp
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
        const fallbackRes = await fetch(`${GATEWAY_URL}/api/auth/send-otp`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            phoneNumber: cleanPhone,
            type: "pin_reset",
            ...payload
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
        result = { error: "WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead." };
      } else {
        result = { error: responseText || "Server returned non-JSON response." };
      }
    }

    if (!response.ok) {
      let rawErr = String(result.error || result.message || "Failed to dispatch PIN reset OTP.");
      if (
        rawErr.includes("WhatsApp instance") ||
        rawErr.includes("not active or connected") ||
        rawErr.includes("WhatsApp Dispatch Failed") ||
        rawErr.includes("WHATSAPP_API") ||
        rawErr.includes("ECONNREFUSED") ||
        rawErr.includes("Cannot POST") ||
        rawErr.includes("<!DOCTYPE") ||
        rawErr.includes("html") ||
        response.status === 400 ||
        response.status === 404 ||
        response.status === 502 ||
        response.status === 503
      ) {
        rawErr = "WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead.";
      }
      return NextResponse.json(
        { error: rawErr },
        { status: response.status }
      );
    }

    return NextResponse.json({
      success: true,
      channel,
      message: result.message || "PIN reset OTP sent successfully.",
      ...(result.devOtpCode ? { devOtpCode: result.devOtpCode } : {}),
    });
  } catch (err: unknown) {
    const error = err as Error;
    const isTimeout = error.name === "AbortError";
    console.error("[PIN Reset OTP Proxy] Error:", error.message);
    return NextResponse.json(
      { error: isTimeout ? "OTP gateway connection timed out. Please try again." : "OTP gateway is currently unavailable. Please try again." },
      { status: isTimeout ? 504 : 502 }
    );
  }
}
