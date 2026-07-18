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
    if (!dateOfBirth) {
      return NextResponse.json({ error: "Date of Birth is required." }, { status: 400 });
    }

    const dob = new Date(dateOfBirth);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (isNaN(dob.getTime())) {
      return NextResponse.json({ error: "Invalid Date of Birth." }, { status: 400 });
    }
    if (dob >= today) {
      return NextResponse.json({ error: "Date of Birth cannot be today or in the future." }, { status: 400 });
    }

    // Age validation: must be at least 18 years old
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      return NextResponse.json({ error: "You must be at least 18 years old to register." }, { status: 400 });
    }

    // Structured Address Validation
    if (!houseNumber || houseNumber.trim().length === 0) {
      return NextResponse.json({ error: "House Number is required." }, { status: 400 });
    }
    if (!street || street.trim().length === 0) {
      return NextResponse.json({ error: "Street name is required." }, { status: 400 });
    }
    if (!city || city.trim().length === 0) {
      return NextResponse.json({ error: "City is required." }, { status: 400 });
    }
    if (!state || state.trim().length === 0) {
      return NextResponse.json({ error: "State is required." }, { status: 400 });
    }
    if (!country || country.trim().length === 0) {
      return NextResponse.json({ error: "Country is required." }, { status: 400 });
    }

    // Postal code validation
    if (postalCode && postalCode.trim().length > 0 && !/^\d+$/.test(postalCode.trim())) {
      return NextResponse.json({ error: "Postal code must be numeric if provided." }, { status: 400 });
    }

    // Phone Prefix Validation
    const validPrefixes = ["+234", "+227"];
    if (!phonePrefix || !validPrefixes.includes(phonePrefix)) {
      return NextResponse.json({ error: "Supported phone prefixes are Nigeria (+234) and Niger (+227)." }, { status: 400 });
    }

    if (!phoneNumber || phoneNumber.trim().length < 7) {
      return NextResponse.json({ error: "Invalid phone number length." }, { status: 400 });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email address format." }, { status: 400 });
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
