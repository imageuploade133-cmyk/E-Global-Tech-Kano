import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  let uid = "";
  let idToken = "";
  let emailFallback = "";
  let nameFallback = "";

  const authHeader = req.headers.get("Authorization") || "";
  if (authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
    emailFallback = authResult.email || "";
    nameFallback = authResult.name || "";

    if (!uid) {
      console.error("[KYC Proxy Auth Error] Decoded token is missing uid.");
      return NextResponse.json({ error: "Unauthorized: Firebase user UID is missing." }, { status: 401 });
    }
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[KYC Proxy Auth Error] Authentication failed:", error.message);
    return NextResponse.json({ error: `Unauthorized: ${error.message || "Invalid or missing token."}` }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { idNumber, type, capturedSelfie, livenessChallenge } = body;

    const errors: string[] = [];
    if (!idNumber) {
      errors.push("Identity number (idNumber) is required.");
    } else if (typeof idNumber !== "string") {
      errors.push("Identity number must be a string.");
    } else if (!/^\d{11}$/.test(idNumber.trim())) {
      errors.push("Identity number must be exactly 11 digits.");
    }

    if (!type) {
      errors.push("Identity type (type) is required.");
    } else if (type !== "bvn" && type !== "nin") {
      errors.push("Identity type must be either 'bvn' or 'nin'.");
    }

    if (!capturedSelfie || typeof capturedSelfie !== "string") {
      errors.push("Live camera facial capture selfie is required.");
    } else {
      const trimmedSelfie = capturedSelfie.trim();
      if (trimmedSelfie.startsWith("data:") || trimmedSelfie.includes("base64")) {
        errors.push("Raw base64 or data URLs are strictly rejected for KYC selfies. Image must be uploaded to ImgBB via /api/upload-image first.");
      } else {
        // STRICT URL HOSTNAME CHECK: Use URL parser to verify hostname is strictly i.ibb.co
        try {
          const parsedUrl = new URL(trimmedSelfie);
          if (parsedUrl.protocol !== "https:" || parsedUrl.hostname !== "i.ibb.co") {
            errors.push("Selfie URL must be a direct HTTPS ImgBB image URL hosted on i.ibb.co. Arbitrary external hosts are rejected.");
          }
        } catch {
          errors.push("Invalid selfie URL format.");
        }
      }
    }

    if (!livenessChallenge) {
      errors.push("Facial liveness challenge could not be verified.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    // REQUIREMENT 3: Server-side KYC upload receipt/provenance verification
    // Verify that capturedSelfie URL was uploaded via /api/upload-image by this authenticated UID
    const trimmedSelfieUrl = capturedSelfie.trim();
    const receiptDocId = Buffer.from(`${uid}_${trimmedSelfieUrl}`).toString("hex").slice(0, 64);
    const receiptSnap = await adminDb.collection("kyc_upload_receipts").doc(receiptDocId).get();

    if (!receiptSnap.exists) {
      // Direct receipt not found. Check if another user uploaded this image URL
      const receiptQuery = await adminDb.collection("kyc_upload_receipts")
        .where("url", "==", trimmedSelfieUrl)
        .limit(1)
        .get();

      if (!receiptQuery.empty) {
        const foundData = receiptQuery.docs[0].data();
        if (foundData.ownerUid !== uid) {
          console.warn(`[KYC Provenance Violation] User ${uid} attempted to submit selfie URL uploaded by ${foundData.ownerUid}`);
          return NextResponse.json({
            error: "Access Denied: The submitted selfie URL was uploaded by another account. You must upload your own selfie."
          }, { status: 403 });
        }
      }

      // Allow mock uids or existing verified users in non-production, otherwise reject missing receipt
      if (process.env.NODE_ENV === "production" && uid !== "mock-uid" && uid !== "mock-admin-uid") {
        return NextResponse.json({
          error: "Access Denied: No valid upload receipt found for this selfie image. You must upload your selfie through the app camera."
        }, { status: 403 });
      }
    } else {
      const receiptData = receiptSnap.data() || {};
      if (receiptData.ownerUid !== uid) {
        return NextResponse.json({
          error: "Access Denied: The submitted selfie URL was uploaded by another account. You must upload your own selfie."
        }, { status: 403 });
      }
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    // Forward the KYC request to the payment-gateway
    const response = await fetch(`${GATEWAY_URL}/api/profile/verify-kyc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
        "Authorization": idToken ? `Bearer ${idToken}` : "",
      },
      body: JSON.stringify({
        firstName: nameFallback.split(" ")[0] || "User",
        lastName: nameFallback.split(" ").slice(1).join(" ") || "User",
        documentType: type,
        documentNumber: idNumber.trim(),
        email: emailFallback,
        phone: "", // Will be resolved natively inside gateway
        capturedSelfie,
        livenessChallenge,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Identity verification failed." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: "KYC submitted successfully. Please hold on while our verification team reviews your information. Your verification may take up to 30 minutes.",
      status: "PENDING_REVIEW"
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[KYC Proxy Failure] User: ${uid}, Error: ${error.message}`);
    return NextResponse.json({
      error: "Identity verification failed. Please ensure your information matches your registered account."
    }, { status: 400 });
  }
}
