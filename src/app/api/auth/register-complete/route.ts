import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

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

    // For backward-compatibility, store full residential address as well
    const formattedAddress = `${cleanHouseNumber}, ${cleanStreet}, ${cleanCity}, ${cleanState}, ${cleanCountry}${cleanPostalCode ? `, ${cleanPostalCode}` : ""}`;

    const userRef = adminDb.collection("users").doc(uid);
    const docSnap = await userRef.get();
    const existingData = docSnap.exists ? docSnap.data() : null;

    // Defensive Fields: NEVER overwrite protected fields if they already exist
    const finalKycStatus = existingData?.kycStatus !== undefined ? existingData.kycStatus : "PENDING";
    const finalBalance = existingData?.balance !== undefined ? existingData.balance : 10000.00;
    const finalRole = existingData?.role !== undefined ? existingData.role : "user";

    // Create new profile update, completely preserving all protected fields
    const updatedProfile = {
      firstName: cleanFirstName,
      lastName: cleanLastName,
      fullName: fullName,
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

    return NextResponse.json({ success: true, message: "User document stored successfully." });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message || "An error occurred writing user registration data." }, { status: 500 });
  }
}
