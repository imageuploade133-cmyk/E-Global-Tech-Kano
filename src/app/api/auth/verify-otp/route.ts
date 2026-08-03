import { NextResponse } from "next/server";
import { WhatsAppOtpService } from "@/services/whatsapp-otp-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber, otpCode } = body;

    if (!phonePrefix || !phoneNumber || !otpCode) {
      return NextResponse.json({ error: "Phone prefix, phone number, and OTP code are required." }, { status: 400 });
    }

    // Delegate to clean WhatsApp OTP Service layer
    await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, otpCode);

    return NextResponse.json({
      success: true,
      message: "WhatsApp number verified successfully."
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP] Verify OTP route error:", error);
    return NextResponse.json({ error: error.message || "Failed to verify WhatsApp OTP." }, { status: 400 });
  }
}
