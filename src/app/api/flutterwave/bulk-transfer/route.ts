import { NextResponse } from "next/server";
import { authenticateUserRequest, verifyUserKycApproved } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";
import { NotificationService } from "@/services/notification-service";
import { calculateTransferMarkupFee, TransferTieredMarkup } from "@/lib/transfer-markup-util";
import bcrypt from "bcryptjs";

interface BulkRecipient {
  amount: number;
  bankId?: string;
  bank_code?: string;
  bankCode?: string;
  accountBank?: string;
  account_bank?: string;
  accountNumber?: string;
  account_number?: string;
  recipientAccount?: string;
  narration?: string;
  reference?: string;
}

export async function POST(req: Request) {
  const startTime = Date.now();
  let uid = "";

  // 1. Authenticate user
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[Bulk Transfer Auth Error] Verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  // Enforce KYC verification
  const isApproved = await verifyUserKycApproved(uid);
  if (!isApproved) {
    return NextResponse.json({ error: "Forbidden: Account verification is required to perform financial transactions." }, { status: 403 });
  }

  try {
    const body = await req.json();
    const { title, recipients, bulk_data, pin } = body;

    const trfRecipients = (recipients || bulk_data) as BulkRecipient[] | undefined;

    // Validations
    if (!trfRecipients || !Array.isArray(trfRecipients) || trfRecipients.length === 0) {
      return NextResponse.json({ error: "A list of transfer recipients is required." }, { status: 400 });
    }
    if (!pin) {
      return NextResponse.json({ error: "Transaction PIN is required to authorize bulk transfers." }, { status: 400 });
    }

    // Calculate total amounts and fees
    const totalAmt = trfRecipients.reduce((sum: number, rec: BulkRecipient) => sum + (Number(rec.amount) || 0), 0);
    const flatFee = 10.00;
    const totalFees = trfRecipients.length * flatFee;
    const totalDeduction = totalAmt + totalFees;

    if (isNaN(totalDeduction) || totalDeduction <= 0) {
      return NextResponse.json({ error: "Invalid total bulk transfer amount." }, { status: 400 });
    }

    const trfReference = `bulk-${Date.now()}-${uid.slice(-6)}`;
    const description = title || `Bulk outward transfer of ${trfRecipients.length} recipients`;

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const isMock = uid === "mock-uid";

    // 2. Atomically verify PIN and debit user balance inside Firestore transaction
    const userRef = adminDb.collection("users").doc(uid);
    const walletRef = adminDb.collection("wallets").doc(`${uid}_NGN`);

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      // ALL READS: Execute all reads at the beginning of the transaction block
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      // Preload NGN wallet balance
      const walletDoc = await transaction.get(walletRef);
      const walletBalance = walletDoc.exists ? (Number(walletDoc.data()?.balance) || 0) : 0;

      const userData = userDoc.data() || {};

      // Server-side Account Freeze Check (Blocks hacker bypasses)
      if (userData.isFrozen) {
        const freezeMsg = userData.freezeMessage || "Dear Customer please Contact Us or Visit Our Office for assistance";
        return {
          success: false,
          error: freezeMsg,
        };
      }

      const pinHash = userData.pinHash;
      const currentPlainPin = userData.pin;
      const lockedUntil = userData.lockedUntil;
      let pinAttempts = Number(userData.pinAttempts) || 0;

      // Lockout check
      if (lockedUntil) {
        const lockTime = new Date(lockedUntil).getTime();
        if (Date.now() < lockTime) {
          const minutesLeft = Math.ceil((lockTime - Date.now()) / (60 * 1000));
          return {
            success: false,
            error: `Too many incorrect PIN attempts. Locked. Please try again in ${minutesLeft} minutes.`,
          };
        }
      }

      let isPinMatch = false;
      if (isMock) {
        isPinMatch = (pin === "1234" || pin === currentPlainPin || (pinHash && bcrypt.compareSync(pin, pinHash)));
      } else if (pinHash) {
        isPinMatch = bcrypt.compareSync(pin, pinHash);
      } else if (currentPlainPin) {
        isPinMatch = (pin === currentPlainPin);
      } else {
        return {
          success: false,
          error: "No transaction PIN has been set up on this account.",
        };
      }

      if (!isPinMatch) {
        pinAttempts += 1;
        let lockTimestamp = null;
        if (pinAttempts >= 5) {
          lockTimestamp = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        }
        transaction.update(userRef, {
          pinAttempts,
          lockedUntil: lockTimestamp,
        });

        const remaining = Math.max(0, 5 - pinAttempts);
        return {
          success: false,
          error: pinAttempts >= 5
            ? "Too many incorrect PIN attempts. Account locked for 15 minutes."
            : `Incorrect PIN. ${remaining} attempts remaining.`,
        };
      }

      // PIN matches, reset attempts (WRITES operation start here)
      transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

      // Apply Bulk Transfer Fee Profit Markup securely on server-side from global admin config
      let defaultBulkTransferProfitMargin = 0;
      let bulkTransferTieredMargins: TransferTieredMarkup[] = [];
      const marginRef = adminDb.collection("config").doc("vtu_profit_margins");
      const marginSnap = await transaction.get(marginRef);
      if (marginSnap.exists) {
        const marginData = marginSnap.data() || {};
        defaultBulkTransferProfitMargin = Number(marginData.bulkTransferProfitMargin) || 0;
        if (Array.isArray(marginData.bulkTransferTieredMargins)) {
          bulkTransferTieredMargins = marginData.bulkTransferTieredMargins;
        }
      }

      // Calculate total fee by evaluating each recipient amount against tiered rules (or falling back to default bulk markup)
      let finalTotalFees = 0;
      for (const rec of trfRecipients) {
        const recAmt = Number(rec.amount) || 0;
        const recMarkup = calculateTransferMarkupFee(recAmt, defaultBulkTransferProfitMargin, bulkTransferTieredMargins);
        finalTotalFees += (10.00 + recMarkup);
      }
      const finalTotalDeduction = totalAmt + finalTotalFees;

      // Check balance using preloaded wallet
      if (walletBalance < finalTotalDeduction) {
        return {
          success: false,
          error: `Insufficient wallet balance to complete this bulk transfer. Required: ₦${finalTotalDeduction.toLocaleString()}, Available: ₦${walletBalance.toLocaleString()}`,
        };
      }

      // Perform local debit atomically with preloaded context
      await WalletService.debitWallet(transaction, {
        userId: uid,
        amount: finalTotalDeduction,
        currency: "NGN",
        reference: trfReference,
        type: "TRANSFER",
        description,
        recipientName: "Bulk Recipients",
        fee: finalTotalFees,
        preLoadedUser: {
          ref: userRef,
          data: userData,
          balance: Number(userData.balance) || 0,
        },
        preLoadedWallet: {
          ref: walletRef,
          data: walletDoc.exists ? walletDoc.data() || {} : {},
          balance: walletBalance,
        },
      });

      return {
        success: true,
      };
    });

    if (!transactionResult.success) {
      return NextResponse.json({ error: transactionResult.error }, { status: 400 });
    }

    // 3. Mock simulation bypass
    if (isMock) {
      logPaymentEvent({
        category: "Transfer",
        userId: uid,
        tx_ref: trfReference,
        amount: totalAmt,
        currency: "NGN",
        message: `Processed successful mock bulk transfer: ${description}`,
        processingTimeMs: Date.now() - startTime,
      });

      // Send Notification
      try {
        NotificationService.sendPushNotification(uid, {
          title: "💸 Bulk Transfer Sent",
          body: `Your bulk transfer of ₦${totalAmt.toLocaleString()} for ${trfRecipients.length} recipients is successful.`,
          type: "transaction",
          url: "/history",
        });
      } catch (notifErr: any) {
        console.error("[Notification Warning] Failed to dispatch mock bulk transfer notification:", notifErr.message);
      }

      return NextResponse.json({
        success: true,
        reference: trfReference,
        message: `Your bulk transfer of ${trfRecipients.length} recipients has been successfully processed!`,
      });
    }

    // 4. Map the client recipients into the bulk_data schema expected by the gateway
    const normalizedBulkData = trfRecipients.map((rec: BulkRecipient, index: number) => {
      const bankCodeRaw = rec.bankId || rec.bank_code || rec.bankCode || rec.accountBank || rec.account_bank;
      const accountNumberRaw = rec.accountNumber || rec.account_number || rec.recipientAccount;

      const bankCode = (bankCodeRaw !== undefined && bankCodeRaw !== null) ? String(bankCodeRaw).trim() : "";
      const accountNumber = (accountNumberRaw !== undefined && accountNumberRaw !== null) ? String(accountNumberRaw).trim() : "";
      const amount = Number(rec.amount);
      const narration = rec.narration ? String(rec.narration).trim() : `Bulk Transfer Item ${index + 1}`;
      const reference = rec.reference ? String(rec.reference).trim() : `blk-${Date.now()}-${index}-${uid.slice(-4)}`;

      return {
        bank_code: bankCode,
        account_number: accountNumber,
        amount,
        currency: "NGN",
        narration,
        reference,
      };
    });

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

    // 5. Call Google Cloud Payment Gateway S2S Bulk Transfer API
    try {
      console.log(`[Bulk Transfer API] Executing real bulk transfer via Payment Gateway: ${description}`);

      const gatewayRes = await fetch(`${gatewayUrl}/api/flutterwave/bulk-transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          title: title || "Bulk Settlement",
          bulk_data: normalizedBulkData,
        }),
      });

      const gatewayData = await gatewayRes.json();

      if (gatewayRes.ok && gatewayData.success) {
        logPaymentEvent({
          category: "Transfer",
          userId: uid,
          tx_ref: trfReference,
          amount: totalAmt,
          currency: "NGN",
          message: `Successfully processed real bulk transfer via Gateway: ${description}`,
          processingTimeMs: Date.now() - startTime,
        });

        // Send Notification
        try {
          NotificationService.sendPushNotification(uid, {
            title: "💸 Bulk Transfer Queued",
            body: `Your bulk transfer of ₦${totalAmt.toLocaleString()} for ${trfRecipients.length} recipients has been successfully queued.`,
            type: "transaction",
            url: "/history",
          });
        } catch (notifErr: any) {
          console.error("[Notification Warning] Failed to dispatch real bulk transfer notification:", notifErr.message);
        }

        return NextResponse.json({
          success: true,
          reference: trfReference,
          bulkTransferId: gatewayData.data?.id || gatewayData.bulkTransferId,
          message: `Your bulk transfer of ${trfRecipients.length} recipients has been successfully queued in the background!`,
        });
      } else {
        throw new Error(gatewayData.error || gatewayData.message || "Payment Gateway rejected the bulk transfer.");
      }

    } catch (apiErr: unknown) {
      const err = apiErr as Error;
      console.error("[Bulk Transfer API] Gateway bulk transfer failed. Rolling back local wallet debit:", err.message);

      // Rollback debit atomically inside transaction
      await adminDb.runTransaction(async (rollbackTx) => {
        const userDoc = await rollbackTx.get(userRef);
        const walletDoc = await rollbackTx.get(walletRef);
        if (userDoc.exists) {
          // Update the original transaction document to FAILED
          const origTxRef = adminDb.collection("transactions").doc(`tx-${trfReference}`);
          rollbackTx.update(origTxRef, { status: "FAILED" });

          const uData = userDoc.data() || {};
          let defaultBulkTransferProfitMargin = 0;
          let bulkTransferTieredMargins: TransferTieredMarkup[] = [];
          const marginRef = adminDb.collection("config").doc("vtu_profit_margins");
          const marginSnap = await rollbackTx.get(marginRef);
          if (marginSnap.exists) {
            const marginData = marginSnap.data() || {};
            defaultBulkTransferProfitMargin = Number(marginData.bulkTransferProfitMargin) || 0;
            if (Array.isArray(marginData.bulkTransferTieredMargins)) {
              bulkTransferTieredMargins = marginData.bulkTransferTieredMargins;
            }
          }
          let finalTotalFees = 0;
          for (const rec of trfRecipients) {
            const recAmt = Number(rec.amount) || 0;
            const recMarkup = calculateTransferMarkupFee(recAmt, defaultBulkTransferProfitMargin, bulkTransferTieredMargins);
            finalTotalFees += (10.00 + recMarkup);
          }
          const finalTotalDeduction = totalAmt + finalTotalFees;

          const wBalance = walletDoc.exists ? (Number(walletDoc.data()?.balance) || 0) : 0;
          await WalletService.creditWallet(rollbackTx, {
            userId: uid,
            amount: finalTotalDeduction,
            currency: "NGN",
            reference: `REFUND-${trfReference}`,
            description: `Refund for failed bulk transfer: ${description}`,
            recipientName: "Bulk Recipients",
            preLoadedUser: {
              ref: userRef,
              data: uData,
              balance: Number(uData.balance) || 0,
            },
            preLoadedWallet: {
              ref: walletRef,
              data: walletDoc.exists ? walletDoc.data() || {} : {},
              balance: wBalance,
            },
          });
        }
      });

      return NextResponse.json({
        error: `Failed to complete outward bulk transfer: ${err.message}. Local wallet balance has been successfully refunded.`
      }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Bulk Transfer API Exception]:", error.message, error.stack);
    return NextResponse.json({ error: "Internal processing error occurred while executing bulk transfer." }, { status: 500 });
  }
}
