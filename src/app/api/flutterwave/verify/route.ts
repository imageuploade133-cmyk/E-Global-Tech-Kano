import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

async function executeVerification(transactionId: string) {
  console.log(`[callback received] REQUEST DETECTED: Verification query triggered for Transaction ID: ${transactionId}`);
  console.log(`[verification started] Fetching transaction status from Flutterwave rail for ID: ${transactionId}`);

  // 1. Verify with Flutterwave's Verify API first before crediting any wallet
  const flwRes = await flutterwaveService.verifyTransaction(transactionId);

  if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
    console.warn(`[verification failed] Flutterwave status check was negative:`, flwRes);
    return {
      success: false,
      status: flwRes.data?.status || "failed",
      error: "Transaction was not successfully settled on Flutterwave rail.",
    };
  }

  const { amount, currency, tx_ref, customer } = flwRes.data;
  console.log(`[verification successful] Flutterwave returned success status for ID: ${transactionId}. Ref: ${tx_ref}, Amount: ${amount}, Currency: ${currency}`);

  // Retrieve custom user details encoded inside reference or match email
  // Reference format: flw-tx-{userId}-{timestamp}
  const parts = tx_ref.split("-");
  const userId = parts[2] && parts[2] !== "anon" ? parts[2] : null;

  if (!userId) {
    return {
      success: false,
      error: "Verification Failed: User ID context not resolved from transaction reference.",
    };
  }

  // 2. Perform safe, atomic database transaction to update balances and log records
  const userDocRef = doc(db, "users", userId);
  const flwTxRef = doc(db, "transactions", transactionId);

  try {
    const result = await runTransaction(db, async (transaction) => {
      // Prevent duplicate wallet credits by checking if this transaction ID/ref was already processed
      const txDoc = await transaction.get(flwTxRef);
      if (txDoc.exists()) {
        return {
          duplicate: true,
          message: "Transaction already processed and wallet credited.",
        };
      }

      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists()) {
        throw new Error("Target user profile was not found in Firestore.");
      }

      const userData = userDoc.data();
      const currentBalance = Number(userData.balance) || 0;
      const fundedAmount = Number(amount);

      // Increment atomic balance
      const newBalance = currentBalance + fundedAmount;
      transaction.update(userDocRef, { balance: newBalance });
      console.log(`[wallet credited] USER ID: ${userId}, PREVIOUS BALANCE: ₦${currentBalance}, FUNDING AMOUNT: ₦${fundedAmount}, NEW BALANCE: ₦${newBalance}`);

      // Save transaction record to prevent duplicate processing and establish history audits
      const txRecord = {
        userId,
        amount: fundedAmount,
        currency: currency || "NGN",
        reference: tx_ref,
        flwId: transactionId,
        type: "DEPOSIT",
        description: `Flutterwave Funding Ref: ${tx_ref}`,
        recipientName: customer.name || "Wallet Credit",
        status: "SUCCESS",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        fee: 0.00,
        createdAt: new Date().toISOString(),
      };
      transaction.set(flwTxRef, txRecord);
      console.log(`[transaction saved] ID: ${transactionId}, REFERENCE: ${tx_ref}, RECORD:`, txRecord);

      return {
        duplicate: false,
        newBalance,
        fundedAmount,
      };
    });

    if (result.duplicate) {
      console.log(`[Flutterwave Duplicate Prevention] Reference already credited: ${transactionId}`);
      return {
        success: true,
        message: result.message,
        duplicate: true,
      };
    }

    console.log(`[Flutterwave Verification Completed] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

    return {
      success: true,
      message: "Transaction verified and wallet funded successfully!",
      fundedAmount: result.fundedAmount,
      newBalance: result.newBalance,
    };
  } catch (dbErr: unknown) {
    const errMsg = dbErr instanceof Error ? dbErr.message : String(dbErr);
    console.warn("[Flutterwave API Backend Warning] Firestore rules blocked direct server-side write. Falling back to authenticated client-side execution:", errMsg);
    return {
      success: true,
      fallbackToClient: true,
      userId,
      amount: Number(amount),
      currency: currency || "NGN",
      tx_ref,
      customer
    };
  }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: Transaction ID 'id'." }, { status: 400 });
    }

    const result = await executeVerification(transactionId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Verification Exception] Failed atomic verify operation:", errorMsg);
    return NextResponse.json({ error: "Internal Server Verification Error", details: errorMsg }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { transactionId } = body;

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: 'transactionId'." }, { status: 400 });
    }

    const result = await executeVerification(transactionId);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Verification Exception] Failed POST verify operation:", errorMsg);
    return NextResponse.json({ error: "Internal Server Verification Error", details: errorMsg }, { status: 500 });
  }
}
