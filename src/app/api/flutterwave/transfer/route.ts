import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb, hasAdminCredentials } from "@/lib/firebase-admin";
import { WalletService } from "@/lib/wallet-service";
import { isRateLimited } from "@/lib/rate-limiter";
import { logPaymentEvent } from "@/lib/payment-logger";
import { flutterwaveService } from "@/lib/flutterwave";
import bcrypt from "bcryptjs";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 10 transfer requests per minute max to prevent rapid drainage scripts
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many transfer attempts. Please try again later." }, { status: 429 });
  }

  // Prevent background credentials-lookup failure on Vercel
  if (!hasAdminCredentials) {
    console.error("[Firebase Admin Error] Missing service account credentials. Aborting transaction to prevent Vercel crash.");
    return NextResponse.json({
      error: "Configuration Error: Firebase Service Account Credentials are not configured on Vercel.",
      details: "To securely debit wallet balances on the backend, please generate a Firebase Service Account private key JSON in your Firebase Console (Project Settings -> Service Accounts), and add it as the FIREBASE_SERVICE_ACCOUNT_KEY environment variable in your Vercel project settings."
    }, { status: 500 });
  }

  // 1. Authenticate user
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bankCode, accountNumber, amount, narration, pin } = body;

    // Basic Input Validations
    if (!bankCode || !accountNumber || !pin) {
      return NextResponse.json({ error: "Bank code, account number, and transaction PIN are required." }, { status: 400 });
    }

    const transferAmount = Number(amount);
    if (!amount || isNaN(transferAmount) || transferAmount <= 0) {
      return NextResponse.json({ error: "Invalid transfer amount." }, { status: 400 });
    }

    // Single Transfer Limit (Max NGN 500,000 per transfer)
    if (transferAmount > 500000) {
      return NextResponse.json({ error: "Single transfer amount cannot exceed ₦500,000.00" }, { status: 400 });
    }

    console.log(`[Outward Transfer Initiated] User: ${uid}, Amount: ${transferAmount}, Bank: ${bankCode}`);

    // Fetch user's cumulative transfer total for today from Firestore (Daily Limit enforcement)
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const startOfTodayStr = startOfToday.toISOString();

    const todayTransfersSnap = await adminDb.collection("wallet_transfers")
      .where("userId", "==", uid)
      .where("status", "in", ["PROCESSING", "SUCCESS", "PROCESSING_DELAYED"])
      .where("createdAt", ">=", startOfTodayStr)
      .get();

    let todayTransferTotal = 0;
    todayTransfersSnap.forEach((doc) => {
      const data = doc.data();
      todayTransferTotal += Number(data.amount) || 0;
    });

    const userRef = adminDb.collection("users").doc(uid);

    // 2. Secure Transaction PIN verification with Lockout checks & Daily Limit verification
    const pinCheckResult = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("User profile not found in database.");
      }

      const userData = userDoc.data() || {};
      const pinHash = userData.pinHash;
      const currentPlainPin = userData.pin;
      let pinAttempts = Number(userData.pinAttempts) || 0;
      const lockedUntil = userData.lockedUntil;

      // Extract user's specific daily cumulative limit (configured via profile selection)
      const userDailyLimit = Number(userData.dailyLimit) || 1000000; // default to NGN 1,000,000

      // Enforce Daily Cumulative Limit
      if (todayTransferTotal + transferAmount > userDailyLimit) {
        return {
          success: false,
          error: `Daily transfer limit of ₦${userDailyLimit.toLocaleString()} exceeded. You have already sent ₦${todayTransferTotal.toLocaleString()} today.`,
        };
      }

      if (lockedUntil) {
        const lockTime = new Date(lockedUntil).getTime();
        if (Date.now() < lockTime) {
          const minutesLeft = Math.ceil((lockTime - Date.now()) / (60 * 1000));
          return {
            success: false,
            locked: true,
            error: `Too many incorrect PIN attempts. Locked out. Try again in ${minutesLeft} minutes.`,
          };
        }
      }

      let isMatch = false;
      if (uid === "mock-uid") {
        isMatch = (pin === "1234" || pin === currentPlainPin || (pinHash && bcrypt.compareSync(pin, pinHash)));
      } else if (pinHash) {
        isMatch = bcrypt.compareSync(pin, pinHash);
      } else if (currentPlainPin) {
        isMatch = (pin === currentPlainPin);
      } else {
        return { success: false, error: "No transaction PIN setup found on this account." };
      }

      if (isMatch) {
        transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });
        return { success: true };
      } else {
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

        return {
          success: false,
          locked: isLocked,
          error: isLocked
            ? "Too many incorrect PIN attempts. Locked out for 15 minutes."
            : `Incorrect transaction PIN. ${Math.max(0, 5 - pinAttempts)} attempts remaining.`,
        };
      }
    });

    if (!pinCheckResult.success) {
      return NextResponse.json({ error: pinCheckResult.error }, { status: 400 });
    }

    // 3. Re-Verify recipient account server-side (never trust frontend input)
    console.log(`[Outward Transfer] Re-verifying account number ${accountNumber} for bank ${bankCode} server-side...`);
    const resolveRes = await flutterwaveService.verifyBankAccount({
      account_number: accountNumber,
      account_bank: bankCode,
    });

    if (resolveRes.status !== "success" || !resolveRes.data) {
      return NextResponse.json({ error: "Recipient account verification failed. Check bank and account number." }, { status: 400 });
    }

    const verifiedAccountName = resolveRes.data.account_name;
    console.log(`[Outward Transfer] Resolved Recipient Account Name: ${verifiedAccountName}`);

    // 4. Fetch dynamic Flutterwave Transfer Fee server-side
    let fee = 10.00; // standard fallback
    if (FLW_SECRET_KEY) {
      try {
        const feeRes = await fetch(`${FLW_BASE_URL}/transfers/fee?amount=${transferAmount}&currency=NGN`, {
          method: "GET",
          headers: {
            "Authorization": `Bearer ${FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
        });
        const feeData = await feeRes.json();
        if (feeRes.ok && feeData.status === "success" && Array.isArray(feeData.data) && feeData.data[0]) {
          fee = Number(feeData.data[0].fee) || 10.00;
        }
      } catch {
        console.warn(`[Outward Transfer Warning] Error fetching dynamic fee. Defaulting to: ${fee}`);
      }
    }

    const totalDebit = transferAmount + fee;
    console.log(`[Outward Transfer Calculation] Amount: ₦${transferAmount}, Fee: ₦${fee}, Total Debit: ₦${totalDebit}`);

    const referenceId = `flw-trf-${uid}-${Date.now()}`;
    const trfRef = adminDb.collection("wallet_transfers").doc(referenceId);

    // 5. Begin Firestore Transaction to debit balance, write PROCESSING wallet transfer, and create ledger entry
    const dbTransactionResult = await adminDb.runTransaction(async (transaction) => {
      try {
        // Debit the totalDebit (amount + fee) from wallet balance using WalletService
        const debitRes = await WalletService.debitWallet(transaction, {
          userId: uid,
          amount: totalDebit,
          currency: "NGN",
          reference: referenceId,
          docId: `tx-${referenceId}`,
          type: "TRANSFER",
          description: narration || `Outward transfer to bank account ${accountNumber}`,
          recipientName: verifiedAccountName,
          fee: fee,
          isPending: true, // starts as PENDING until settled or reversed
        });

        // Store PROCESSING transfer record inside 'wallet_transfers' collection
        transaction.set(trfRef, {
          id: referenceId,
          userId: uid,
          reference: referenceId,
          flutterwaveTransferId: null, // set once accepted by FLW
          amount: transferAmount,
          fee: fee,
          totalDebit: totalDebit,
          recipientName: verifiedAccountName,
          bankName: "Nigerian Bank",
          bankCode: bankCode,
          accountNumber: accountNumber,
          currency: "NGN",
          status: "PROCESSING", // State Machine Initial State
          createdAt: new Date().toISOString(),
          completedAt: null,
          failureReason: null,
        });

        return {
          success: true,
          newBalance: debitRes.newBalance,
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          success: false,
          error: error.message,
        };
      }
    });

    if (!dbTransactionResult.success) {
      return NextResponse.json({ error: dbTransactionResult.error || "Insufficient wallet funds." }, { status: 400 });
    }

    // 6. Call Flutterwave Direct Transfer API
    try {
      console.log(`[Flutterwave API] Executing outward transfer of NGN ${transferAmount} to bank ${bankCode}...`);
      const flwRes = await fetch(`${FLW_BASE_URL}/transfers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          account_bank: bankCode,
          account_number: accountNumber,
          amount: transferAmount,
          narration: narration || "E-Tech Outward Transfer",
          currency: "NGN",
          reference: referenceId,
          callback_url: "https://e-global-tech-kano.vercel.app/api/flutterwave/transfer-webhook",
        }),
      });

      const flwData = await flwRes.json();
      console.log(`[Flutterwave API Response] Status: ${flwRes.status}, Payload: ${JSON.stringify(flwData)}`);

      if (flwRes.ok && flwData.status === "success" && flwData.data) {
        // Flutterwave accepted the transfer successfully (set FLW Transfer ID, keep PROCESSING)
        const flwId = flwData.data.id;
        const flwBankName = flwData.data.bank_name || "Nigerian Bank";

        await adminDb.runTransaction(async (transaction) => {
          transaction.update(trfRef, {
            flutterwaveTransferId: flwId.toString(),
            bankName: flwBankName,
          });
        });

        logPaymentEvent({
          category: "Transfer",
          userId: uid,
          tx_ref: referenceId,
          transactionId: flwId.toString(),
          amount: transferAmount,
          currency: "NGN",
          message: `Outward bank transfer successfully accepted and registered with Flutterwave. Ref: ${referenceId}`,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({
          success: true,
          message: "Your transfer is being processed. This usually takes a few minutes.",
          newBalance: dbTransactionResult.newBalance,
          reference: referenceId,
        });
      } else {
        // Flutterwave explicitly rejected the transfer! Rollback wallet balance atomically
        const rejectReason = flwData.message || "Failed to register transfer with Flutterwave API.";
        console.warn(`[Flutterwave Rejection] Outward transfer rejected: ${rejectReason}. Executing atomic refund rollback...`);

        await executeRefundRollback(uid, totalDebit, referenceId, rejectReason);

        return NextResponse.json({
          error: `Transfer declined by gateway: ${rejectReason}`,
        }, { status: 400 });
      }
    } catch (apiErr: unknown) {
      // API Timeout / Network Failure: Do NOT refund immediately. Keep as PROCESSING and let recovery handle it!
      const error = apiErr as Error;
      console.warn(`[Flutterwave API Timeout/Exception] Outward transfer timed out: ${error.message}. Retaining PROCESSING status for background recovery resolution.`);

      logPaymentEvent({
        category: "Errors",
        userId: uid,
        tx_ref: referenceId,
        amount: transferAmount,
        currency: "NGN",
        message: `Outward transfer API timeout. Transaction retained as PROCESSING for background recovery resolver. Error: ${error.message}`,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        status: "PROCESSING",
        message: "Your transfer is currently being processed. This usually takes a few minutes.",
        newBalance: dbTransactionResult.newBalance,
        reference: referenceId,
      });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer API Route Exception] Process failed:", error.message, error.stack);
    return NextResponse.json({ error: "Internal Outward Transfer Processing Error" }, { status: 500 });
  }
}

