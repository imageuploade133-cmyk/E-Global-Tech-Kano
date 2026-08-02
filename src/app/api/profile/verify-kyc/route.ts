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

    if (!uid) {
      console.error("[KYC Verification Auth Error] Decoded token is missing uid.");
      return NextResponse.json({ error: "Unauthorized: Firebase user UID is missing in the decoded token." }, { status: 401 });
    }
    console.log(`[KYC Verification] Authenticated Firebase User: ${uid}, Email: ${emailFallback || "none"}, Name: ${nameFallback || "none"}`);
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[KYC Verification Auth Error] Authentication failed:", error.message);
    return NextResponse.json({ error: `Unauthorized: ${error.message || "Invalid or missing authentication token."}` }, { status: 401 });
  }

  try {
    const body = await req.json();
    console.log("[KYC Verification] Complete incoming request body:", JSON.stringify(body));

    const { idNumber, type, idCardImage } = body; // type is "bvn" or "nin"

    const errors: string[] = [];
    if (!idNumber) {
      errors.push("Identity number (idNumber) is missing.");
    } else if (typeof idNumber !== "string") {
      errors.push("Identity number must be a string.");
    } else if (!/^\d{11}$/.test(idNumber.trim())) {
      errors.push(`Identity number '${idNumber}' is invalid. It must be exactly 11 digits.`);
    }

    if (!type) {
      errors.push("Identity type (type) is missing.");
    } else if (type !== "bvn" && type !== "nin") {
      errors.push(`Identity type '${type}' is invalid. It must be either 'bvn' or 'nin'.`);
    }

    if (errors.length > 0) {
      const errorMsg = errors.join(" ");
      console.error("[KYC Verification Validation Errors]:", errorMsg);
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const cleanIdNumber = idNumber.trim();
    console.log(`[KYC Verification] Starting for user: ${uid}, Type: ${type}, ID: ${cleanIdNumber.slice(0, 4)}*******`);

    // Server-side active database lookup to prevent duplicate linking of BVN/NIN during KYC
    const duplicateBvnQuery = await adminDb.collection("users")
      .where("bvn", "==", cleanIdNumber)
      .limit(1)
      .get();

    const duplicateNinQuery = await adminDb.collection("users")
      .where("nin", "==", cleanIdNumber)
      .limit(1)
      .get();

    if (!duplicateBvnQuery.empty || !duplicateNinQuery.empty) {
      const matchedBvnDoc = !duplicateBvnQuery.empty ? duplicateBvnQuery.docs[0] : null;
      const matchedNinDoc = !duplicateNinQuery.empty ? duplicateNinQuery.docs[0] : null;
      const matchedUid = matchedBvnDoc ? matchedBvnDoc.id : matchedNinDoc?.id;

      if (matchedUid !== uid) {
        return NextResponse.json({
          error: "This BVN/NIN is already linked to another active account. Please login to your existing account."
        }, { status: 400 });
      }
    }

    const bvnInput = type === "bvn" ? cleanIdNumber : undefined;
    const ninInput = type === "nin" ? cleanIdNumber : undefined;

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    // Contact Flutterwave gateway server-side to provision the static virtual account
    // This acts as our successful verification gateway check!
    const account = await VirtualAccountService.getOrCreateVirtualAccount(
      uid,
      emailFallback,
      nameFallback,
      bvnInput,
      ninInput,
      idToken
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
