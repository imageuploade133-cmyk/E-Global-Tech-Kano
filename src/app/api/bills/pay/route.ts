import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";
import { PaymentGatewayManager } from "@/lib/payment/PaymentGatewayManager";
import bcrypt from "bcryptjs";
import { MOCK_ITEMS } from "../items/config";

export async function POST(req: Request) {
  const startTime = Date.now();
  let uid = "";

  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[Bills Pay Auth Error] Verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      biller_code,
      item_code,
      amount,
      customer_id,
      biller_name,
      biller_type, // "airtime", "data", "cable", "utility", "internet"
      pin,
    } = body;

    // Validations
    if (!biller_code || !item_code || !customer_id || !pin) {
      return NextResponse.json(
        { error: "Biller code, item code, customer identifier and your transaction PIN are required." },
        { status: 400 }
      );
    }

    const numAmount = Number(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Invalid bill amount. Must be greater than zero." }, { status: 400 });
    }

    // Backend Custom Data Amount floor validation
    if (biller_type?.toUpperCase() === "DATA") {
      let matchedPlan = null;
      for (const billerCode in MOCK_ITEMS) {
        const plans = MOCK_ITEMS[billerCode];
        const plan = plans.find(p => p.item_code === item_code);
        if (plan) {
          matchedPlan = plan;
          break;
        }
      }

      if (matchedPlan && matchedPlan.amount > 0 && numAmount < matchedPlan.amount) {
        return NextResponse.json(
          { error: `Custom data payment amount (₦${numAmount}) cannot be less than the standard plan price of ₦${matchedPlan.amount}.` },
          { status: 400 }
        );
      }
    }

    // Verify user transaction PIN and debit wallet inside single atomic Firestore transaction
    const userRef = adminDb.collection("users").doc(uid);
    const reference = `BILL-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const transactionType = biller_type?.toUpperCase() === "AIRTIME" ? "AIRTIME" :
                            biller_type?.toUpperCase() === "DATA" ? "DATA" : "BILLS";

    const description = `${biller_name || "Bill Payment"} (${item_code}) to ${customer_id}`;

    // Atomically verify PIN and debit wallet
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
      if (uid === "mock-uid") {
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

      // PIN is correct, reset pinAttempts and check balance
      transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

      const currentBalance = Number(userData.balance) || 0;
      if (currentBalance < numAmount) {
        return {
          success: false,
          error: `Insufficient wallet funds to pay this bill. Required: ₦${numAmount.toLocaleString()}, Available: ₦${currentBalance.toLocaleString()}`,
        };
      }

      // Safe debit
      await WalletService.debitWallet(transaction, {
        userId: uid,
        amount: numAmount,
        currency: "NGN",
        reference,
        type: transactionType,
        description,
        recipientName: customer_id,
        fee: 0,
      });

      return {
        success: true,
        reference,
      };
    });

    if (!transactionResult.success) {
      return NextResponse.json({ error: transactionResult.error }, { status: 400 });
    }

    // Call dynamic PaymentGatewayManager to select prioritized provider
    const featureName = biller_type?.toUpperCase() === "AIRTIME" ? "airtime" :
                        biller_type?.toUpperCase() === "DATA" ? "data" : "bills";

    const gateway = await PaymentGatewayManager.selectGateway({
      country: "NG",
      currency: "NGN",
      feature: featureName,
    });

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const isSandbox = sessionStorage.getItem("mock") === "true";

    if (isSandbox) {
      logPaymentEvent({
        category: "Wallet Debited",
        userId: uid,
        message: `Successfully processed mock bill payment: ${description} (Ref: ${reference})`,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        message: "Bill payment successfully processed!",
        data: {
          reference,
          tx_ref: reference,
          flw_ref: `MOCK-FLW-${Date.now()}`,
          amount: numAmount,
          customer: customer_id,
          biller_name,
        },
      });
    }

    try {
      console.log(`[PaymentGatewayManager] Processing bill payment via prioritized provider: [${gateway.name}]`);
      const paymentRes = await gateway.payBills({
        biller_code,
        item_code,
        amount: numAmount,
        customer_id,
        biller_name,
        biller_type: biller_type || "utility",
        reference,
      }, idToken);

      if (paymentRes.success) {
        logPaymentEvent({
          category: "Wallet Debited",
          userId: uid,
          message: `Successfully processed bill payment [${gateway.name}]: ${description} (Ref: ${reference})`,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({
          success: true,
          message: "Bill payment successfully processed!",
          data: paymentRes,
        });
      } else {
        throw new Error(paymentRes.error || "Failed to complete payment with gateway.");
      }

    } catch (apiErr: unknown) {
      const err = apiErr as Error;
      console.error(`[Bills Pay Error] Execution failed on provider [${gateway.name}]:`, err.message);

      // Rollback debit atomically
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          await WalletService.creditWallet(transaction, {
            userId: uid,
            amount: numAmount,
            currency: "NGN",
            reference: `REFUND-${reference}`,
            description: `Refund for failed bill payment: ${description}`,
            recipientName: customer_id,
          });
        }
      });

      return NextResponse.json({
        error: `Failed to complete payment with billing provider: ${err.message}. Wallet funds have been successfully refunded.`
      }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Bills Pay Main Exception]:", error.message, error.stack);
    return NextResponse.json({ error: "Internal processing error occurred while executing payment." }, { status: 500 });
  }
}
