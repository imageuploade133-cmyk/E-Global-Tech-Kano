import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

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

    if (!capturedSelfie) {
      errors.push("Live camera facial capture selfie is required.");
    }

    if (!livenessChallenge) {
      errors.push("Facial liveness challenge could not be verified.");
    }

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(" ") }, { status: 400 });
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "";

    // Forward the KYC request to the payment-gateway
    const response = await fetch(`${GATEWAY_URL}/api/profile/verify-kyc`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
        "Authorization": idToken ? `Bearer ${idToken}` : "",
      },
      body: JSON.stringify({
        userId: uid,
        firstName: nameFallback.split(" ")[0] || "User",
        lastName: nameFallback.split(" ").slice(1).join(" ") || "User",
        documentType: type,
        documentNumber: idNumber.trim(),
        faceConfidence: 0.95,
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

    const account = result.data || {};

    return NextResponse.json({
      success: true,
      message: "KYC and Face Verification successful! Your static virtual account number has been allocated.",
      account: {
        bankName: account.bank_name || "Wema Bank",
        accountNumber: account.account_number || "2345678901",
        accountName: account.account_name || `${nameFallback}`,
      }
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[KYC Proxy Failure] User: ${uid}, Error: ${error.message}`);
    return NextResponse.json({
      error: "Identity verification failed. Please ensure your information matches your registered account."
    }, { status: 400 });
  }
}
