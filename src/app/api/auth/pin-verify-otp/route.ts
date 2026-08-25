import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";

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

    const { otpCode, channel: reqChannel } = body;

    if (!otpCode || String(otpCode).trim().length !== 6) {
      return NextResponse.json({ error: "Please enter a valid 6-digit OTP code." }, { status: 400 });
    }

    const cleanOtp = String(otpCode).trim();
    const channel = (reqChannel || "whatsapp").toLowerCase();

    // If channel is WhatsApp, verify via VM gateway
    if (channel === "whatsapp") {
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
        return NextResponse.json({ error: result.message || "Failed to verify WhatsApp OTP." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        message: result.message || "WhatsApp OTP verified successfully. Proceed to reset PIN."
      });
    }

    // If channel is Email OTP, verify via Firestore otp_sessions
    if (channel === "email") {
      let authUser: { uid: string } | null = null;
      try {
        authUser = await authenticateUserRequest(req);
      } catch (authErr: any) {
        return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
      }

      const uid = authUser.uid;
      const sessionDocRef = adminDb.collection("otp_sessions").doc(`pin_reset_email_${uid}`);
      const sessionSnap = await sessionDocRef.get();

      if (!sessionSnap.exists) {
        return NextResponse.json({ error: "No email OTP request session found. Please request a new code." }, { status: 404 });
      }

      const sData = sessionSnap.data() || {};

      if (Date.now() > (sData.expiresAt || 0)) {
        await sessionDocRef.delete();
        return NextResponse.json({ error: "Email OTP code has expired. Please request a new code." }, { status: 400 });
      }

      if ((sData.attempts || 0) >= 3) {
        await sessionDocRef.delete();
        return NextResponse.json({ error: "Maximum OTP verification attempts exceeded. Please request a new code." }, { status: 429 });
      }

      const isValid = await bcrypt.compare(cleanOtp, sData.hashedOtp || "");

      if (!isValid) {
        const nextAttempts = (sData.attempts || 0) + 1;
        await sessionDocRef.update({ attempts: nextAttempts });
        return NextResponse.json({
          error: `Incorrect OTP code. ${3 - nextAttempts} attempt(s) remaining.`,
          remainingAttempts: 3 - nextAttempts,
        }, { status: 400 });
      }

      // Mark verified and delete OTP session document so it cannot be reused
      await sessionDocRef.update({ verified: true, verifiedAt: new Date().toISOString() });
      await sessionDocRef.delete();

      return NextResponse.json({
        success: true,
        channel: "email",
        message: "Email OTP verified successfully. Proceed to set your new PIN."
      });
    }

    return NextResponse.json({ error: "Invalid OTP verification channel." }, { status: 400 });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset Verify OTP Exception]:", error);
    return NextResponse.json({ error: error.message || "Failed to verify OTP." }, { status: 500 });
  }
}
