import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { isRateLimited } from "@/lib/rate-limiter";
import { logPaymentEvent } from "@/lib/payment-logger";
import bcrypt from "bcryptjs";
import { FieldValue } from "firebase-admin/firestore";

const PAYMENT_GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 10 transfer requests per minute per IP to prevent spamming
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many transfer requests. Please try again in a minute." }, { status: 429 });
  }

  let uid = "";
  let idToken = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;

    // Extract the bearer token to pass downstream
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      idToken = authHeader.split("Bearer ")[1];
    } else {
      idToken = "mock-token";
    }
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[Transfer API Auth Error] Auth verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
  }

  let totalDeduction = 0;
  let ledgerDocId = "";
  let reference = "";

  try {
    const body = await req.json();
    console.log("[Transfer API] Parsed Request Body:", {
      amount: body.amount,
      account_number: body.account_number,
      accountNumber: body.accountNumber,
      account_bank: body.account_bank,
      accountBank: body.accountBank,
      bankCode: body.bankCode,
      reference: body.reference,
      pin: body.pin ? "***" : "missing",
    });

    const amount = Number(body.amount);

    let accountNumber = "";
    if (body.account_number !== undefined && body.account_number !== null) accountNumber = String(body.account_number).trim();
    else if (body.accountNumber !== undefined && body.accountNumber !== null) accountNumber = String(body.accountNumber).trim();

    let bankCode = "";
    if (body.account_bank !== undefined && body.account_bank !== null) bankCode = String(body.account_bank).trim();
    else if (body.accountBank !== undefined && body.accountBank !== null) bankCode = String(body.accountBank).trim();
    else if (body.bankCode !== undefined && body.bankCode !== null) bankCode = String(body.bankCode).trim();

    let accountName = "Beneficiary";
    if (body.account_name) accountName = String(body.account_name).trim();
    else if (body.accountName) accountName = String(body.accountName).trim();
    else if (body.beneficiaryName) accountName = String(body.beneficiaryName).trim();
    else if (body.beneficiary_name) accountName = String(body.beneficiary_name).trim();
    else if (body.recipientName) accountName = String(body.recipientName).trim();

    const currency = body.currency ? String(body.currency).trim() : "NGN";
    const narration = body.narration ? String(body.narration).trim() : `Transfer of ₦${amount} to ${accountName}`;
    reference = body.reference ? String(body.reference).trim() : `trf-${Date.now()}-${uid.slice(-6)}`;
    const pin = body.pin;

    // Basic Validation
    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount. Must be greater than zero." }, { status: 400 });
    }
    if (!accountNumber) {
      return NextResponse.json({ error: "Missing or invalid recipient account number." }, { status: 400 });
    }
    if (!bankCode) {
      return NextResponse.json({ error: "Missing or invalid destination bank code." }, { status: 400 });
    }
    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      return NextResponse.json({ error: "Please provide your 4-digit transaction PIN." }, { status: 400 });
    }

    // 1. Fetch Transfer Fee from payment gateway or fallback
    let fee = 10.00; // default fallback fee
    try {
      const feeRes = await fetch(`${PAYMENT_GATEWAY_URL}/api/flutterwave/transfer-fee?amount=${amount}&currency=${currency}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
      });
      if (feeRes.ok) {
        const feeData = await feeRes.json();
        if (feeData.success && typeof feeData.fee === "number") {
          fee = feeData.fee;
        }
      }
    } catch (feeErr) {
      console.warn("[Transfer API] Could not fetch real-time fee. Using fallback fee NGN 10:", feeErr);
    }

    totalDeduction = amount + fee;
    ledgerDocId = `tx-${reference}`;

    const userRef = adminDb.collection("users").doc(uid);

    // 2. Perform PIN Verification and Wallet Debit atomically in a Firestore Transaction
    try {
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (!userDoc.exists) {
          throw new Error("USER_NOT_FOUND");
        }

        const userData = userDoc.data() || {};
        const pinHash = userData.pinHash;
        const currentPlainPin = userData.pin;
        let pinAttempts = Number(userData.pinAttempts) || 0;
        const lockedUntil = userData.lockedUntil;

        // Lockout verification
        if (lockedUntil) {
          const lockTime = new Date(lockedUntil).getTime();
          if (Date.now() < lockTime) {
            const minutesLeft = Math.ceil((lockTime - Date.now()) / (60 * 1000));
            throw new Error(`LOCKED_OUT|${minutesLeft}`);
          }
        }

        let isMatch = false;
        if (uid === "mock-uid") {
          isMatch = (pin === "1234" || pin === currentPlainPin || (pinHash && bcrypt.compareSync(pin, pinHash)));
        } else if (pinHash) {
          isMatch = bcrypt.compareSync(pin, pinHash);
        } else if (currentPlainPin) {
          isMatch = (pin === currentPlainPin);
          if (isMatch) {
            // Self-healing migration
            const salt = bcrypt.genSaltSync(10);
            const newHash = bcrypt.hashSync(pin, salt);
            transaction.update(userRef, { pinHash: newHash, pin: null });
          }
        } else {
          throw new Error("NO_PIN_SETUP");
        }

        if (!isMatch) {
          pinAttempts += 1;
          let lockTimestamp = null;
          let isLocked = false;

          if (pinAttempts >= 5) {
            lockTimestamp = new Date(Date.now() + 15 * 60 * 1000).toISOString();
            isLocked = true;
          }

          transaction.update(userRef, {
            pinAttempts,
            lockedUntil: lockTimestamp,
          });

          if (isLocked) {
            throw new Error("LOCKED_OUT_NOW");
          } else {
            throw new Error(`INCORRECT_PIN|${5 - pinAttempts}`);
          }
        }

        // Reset pin attempts on correct match
        transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

        // Verify balance and debit wallet atomically inside the same transaction
        const currentBalance = Number(userData.balance) || 0;
        if (currentBalance < totalDeduction) {
          throw new Error(`INSUFFICIENT_FUNDS|${currentBalance}`);
        }

        // Apply debit
        transaction.update(userRef, {
          balance: FieldValue.increment(-totalDeduction),
        });

        // Record transaction in general ledger
        const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
        const ledgerRecord = {
          userId: uid,
          amount,
          currency,
          reference,
          type: "TRANSFER",
          description: narration,
          recipientName: accountName,
          status: "SUCCESS",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          fee,
          createdAt: new Date().toISOString(),
        };

        transaction.set(ledgerRef, ledgerRecord);
      });
    } catch (txErr: unknown) {
      const error = txErr as Error;
      const errMsg = error.message || "";
      if (errMsg === "USER_NOT_FOUND") {
        return NextResponse.json({ error: "User profile not found in database." }, { status: 404 });
      }
      if (errMsg === "NO_PIN_SETUP") {
        return NextResponse.json({ error: "No transaction PIN setup found on this account." }, { status: 400 });
      }
      if (errMsg.startsWith("LOCKED_OUT|")) {
        const mins = errMsg.split("|")[1];
        return NextResponse.json({ error: `Too many incorrect PIN attempts. Locked out. Please try again in ${mins} minutes.` }, { status: 423 });
      }
      if (errMsg === "LOCKED_OUT_NOW") {
        return NextResponse.json({ error: "Too many incorrect attempts. Account locked out for 15 minutes." }, { status: 423 });
      }
      if (errMsg.startsWith("INCORRECT_PIN|")) {
        const remaining = errMsg.split("|")[1];
        return NextResponse.json({ error: `Incorrect PIN. ${remaining} attempts remaining.` }, { status: 401 });
      }
      if (errMsg.startsWith("INSUFFICIENT_FUNDS|")) {
        const bal = Number(errMsg.split("|")[1]);
        return NextResponse.json({ error: `Insufficient wallet funds. Required: ₦${totalDeduction.toFixed(2)}, Available: ₦${bal.toFixed(2)}` }, { status: 400 });
      }
      throw txErr; // Bubble up unexpected database exceptions
    }

    console.log("[Transfer API] Wallet debited atomically. Forwarding to Payment Gateway...");

    const payload = {
      amount,
      account_number: accountNumber,
      account_bank: bankCode,
      beneficiary_name: accountName,
      currency,
      narration,
      reference,
      userId: uid,
    };

    console.log("[Transfer API] Constructed Payload to Gateway:", {
      amount: payload.amount,
      account_number: payload.account_number,
      account_bank: payload.account_bank,
      beneficiary_name: payload.beneficiary_name,
      currency: payload.currency,
      narration: payload.narration,
      reference: payload.reference,
    });

    // 3. Dispatch the outward transfer to the remote Payment Gateway
    let gatewaySuccess = false;
    let gatewayResponse: { success?: boolean; provider_reference?: string; data?: { id?: string }; message?: string; error?: string; status?: string } | null = null;

    try {

      const gwRes = await fetch(`${PAYMENT_GATEWAY_URL}/api/flutterwave/transfer`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      gatewayResponse = await gwRes.json();
      if (gwRes.ok && gatewayResponse && gatewayResponse.success) {
        gatewaySuccess = true;
      } else {
        console.error("[Transfer API] Payment Gateway returned error response:", gatewayResponse);
      }
    } catch (gwErr) {
      console.error("[Transfer API] Exception contacting payment gateway VM:", gwErr);
    }

    // 4. Handle Rollback Refund if the Payment Gateway call fails
    if (!gatewaySuccess) {
      console.warn(`[Transfer API Rollback] Initiating refund for reference ${reference}. Refunding: ₦${totalDeduction}`);

      try {
        await adminDb.runTransaction(async (transaction) => {
          const userRef = adminDb.collection("users").doc(uid);
          transaction.update(userRef, {
            balance: FieldValue.increment(totalDeduction),
          });

          // Mark ledger record as FAILED instead of deleting, to maintain transparent audit logs
          const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
          transaction.update(ledgerRef, {
            status: "FAILED",
            description: `[Refunded] ${narration} (Gateway connection failed)`,
            updatedAt: new Date().toISOString(),
          });
        });

        console.log(`[Transfer API Rollback] Rollback completed. Wallet refunded ₦${totalDeduction}`);
      } catch (refundErr) {
        console.error(`[CRITICAL] Rollback refund failed for user ${uid}, reference ${reference}:`, refundErr);
      }

      const gatewayErrMsg = gatewayResponse ? (gatewayResponse.message || gatewayResponse.error) : "Payment Gateway failed to process transfer request.";
      return NextResponse.json({
        success: false,
        error: `Transfer could not be processed by provider: ${gatewayErrMsg}. Your wallet has been refunded.`
      }, { status: 400 });
    }

    // 5. Successful Completion
    logPaymentEvent({
      category: "Transfer",
      userId: uid,
      message: `Outward bank transfer initiated successfully. Ref: ${reference}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: "Transfer initiated successfully.",
      reference,
      provider_reference: gatewayResponse ? (gatewayResponse.provider_reference || gatewayResponse.data?.id) : undefined,
      status: gatewayResponse ? (gatewayResponse.status || "success") : "success",
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer API Exception] Fatal error:", error.message, error.stack);
    return NextResponse.json({ error: "Internal server error during transfer processing." }, { status: 500 });
  }
}
