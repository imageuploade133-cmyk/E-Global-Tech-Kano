import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { sendEmailOtp } from "@/lib/email-service";
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

    const channel = (body.channel || "whatsapp").toLowerCase();

    // Channel 1: WhatsApp - Forward directly to VM gateway existing WhatsApp OTP implementation
    if (channel === "whatsapp") {
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
        return NextResponse.json({ error: result.message || "Failed to dispatch PIN reset WhatsApp OTP." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        channel: "whatsapp",
        message: result.message || "PIN reset OTP sent to registered WhatsApp number.",
        ...(result.devOtpCode ? { devOtpCode: result.devOtpCode } : {}),
      });
    }

    // Channel 2: Email OTP
    if (channel === "email") {
      let authUser: { uid: string; email?: string } | null = null;
      try {
        authUser = await authenticateUserRequest(req);
      } catch (authErr: any) {
        return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
      }

      const uid = authUser.uid;
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        return NextResponse.json({ error: "User account profile not found." }, { status: 404 });
      }

      const userData = userDoc.data() || {};
      const targetEmail = userData.email || authUser.email;
      if (!targetEmail) {
        return NextResponse.json({ error: "No email address registered on your account profile." }, { status: 400 });
      }

      const userName = userData.name || userData.firstName || "User";

      // Rate limit check / Cooldown check on email OTP session
      const sessionDocRef = adminDb.collection("otp_sessions").doc(`pin_reset_email_${uid}`);
      const sessionSnap = await sessionDocRef.get();
      const now = Date.now();

      if (sessionSnap.exists) {
        const sData = sessionSnap.data() || {};
        const createdAt = new Date(sData.createdAt || 0).getTime();
        // 60 second cooldown before resending email OTP
        if (now - createdAt < 60000) {
          const waitSecs = Math.ceil((60000 - (now - createdAt)) / 1000);
          return NextResponse.json({ error: `Please wait ${waitSecs} second(s) before requesting another email OTP.` }, { status: 429 });
        }
      }

      // Generate secure 6-digit OTP
      const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
      const hashedOtp = await bcrypt.hash(rawOtp, 10);
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes

      await sessionDocRef.set({
        uid,
        email: targetEmail,
        hashedOtp,
        type: "pin_reset",
        channel: "email",
        verified: false,
        attempts: 0,
        createdAt: new Date(now).toISOString(),
        expiresAt,
      });

      // Dispatch Email OTP via Email API
      const mailRes = await sendEmailOtp(targetEmail, userName, rawOtp);

      if (!mailRes.success) {
        return NextResponse.json({
          error: "Unable to send OTP by email. Please try again or choose WhatsApp.",
          details: mailRes.error,
        }, { status: 500 });
      }

      return NextResponse.json({
        success: true,
        channel: "email",
        message: `PIN reset OTP sent to your email (${targetEmail.slice(0, 3)}***${targetEmail.slice(targetEmail.indexOf("@"))}).`,
        ...(process.env.NODE_ENV !== "production" ? { devOtpCode: rawOtp } : {}),
      });
    }

    return NextResponse.json({ error: "Invalid OTP channel specified. Supported channels are 'whatsapp' and 'email'." }, { status: 400 });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset OTP Endpoint] Exception:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch PIN reset OTP." }, { status: 500 });
  }
}
