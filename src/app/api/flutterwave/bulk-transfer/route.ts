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

  // Rate Limiting: 10 bulk-transfer requests per minute per IP
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many bulk transfer requests. Please try again in a minute." }, { status: 429 });
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
    console.error("[Bulk Transfer API Auth Error] Auth verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
  }

  let totalDeduction = 0;
  let ledgerDocId = "";
  let reference = "";

  try {
    const body = await req.json();
    console.log("[Bulk Transfer API] Processing bulk transfer for user:", uid);

    const title = body.title || "Bulk Settlement";
    const recipients = body.recipients; // Array of { accountNumber, bankId, bankName, recipientName, amount }
    const pin = body.pin;

    // Basic Validation
    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Invalid recipients batch. Must be a non-empty array." }, { status: 400 });
    }
    if (!pin || typeof pin !== "string" || pin.length !== 4) {
      return NextResponse.json({ error: "Please provide your 4-digit transaction PIN." }, { status: 400 });
    }

    // Validate each recipient and sum up totals
    let totalAmt = 0;
    for (const r of recipients) {
      const amt = Number(r.amount);
      if (isNaN(amt) || amt <= 0) {
        return NextResponse.json({ error: `Invalid amount for recipient ${r.recipientName || "unknown"}.` }, { status: 400 });
      }
      if (!r.accountNumber || !r.bankId) {
        return NextResponse.json({ error: `Missing bank code or account number for recipient ${r.recipientName || "unknown"}.` }, { status: 400 });
      }
      totalAmt += amt;
    }

    const flatFee = 10.00;
    const totalFees = recipients.length * flatFee;
    totalDeduction = totalAmt + totalFees;
    reference = `bulk-${Date.now()}-${uid.slice(-6)}`;
    ledgerDocId = `tx-${reference}`;

    const userRef = adminDb.collection("users").doc(uid);

    // 1. PIN Verification and Wallet Debit inside a Firestore Transaction
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

        // Reset pin attempts
        transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

        // Verify balance and debit atomically
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
          amount: totalAmt,
          currency: "NGN",
          reference,
          type: "TRANSFER",
          description: `Bulk transfer batch: ${title} (${recipients.length} recipients)`,
          recipientName: `${recipients.length} Batch Recipients`,
          status: "SUCCESS",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          fee: totalFees,
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
      throw txErr;
    }

    console.log("[Bulk Transfer API] Wallet debited atomically. Map & dispatch to Payment Gateway...");

    // 2. Translate front-end Recipients list to the raw bulk_data format expected by Flutterwave via payment-gateway
    const bulk_data = recipients.map((r, index) => ({
      bank_code: r.bankId,
      account_number: r.accountNumber,
      amount: Number(r.amount),
      currency: "NGN",
      narration: `Bulk transfer: ${title}`,
      reference: `trf-${Date.now()}-${index}-${uid.slice(-4)}`,
    }));

    // 3. Dispatch the bulk transfer to the remote Payment Gateway
    let gatewaySuccess = false;
    let gatewayResponse: { success?: boolean; bulkTransferId?: string; reference?: string; data?: { id?: string }; message?: string; error?: string } | null = null;

    try {
      const gwRes = await fetch(`${PAYMENT_GATEWAY_URL}/api/flutterwave/bulk-transfer`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          bulk_data,
        }),
      });

      gatewayResponse = await gwRes.json();
      if (gwRes.ok && gatewayResponse && gatewayResponse.success) {
        gatewaySuccess = true;
      } else {
        console.error("[Bulk Transfer API] Payment Gateway returned error response:", gatewayResponse);
      }
    } catch (gwErr) {
      console.error("[Bulk Transfer API] Exception contacting payment gateway VM:", gwErr);
    }

    // 4. Handle Rollback Refund if the Payment Gateway bulk-transfer call fails
    if (!gatewaySuccess) {
      console.warn(`[Bulk Transfer API Rollback] Refund for bulk batch ${reference}. Refunding: ₦${totalDeduction}`);

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
            description: `[Refunded] Bulk transfer batch: ${title} (Gateway connection failed)`,
            updatedAt: new Date().toISOString(),
          });
        });

        console.log(`[Bulk Transfer API Rollback] Rollback completed. Wallet refunded ₦${totalDeduction}`);
      } catch (refundErr) {
        console.error(`[CRITICAL] Rollback refund failed for user ${uid}, reference ${reference}:`, refundErr);
      }

      const gatewayErrMsg = gatewayResponse ? (gatewayResponse.message || gatewayResponse.error) : "Payment Gateway failed to dispatch bulk transfers.";
      return NextResponse.json({
        success: false,
        error: `Bulk transfer could not be processed by provider: ${gatewayErrMsg}. Your wallet has been refunded.`
      }, { status: 400 });
    }

    // 5. Successful Completion
    logPaymentEvent({
      category: "Transfer",
      userId: uid,
      message: `Bulk transfer batch ${reference} successfully dispatched. Recipients: ${recipients.length}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: "Bulk transfer batch queued successfully.",
      reference,
      bulkTransferId: gatewayResponse ? (gatewayResponse.data?.id || gatewayResponse.bulkTransferId || reference) : reference,
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Bulk Transfer API Exception] Fatal error:", error.message, error.stack);
    return NextResponse.json({ error: "Internal server error during bulk transfer processing." }, { status: 500 });
  }
}
