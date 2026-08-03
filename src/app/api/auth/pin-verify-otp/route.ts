import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WhatsAppOtpService } from "@/services/whatsapp-otp-service";

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
    let phonePrefix = "+234";
    let phoneNumber = fullPhone;

    if (fullPhone.startsWith("+227")) {
      phonePrefix = "+227";
      phoneNumber = fullPhone.slice(4);
    } else if (fullPhone.startsWith("+234")) {
      phonePrefix = "+234";
      phoneNumber = fullPhone.slice(4);
    }

    await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, otpCode);

    return NextResponse.json({
      success: true,
      message: "WhatsApp OTP verified successfully. Proceed to reset PIN."
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset Verify OTP] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify OTP." }, { status: 400 });
  }
}
