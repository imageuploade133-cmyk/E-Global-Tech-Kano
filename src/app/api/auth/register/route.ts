import { NextResponse } from "next/server";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 5 registration attempts per IP per minute
  if (isRateLimited(ip, 5, 60 * 1000)) {
    return NextResponse.json({ error: "Too many registration attempts. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const {
      firstName,
      lastName,
      dateOfBirth,
      houseNumber,
      street,
      city,
      state,
      country,
      postalCode,
      phonePrefix,
      phoneNumber,
      email,
      password,
      acceptedTerms,
      acceptedPrivacy,
      acceptedTermsVersion,
      acceptedPrivacyVersion,
    } = body;

    // Server-side Validation
    if (!firstName || firstName.trim().length < 2) {
      return NextResponse.json({ error: "First Name must be at least 2 characters." }, { status: 400 });
    }
    if (!lastName || lastName.trim().length < 2) {
      return NextResponse.json({ error: "Last Name must be at least 2 characters." }, { status: 400 });
    }

    const { adminDb } = await import("@/lib/firebase-admin");

    // Phone Prefix Validation
    const validPrefixes = ["+234", "+227"];
    if (!phonePrefix || !validPrefixes.includes(phonePrefix)) {
      return NextResponse.json({ error: "Supported phone prefixes are Nigeria (+234) and Niger (+227)." }, { status: 400 });
    }

    if (!phoneNumber || phoneNumber.trim().length < 7) {
      return NextResponse.json({ error: "Invalid phone number length." }, { status: 400 });
    }

    // Active database lookup to prevent duplicate linking of Phone Numbers (checking all likely formats)
    const cleanPhone = `${phonePrefix}${phoneNumber.trim()}`;
    let normPhone = cleanPhone;
    if (normPhone.startsWith("0")) {
      normPhone = "+234" + normPhone.slice(1);
    } else if (!normPhone.startsWith("+") && normPhone.length === 10) {
      normPhone = "+234" + normPhone;
    }

    let cleanPhoneNoZero = cleanPhone;
    if (cleanPhone.startsWith("+2340")) {
      cleanPhoneNoZero = "+234" + cleanPhone.slice(5);
    } else if (cleanPhone.startsWith("+2270")) {
      cleanPhoneNoZero = "+227" + cleanPhone.slice(5);
    }

    const possibleDuplicatePhones = Array.from(new Set([
      cleanPhone,
      normPhone,
      cleanPhoneNoZero,
      phoneNumber.trim(),
    ])).filter(Boolean);

    const phoneQuery = await adminDb.collection("users")
      .where("phoneNumber", "in", possibleDuplicatePhones)
      .limit(1)
      .get();

    if (!phoneQuery.empty) {
      return NextResponse.json({
        error: "An account with this Phone Number already exists. Please login to your existing account."
      }, { status: 400 });
    }

    // Active check on the Firestore otp_sessions collection for verified WhatsApp OTP state
    // Generate all potential phone number format variations to match the verified session robustly
    const cleanPrefix = phonePrefix.trim().replace(/\D/g, "");
    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    const cleanNumNoZero = cleanNum.startsWith("0") ? cleanNum.slice(1) : cleanNum;

    const possiblePhones = Array.from(new Set([
      `${cleanPrefix}${cleanNum}`,
      `${cleanPrefix}${cleanNumNoZero}`,
      `+${cleanPrefix}${cleanNum}`,
      `+${cleanPrefix}${cleanNumNoZero}`,
      `${phonePrefix}${phoneNumber.trim()}`,
      cleanNum,
      cleanNumNoZero
    ])).filter(Boolean);

    console.log("[Register API] Checking verified WhatsApp OTP with potential formats:", possiblePhones);

    const otpQuery = await adminDb.collection("otp_sessions")
      .where("phoneNumber", "in", possiblePhones)
      .where("type", "==", "signup")
      .where("verified", "==", true)
      .get();

    if (otpQuery.empty) {
      return NextResponse.json({
        error: "Your WhatsApp phone number has not been verified yet. Please verify it before proceeding."
      }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address format." }, { status: 400 });
    }

    // Active database lookup to prevent duplicate linking of Email Address
    const cleanEmail = email.trim().toLowerCase();
    const emailQuery = await adminDb.collection("users")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    if (!emailQuery.empty) {
      return NextResponse.json({
        error: "An account with this Email Address already exists. Please login to your existing account."
      }, { status: 400 });
    }

    // Password Validation: 8 chars, uppercase, lowercase, number, special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
    if (!password || !passwordRegex.test(password)) {
      return NextResponse.json({
        error: "Password must be at least 8 characters and include uppercase, lowercase, number, and a special character.",
      }, { status: 400 });
    }

    // Versioned Terms & Privacy Validation
    if (!acceptedTerms || !acceptedPrivacy) {
      return NextResponse.json({ error: "You must accept the Terms & Conditions and Privacy Policy." }, { status: 400 });
    }

    if (acceptedTermsVersion !== "v1.0.0" || acceptedPrivacyVersion !== "v1.0.0") {
      return NextResponse.json({ error: "Terms or Privacy Policy version mismatch." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "Validation passed." });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "An error occurred during verification." }, { status: 500 });
  }
}
