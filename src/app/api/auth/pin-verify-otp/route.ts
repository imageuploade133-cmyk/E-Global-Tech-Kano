import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

export async function POST(req: Request) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { otpCode } = body;

    if (!otpCode) {
      return NextResponse.json({ error: "OTP code is required." }, { status: 400 });
    }

    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    if (!userData || !userData.phoneNumber) {
      return NextResponse.json({ error: "No registered phone number found on this profile." }, { status: 400 });
    }

    const fullPhone = userData.phoneNumber;
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "";

    const response = await fetch(`${GATEWAY_URL}/api/auth/verify-otp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
      },
      body: JSON.stringify({
        phoneNumber: fullPhone,
        otp: otpCode,
        type: "pin_reset"
      }),
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
