import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { VirtualAccountService } from "@/services/virtual-account-service";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  let uid = "";
  let emailFallback = "";
  let nameFallback = "";

  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
    emailFallback = authResult.email || "";
    nameFallback = authResult.name || "";
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { idNumber, type, idCardImage } = body; // type is "bvn" or "nin"

    if (!idNumber || !/^\d{11}$/.test(idNumber.trim())) {
      return NextResponse.json({ error: "Identity number must be exactly 11 digits." }, { status: 400 });
    }

    if (type !== "bvn" && type !== "nin") {
      return NextResponse.json({ error: "Identity type must be either 'bvn' or 'nin'." }, { status: 400 });
    }

    console.log(`[KYC Verification] Starting for user: ${uid}, Type: ${type}, ID: ${idNumber.slice(0, 4)}*******`);

    const bvnInput = type === "bvn" ? idNumber.trim() : undefined;
    const ninInput = type === "nin" ? idNumber.trim() : undefined;

    // Contact Flutterwave gateway server-side to provision the static virtual account
    // This acts as our successful verification gateway check!
    const account = await VirtualAccountService.getOrCreateVirtualAccount(
      uid,
      emailFallback,
      nameFallback,
      bvnInput,
      ninInput
    );

    // Save success status and the verified BVN/NIN securely in Firestore
    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set({
      kycStatus: "VERIFIED",
      bvn: bvnInput || null,
      nin: ninInput || null,
      idCardImage: idCardImage || null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[KYC Verification Success] User ${uid} is now VERIFIED. Static account allocated: ${account.accountNumber}`);

    return NextResponse.json({
      success: true,
      message: "KYC verification successful! Your static virtual account number has been allocated.",
      account: {
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
      }
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[KYC Verification Failure] user: ${uid}, Error: ${error.message}`);

    // Mark as failed in Firestore if requested (preserving other fields)
    try {
      const userRef = adminDb.collection("users").doc(uid);
      await userRef.set({
        kycStatus: "FAILED",
        updatedAt: new Date().toISOString(),
      }, { merge: true });
    } catch (saveErr) {
      console.error("Failed to update kycStatus to FAILED:", saveErr);
    }

    return NextResponse.json({
      error: error.message || "Identity verification failed. Please check your BVN/NIN or try again later."
    }, { status: 400 });
  }
}
