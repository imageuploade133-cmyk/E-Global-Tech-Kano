import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { ReferralService } from "@/services/referral-service";
import { WhatsAppOtpService } from "@/services/whatsapp-otp-service";

export async function POST(req: Request) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
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
      photoURL,
    } = body;

    // Sanitize values
    const cleanFirstName = (firstName || "").trim();
    const cleanLastName = (lastName || "").trim();
    const fullName = `${cleanFirstName} ${cleanLastName}`;
    const cleanHouseNumber = (houseNumber || "").trim();
    const cleanStreet = (street || "").trim();
    const cleanCity = (city || "").trim();
    const cleanState = (state || "").trim();
    const cleanCountry = (country || "").trim();
    const cleanPostalCode = (postalCode || "").trim();
    const cleanPhonePrefix = (phonePrefix || "").trim();
    const cleanPhoneNum = (phoneNumber || "").trim();
    const fullPhoneNumber = `${cleanPhonePrefix}${cleanPhoneNum}`;

    // Enforce WhatsApp OTP Verification
    try {
      await WhatsAppOtpService.validateVerifiedSession(fullPhoneNumber);
    } catch (otpErr: any) {
      return NextResponse.json({ error: otpErr.message || "WhatsApp verification failed." }, { status: 400 });
    }

    // For backward-compatibility, store full residential address as well
    const formattedAddress = `${cleanHouseNumber}, ${cleanStreet}, ${cleanCity}, ${cleanState}, ${cleanCountry}${cleanPostalCode ? `, ${cleanPostalCode}` : ""}`;

    const userRef = adminDb.collection("users").doc(uid);
    const docSnap = await userRef.get();
    const existingData = docSnap.exists ? docSnap.data() : null;

    // Defensive Fields: NEVER overwrite protected fields if they already exist
    const finalKycStatus = existingData?.kycStatus !== undefined ? existingData.kycStatus : "PENDING";
    const finalBalance = existingData?.balance !== undefined ? existingData.balance : 0.00;
    const finalRole = existingData?.role !== undefined ? existingData.role : "user";

    // Create new profile update, completely preserving all protected fields
    const updatedProfile = {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      fullName: fullName,
      name: fullName,
      displayName: fullName,
      dateOfBirth: dateOfBirth,
      // Structured address
      houseNumber: cleanHouseNumber,
      street: cleanStreet,
      city: cleanCity,
      state: cleanState,
      country: cleanCountry,
      postalCode: cleanPostalCode || null,
      address: formattedAddress,
      // Phone
      phonePrefix: cleanPhonePrefix,
      phoneNumber: fullPhoneNumber,
      // Photo
      photoURL: photoURL || existingData?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M",
      // Versioned Terms & Privacy Policy
      acceptedTerms: true,
      acceptedTermsAt: new Date().toISOString(),
      acceptedTermsVersion: "v1.0.0",
      acceptedPrivacy: true,
      acceptedPrivacyAt: new Date().toISOString(),
      acceptedPrivacyVersion: "v1.0.0",
      // Initialization fields
      kycStatus: finalKycStatus,
      balance: finalBalance,
      role: finalRole,
      createdAt: existingData?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Use merge to prevent deletion of fields like PIN, pinHash, dailyLimit, isPinRequired, etc.
    await userRef.set(updatedProfile, { merge: true });

    // Initialize Multi-Currency Wallets and Virtual Accounts
    const ngnWalletRef = adminDb.collection("wallets").doc(`${uid}_NGN`);
    const usdWalletRef = adminDb.collection("wallets").doc(`${uid}_USD`);

    await ngnWalletRef.set({
      userId: uid,
      currency: "NGN",
      balance: finalBalance,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    await usdWalletRef.set({
      userId: uid,
      currency: "USD",
      balance: 0.00,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Handle secure referral registration if a referral code was provided
    if (body.referralCode) {
      await ReferralService.registerReferral(
        uid,
        body.referralCode,
        fullName,
        body.email || existingData?.email || ""
      );
    }

    // Invalidate the verification session upon successful database save to prevent replay attacks
    await WhatsAppOtpService.completeSession(fullPhoneNumber);

    return NextResponse.json({ success: true, message: "User document stored successfully, multi-currency wallets initialized, and WhatsApp session completed." });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "An error occurred writing user registration data." }, { status: 500 });
  }
}