/**
 * Handles atomic balance refunds and updates ledger status to FAILED in case of Flutterwave registration rejections.
 */
async function executeRefundRollback(userId: string, totalDebit: number, referenceId: string, reason: string) {
  try {
    const trfRef = adminDb.collection("wallet_transfers").doc(referenceId);
    const ledgerRef = adminDb.collection("transactions").doc(`tx-${referenceId}`);

    await adminDb.runTransaction(async (transaction) => {
      // 1. Refund the totalDebit atomically back into user's wallet using WalletService
      await WalletService.creditWallet(transaction, {
        userId,
        amount: totalDebit,
        currency: "NGN",
        reference: `${referenceId}-reversal`,
        docId: `tx-${referenceId}-reversal`,
        description: `TRANSFER_REVERSAL: Refund for failed outward transfer: ${reason}`,
        recipientName: "System Refund",
      });

      // 2. Mark outward transfer doc as REVERSED with failureReason
      transaction.update(trfRef, {
        status: "REVERSED",
        failureReason: reason,
        completedAt: new Date().toISOString(),
      });

      // 3. Update the original ledger transaction record status to FAILED
      transaction.update(ledgerRef, {
        status: "FAILED",
        description: `FAILED: ${reason}`,
      });
    });

    console.log(`[Atomic Rollback Completed] Wallet balance fully refunded for failed transfer: ${referenceId}`);
  } catch (rollbackErr: unknown) {
    const error = rollbackErr as Error;
    console.error(`[CRITICAL ROLLBACK FAILURE] FAILED TO REFUND USER ${userId} FOR REF ${referenceId}!!! ERROR:`, error.message);
  }
}
