import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { isRateLimited } from "@/lib/rate-limiter";
import { logPaymentEvent } from "@/lib/payment-logger";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 20 payment initializations per minute max
  if (isRateLimited(ip, 20, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // Verify that the Authorization header is being decoded correctly.
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

  // Verify that Firebase Authentication is correctly extracting the user id.
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

    // Step 5: Log everything - Before validation
    console.log("Incoming USSD body", body);

    const {
      amount,
      currency,
      bankCode,
      bank_code,
      bankId,
      email,
      name,
      fullname,
      phone,
      phone_number,
      tx_ref,
      txRef,
      userId
    } = body;

    const payAmount = Number(amount);
    const payCurrency = currency || "NGN";

    // Validations (standard basic request checks, not restricting any bank)
    if (!amount || isNaN(payAmount) || payAmount <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }

    const finalBankCode = bank_code || bankCode || bankId;
    if (!finalBankCode) {
      return NextResponse.json({ error: "Selected bank is required." }, { status: 400 });
    }

    const finalTxRef = tx_ref || txRef || `flw-tx-${uid}-${Date.now()}`;

    // Ensure every Firestore document path uses a valid uid. Never call doc(undefined) or doc("")
    if (!finalTxRef || typeof finalTxRef !== "string" || finalTxRef.trim() === "") {
      console.error("[USSD Payment API Error] Generated tx_ref is empty or invalid:", finalTxRef);
      return NextResponse.json({ error: "Invalid transaction reference." }, { status: 400 });
    }

    // Step 6 / Tasks: Add verbose logging before Firestore access
    console.log("UID:", uid);
    console.log("Document path:", `pending_payments/${finalTxRef}`);
    console.log("Request Body:", JSON.stringify(body));

    // Create a server-managed pending payment record in Firestore first
    console.log(`[USSD Payment Init] Creating pending payment record: pending_payments/${finalTxRef}`);
    await adminDb.collection("pending_payments").doc(finalTxRef).set({
      userId: userId || uid,
      amount: payAmount,
      currency: payCurrency,
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const gatewayAuthHeader = req.headers.get("Authorization") || "";
    const idToken = gatewayAuthHeader.startsWith("Bearer ") ? gatewayAuthHeader.split("Bearer ")[1] : "";

    // Step 4: Forward ALL fields exactly as received. Do not discard fields.
    const gatewayPayload = {
      tx_ref: finalTxRef,
      amount: payAmount.toString(),
      currency: payCurrency,
      email: email || "captain@example.com",
      phone_number: phone_number || phone || "08012345678",
      fullname: fullname || name || "Customer",
      type: "ussd",
      country: "NG",
      account_bank: finalBankCode,
      ...body // Forward all fields exactly as received
    };

    // Step 5: Log everything - Before forwarding
    console.log("Sending to Payment Gateway", gatewayPayload);

    // Proxy request directly to etechglobalhub.duckdns.org
    const response = await fetch("https://etechglobalhub.duckdns.org/api/flutterwave/charges?type=ussd", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(gatewayPayload),
    });

    const resData = await response.json();

    // Step 5: Log everything - After forwarding
    console.log("Gateway response", resData);

    if (!response.ok || resData.status === "error" || resData.status === "failed") {
      const errMsg = resData.message || resData.error || `HTTP Error ${response.status}`;
      return NextResponse.json({
        success: false,
        error: errMsg,
        ...resData
      }, { status: response.ok ? 200 : response.status });
    }

    const flwData = resData.data || resData || {};
    const auth = resData.meta?.authorization ||
                 resData.data?.meta?.authorization ||
                 resData.data?.authorization ||
                 {};

    const rawAuthNote = auth.note ||
                        auth.validate_instructions ||
                        auth.instruction ||
                        flwData.payment_code ||
                        flwData.payment_instruction ||
                        resData.payment_code ||
                        resData.payment_instruction ||
                        "";

    // USSD bank mapping prefixes (without trailing asterisks for perfect `${prefix}*${amount}*${reference}#` construction)
    const USSD_PREFIXES: Record<string, string> = {
      "058": "*737",      // GTBank
      "011": "*894",      // First Bank
      "057": "*966",      // Zenith Bank
      "033": "*919",      // UBA
      "044": "*901",      // Access Bank
      "035": "*329",      // Wema Bank
      "070": "*7111",     // Fidelity Bank
      "030": "*909",      // Heritage Bank
      "032": "*826",      // Union Bank
      "050": "*822",      // FCMB
      "082": "*711",      // Keystone Bank
      "214": "*565*0",    // FCMB/other
      "076": "*770",      // Polaris Bank
      "232": "*945",      // Sterling Bank
      "035a": "*322",     // ALAT (Wema)
      "101": "*901",      // Providus Bank
      "215": "*737",      // Unity Bank
      "301": "*565",      // Jaiz Bank
      "999992": "*955",   // OPay
      "50515": "*5573",   // PalmPay

      // Dynamic bank ID mappings (as database IDs)
      "8": "*737",        // GTBank ID
      "1": "*901",        // Access Bank ID
      "6": "*894",        // First Bank ID
    };

    const prefix = USSD_PREFIXES[finalBankCode] || USSD_PREFIXES[bankId] || "*955";

    // Extract dynamic reference code
    let reference = "";
    if (rawAuthNote) {
      // E.g., "*bank_ussd_code*000*7548#" or "*955*000*7548#"
      let cleaned = rawAuthNote.replace(/^[*\s]+/, "").replace(/[#\s]+$/, "");
      cleaned = cleaned.replace(/^(bank_ussd_code|955|737|901|894|919|966|5573|329|7111|909|826|822|711|565\*0|565|770|945|322|301)/i, "");
      cleaned = cleaned.replace(/^[*\s]+/, ""); // E.g., "000*7548" or "7548"

      // If there are multiple parts (e.g. 000*7548), take the last numeric/code segment
      if (cleaned.includes("*")) {
        const parts = cleaned.split("*");
        const lastPart = parts.filter(Boolean).pop();
        if (lastPart) {
          cleaned = lastPart;
        }
      }
      reference = cleaned;
    }

    if (!reference) {
      reference = flwData.payment_code ||
                  flwData.payment_instruction ||
                  (finalTxRef ? finalTxRef.split("-").pop() || "7548" : "7548");
    }

    // Generate the final clean USSD code matching format: *PREFIX*AMOUNT*REFERENCE#
    const finalUssdCode = `${prefix}*${payAmount}*${reference}#`;

    logPaymentEvent({
      category: "Payment Initialized",
      userId: uid,
      tx_ref: finalTxRef,
      amount: payAmount,
      currency: payCurrency,
      message: `USSD Charge initiated successfully for bank ${flwData.account_bank || "Selected Bank"}. Code: ${finalUssdCode}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      status: "pending",
      flwId: flwData.id || "flw-test-id",
      txRef: finalTxRef,
      ussdCode: finalUssdCode,
      bankName: flwData.account_bank || "Selected Bank",
      ...resData
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[USSD Payment API Exception] Initiating failed:", error.message, error.stack);
    return NextResponse.json({ error: error.message || "Internal Server Error initiating USSD payment." }, { status: 500 });
  }
}
