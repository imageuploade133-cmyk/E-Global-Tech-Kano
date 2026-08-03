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
    const userSnap = await adminDb.collection("users").doc(uid).get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data();
    if (!userData || !userData.phoneNumber) {
      return NextResponse.json({ error: "No registered phone number found on this profile." }, { status: 400 });
    }

    const fullPhone = userData.phoneNumber;
    // Extract phonePrefix and phoneNumber from the registered full phoneNumber field
    // Standard format is +23480... or +227...
    let phonePrefix = "+234";
    let phoneNumber = fullPhone;

    if (fullPhone.startsWith("+227")) {
      phonePrefix = "+227";
      phoneNumber = fullPhone.slice(4);
    } else if (fullPhone.startsWith("+234")) {
      phonePrefix = "+234";
      phoneNumber = fullPhone.slice(4);
    } else if (fullPhone.startsWith("+")) {
      // General fallback extraction
      const parts = fullPhone.split(/(\d+)/);
      if (parts.length > 1) {
        phonePrefix = "+" + parts[1];
        phoneNumber = fullPhone.slice(phonePrefix.length);
      }
    }

    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);

    return NextResponse.json({
      success: true,
      message: "PIN reset OTP sent to registered WhatsApp number.",
      cooldownUntil: result.cooldownUntil,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[PIN Reset OTP] Error:", error);
    return NextResponse.json({ error: error.message || "Failed to dispatch PIN reset OTP." }, { status: 500 });
  }
}
