import { NextResponse } from "next/server";
import { WhatsAppOtpService } from "@/services/whatsapp-otp-service";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber } = body;

    if (!phonePrefix || !phoneNumber) {
      return NextResponse.json({ error: "Phone prefix and phone number are required." }, { status: 400 });
    }

    // Delegate to clean WhatsApp OTP Service layer
    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);

    return NextResponse.json({
      success: true,
      message: "OTP sent successfully to WhatsApp.",
      cooldownUntil: result.cooldownUntil,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP] Send OTP route error:", error);
    return NextResponse.json({ error: error.message || "Failed to send WhatsApp OTP." }, { status: 500 });
  }
}
