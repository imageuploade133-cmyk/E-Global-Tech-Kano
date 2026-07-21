import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { PaymentService } from "@/lib/payment-service";
import { adminDb } from "@/lib/firebase-admin";
import { isRateLimited } from "@/lib/rate-limiter";
import { logPaymentEvent } from "@/lib/payment-logger";
import { BankService } from "@/services/bank-service";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 20 payment initializations per minute max
  if (isRateLimited(ip, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // 5. If userId comes from Firebase ID Token, verify that the Authorization header is being decoded correctly.
  const authHeader = req.headers.get("Authorization") || "";
  console.log("[USSD Payment API] Authentication header received:", authHeader ? `${authHeader.substring(0, 30)}...` : "None");

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult?.uid || "";
    console.log("[USSD Payment API] Successfully decoded Authorization header. Extracted UID:", uid);
  } catch (authErr: unknown) {
    const err = authErr as Error;
    console.error("[USSD Auth Error] Decoding Authorization header failed:", err.message || err);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  // 3. Verify that Firebase Authentication is correctly extracting the user id.
  // The API must reject requests if uid is undefined instead of calling Firestore.
  if (!uid || typeof uid !== "string" || uid.trim() === "") {
    console.error("[USSD Auth Error] Authenticated user id is missing, undefined, or empty.");
    return NextResponse.json({
      success: false,
      message: "Authenticated user id missing."
    }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount, currency, bankCode: rawBankCode, bankId, email, name, phone } = body;

    const payAmount = Number(amount);
    const payCurrency = currency || "NGN";

    // Validations
    if (!amount || isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    let bankCode = rawBankCode;
    if (bankId) {
      // 4. Ensure every Firestore document path uses a valid id/uid. Never call doc(undefined) or doc("")
      if (!bankId || typeof bankId !== "string" || bankId.trim() === "") {
        console.error("[USSD Payment API Error] Selected bankId is empty or invalid:", bankId);
        return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
      }

      // 6. Add verbose logging before Firestore access
      console.log("UID:", uid);
      console.log("Document path:", `banks/${bankId}`);
      console.log("Request Body:", JSON.stringify(body));

      const bank = await BankService.getBankById(bankId);
      if (!bank) {
        return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
      }
      bankCode = bank.code;
    }

    if (!bankCode) {
      return NextResponse.json({ error: "Selected bank is required." }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: "Name and email are required customer fields." }, { status: 400 });
    }

    const tx_ref = `flw-tx-${uid}-${Date.now()}`;

    // 4. Ensure every Firestore document path uses a valid uid. Never call doc(undefined) or doc("")
    if (!tx_ref || typeof tx_ref !== "string" || tx_ref.trim() === "") {
      console.error("[USSD Payment API Error] Generated tx_ref is empty or invalid:", tx_ref);
      return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400 });
    }

    // 6. Add verbose logging before Firestore access
    console.log("UID:", uid);
    console.log("Document path:", `pending_payments/${tx_ref}`);
    console.log("Request Body:", JSON.stringify(body));

    // Create a server-managed pending payment record in Firestore first
    console.log(`[USSD Payment Init] Creating pending payment record: pending_payments/${tx_ref}`);
    await adminDb.collection("pending_payments").doc(tx_ref).set({
      userId: uid,
      amount: payAmount,
      currency: payCurrency,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const gatewayAuthHeader = req.headers.get("Authorization") || "";
    const idToken = gatewayAuthHeader.startsWith("Bearer ") ? gatewayAuthHeader.split("Bearer ")[1] : "";

    // Request the USSD charging code from VM Payment Gateway
    const ussdDetails = await PaymentService.createUSSDPayment({
      tx_ref,
      amount: payAmount,
      email,
      phone_number: phone || "08012345678",
      fullname: name,
      bank_code: bankCode,
    }, idToken);

    logPaymentEvent({
      category: "Payment Initialized",
      userId: uid,
      tx_ref,
      amount: payAmount,
      currency: payCurrency,
      message: `USSD Charge initiated successfully for bank ${ussdDetails.bankName}. Code: ${ussdDetails.ussdCode}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      ...ussdDetails,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[USSD Payment API Exception] Initiating failed:", error.message, error.stack);
    return NextResponse.json({ error: error.message || "Internal Server Error initiating USSD payment." }, { status: 500 });
  }
}
