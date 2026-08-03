import { NextResponse } from "next/server";
import { OtpStoreService } from "@/lib/otp-store";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { phonePrefix, phoneNumber, otpCode } = body;

    if (!phonePrefix || !phoneNumber || !otpCode) {
      return NextResponse.json({ error: "Phone prefix, phone number, and OTP code are required." }, { status: 400 });
    }

    const cleanPrefix = phonePrefix.trim();
    const cleanPhone = phoneNumber.trim().replace(/\D/g, "");
    const fullPhone = `${cleanPrefix}${cleanPhone}`;
    const cleanOtp = otpCode.trim();

    const data = await OtpStoreService.getOtp(fullPhone);

    if (!data) {
      return NextResponse.json({ error: "No active OTP request found. Please request a new code." }, { status: 400 });
    }

    // Check expiration
    const expiresAtTime = new Date(data.expiresAt).getTime();
    if (Date.now() > expiresAtTime) {
      return NextResponse.json({ error: "OTP has expired. Please request a new one." }, { status: 400 });
    }

    // Check if the OTP is already invalidated due to too many failed attempts
    if (data.attempts >= 3 || !data.otpHash) {
      return NextResponse.json({ error: "This OTP is invalid due to too many incorrect attempts. Please request a new one." }, { status: 400 });
    }

    // Compute input hash
    const inputHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");

    if (inputHash === data.otpHash) {
      // Success! Mark as verified
      await OtpStoreService.setOtp(fullPhone, {
        ...data,
        verified: true,
        verifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: "WhatsApp number verified successfully."
      });
    } else {
      // Failure! Increment attempts
      const newAttempts = (data.attempts || 0) + 1;
      const updateData = {
        ...data,
        attempts: newAttempts,
        updatedAt: new Date().toISOString()
      };

      if (newAttempts >= 3) {
        updateData.otpHash = ""; // clear OTP hash to permanently invalidate this OTP session
      }

      await OtpStoreService.setOtp(fullPhone, updateData);

      if (newAttempts >= 3) {
        return NextResponse.json({
          error: "Incorrect OTP. Too many incorrect attempts. This OTP is now invalid. Please request a new one."
        }, { status: 400 });
      } else {
        return NextResponse.json({
          error: `Incorrect OTP. You have ${3 - newAttempts} attempts remaining.`
        }, { status: 400 });
      }
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WhatsApp OTP] Error in verify-otp route:", error);
    return NextResponse.json({ error: error.message || "Failed to verify WhatsApp OTP." }, { status: 500 });
  }
}
