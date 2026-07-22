import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const startTime = Date.now();
  let uid = "";

  // 1. Authenticate user
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[Transfer Auth Error] Verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      amount,
      account_number,
      accountNumber,
      account_bank,
      accountBank,
      bankCode,
      account_name,
      accountName,
      currency,
      narration,
      reference,
      pin,
    } = body;

    const trfAmount = Number(amount);
    const trfAccount = (account_number !== undefined && account_number !== null) ? String(account_number).trim() : ((accountNumber !== undefined && accountNumber !== null) ? String(accountNumber).trim() : "");
    const trfBank = (bankCode !== undefined && bankCode !== null) ? String(bankCode).trim() : ((accountBank !== undefined && accountBank !== null) ? String(accountBank).trim() : ((account_bank !== undefined && account_bank !== null) ? String(account_bank).trim() : ""));
    const trfName = (account_name !== undefined && account_name !== null) ? String(account_name).trim() : ((accountName !== undefined && accountName !== null) ? String(accountName).trim() : "Beneficiary");
    const trfCurrency = currency ? String(currency).trim() : "NGN";
    const trfReference = reference ? String(reference).trim() : `trf-${Date.now()}-${uid.slice(-6)}`;

    // Validations
    if (!trfAmount || isNaN(trfAmount) || trfAmount <= 0) {
      return NextResponse.json({ error: "Invalid transfer amount. Must be greater than zero." }, { status: 400 });
    }
    if (!trfAccount || !trfBank || !pin) {
      return NextResponse.json({ error: "Account number, bank, and transaction PIN are required." }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const isMock = uid === "mock-uid";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

    // 2. Fetch transfer fee dynamically from gateway or fallback to 10.00 NGN
    let fee = 10.00;
    if (!isMock) {
      try {
        const feeRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer-fee?amount=${trfAmount}&currency=${trfCurrency}`, {
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });
        const feeData = await feeRes.json();
        if (feeRes.ok && feeData.success) {
          fee = Number(feeData.fee) || 10.00;
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[Transfer API] Failed to fetch dynamic fee. Using fallback 10 NGN:", error.message);
      }
    }

    const totalDeduction = trfAmount + fee;
    const description = narration || `Direct transfer to ${trfName} (${trfAccount})`;

    // 3. Atomically verify PIN and debit user balance inside Firestore transaction
    const userRef = adminDb.collection("users").doc(uid);

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userDoc.data() || {};
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

      // PIN matches, reset attempts
      transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

      // Check balance
      const currentBalance = Number(userData.balance) || 0;
      if (currentBalance < totalDeduction) {
        return {
          success: false,
          error: `Insufficient wallet balance to complete this transfer. Required: ₦${totalDeduction.toLocaleString()}, Available: ₦${currentBalance.toLocaleString()}`,
        };
      }

      // Perform local debit atomically
      await WalletService.debitWallet(transaction, {
        userId: uid,
        amount: totalDeduction,
        currency: trfCurrency,
        reference: trfReference,
        type: "TRANSFER",
        description,
        recipientName: trfName,
        fee,
      });

      return {
        success: true,
      };
    });

    if (!transactionResult.success) {
      return NextResponse.json({ error: transactionResult.error }, { status: 400 });
    }

    // 4. Mock simulation bypass
    if (isMock) {
      logPaymentEvent({
        category: "Transfer",
        userId: uid,
        tx_ref: trfReference,
        amount: trfAmount,
        currency: trfCurrency,
        message: `Processed successful mock transfer: ${description}`,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        reference: trfReference,
        message: `Your mock bank transfer has been initiated successfully! ₦${trfAmount.toLocaleString()} is being settled to ${trfName}.`,
      });
    }

    // 5. Call Google Cloud Payment Gateway S2S Transfer API
    try {
      console.log(`[Transfer API] Executing real transfer via Payment Gateway: amount=${trfAmount} to ${trfName}`);

      const gatewayPayload = {
        amount: trfAmount,
        account_number: trfAccount,
        account_bank: trfBank,
        account_name: trfName,
        currency: trfCurrency,
        narration: description,
        reference: trfReference,
      };

      const gatewayRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(gatewayPayload),
      });

      const gatewayData = await gatewayRes.json();

      if (gatewayRes.ok && gatewayData.success) {
        logPaymentEvent({
          category: "Transfer",
          userId: uid,
          tx_ref: trfReference,
          amount: trfAmount,
          currency: trfCurrency,
          message: `Successfully processed real transfer via Gateway: ${description}`,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({
          success: true,
          reference: trfReference,
          provider_reference: gatewayData.provider_reference || gatewayData.data?.id,
          message: gatewayData.message || `Transfer initiated successfully!`,
        });
      } else {
        throw new Error(gatewayData.error || gatewayData.message || "Payment Gateway rejected the transfer.");
      }

    } catch (apiErr: unknown) {
      const err = apiErr as Error;
      console.error("[Transfer API] Gateway transfer failed. Rolling back local wallet debit:", err.message);

      // Rollback debit atomically inside transaction
      await adminDb.runTransaction(async (rollbackTx) => {
        const userDoc = await rollbackTx.get(userRef);
        if (userDoc.exists) {
          await WalletService.creditWallet(rollbackTx, {
            userId: uid,
            amount: totalDeduction,
            currency: trfCurrency,
            reference: `REFUND-${trfReference}`,
            description: `Refund for failed transfer: ${description}`,
            recipientName: trfName,
          });
        }
      });

      return NextResponse.json({
        error: `Failed to complete outward bank transfer: ${err.message}. Local wallet balance has been successfully refunded.`
      }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer API Exception]:", error.message, error.stack);
    return NextResponse.json({ error: "Internal processing error occurred while executing transfer." }, { status: 500 });
  }
}
