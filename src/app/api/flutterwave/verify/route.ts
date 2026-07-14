import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { db } from "@/lib/firebase";
import { doc, runTransaction } from "firebase/firestore";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: Transaction ID 'id'." }, { status: 400 });
    }

    console.log(`[Flutterwave Verification Started] Checking Transaction ID: ${transactionId}`);

    // 1. Verify with Flutterwave's Verify API first before crediting any wallet
    const flwRes = await flutterwaveService.verifyTransaction(transactionId);

    if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
      return NextResponse.json(
        {
          success: false,
          status: flwRes.data?.status || "failed",
          error: "Transaction was not successfully settled on Flutterwave rail.",
        },
        { status: 400 }
      );
    }

    const { amount, currency, tx_ref, customer } = flwRes.data;

    // Retrieve custom user details encoded inside reference or match email
    // Reference format: flw-tx-{userId}-{timestamp}
    const parts = tx_ref.split("-");
    const userId = parts[2] && parts[2] !== "anon" ? parts[2] : null;

    if (!userId) {
      return NextResponse.json(
        { error: "Verification Failed: User ID context not resolved from transaction reference." },
        { status: 400 }
      );
    }

    // 2. Perform safe, atomic database transaction to update balances and log records
    const userDocRef = doc(db, "users", userId);
    const flwTxRef = doc(db, "transactions", transactionId);

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

      // Save transaction record to prevent duplicate processing and establish history audits
      transaction.set(flwTxRef, {
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
      });

      return {
        duplicate: false,
        newBalance,
        fundedAmount,
      };
    });

    if (result.duplicate) {
      console.log(`[Flutterwave Duplicate Prevention] Reference already credited: ${transactionId}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        details: "No double-spending allowed.",
      });
    }

    console.log(`[Flutterwave Verification Completed] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

    return NextResponse.json({
      success: true,
      message: "Transaction verified and wallet funded successfully!",
      fundedAmount: result.fundedAmount,
      newBalance: result.newBalance,
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Verification Exception] Failed atomic verify operation:", errorMsg);
    return NextResponse.json({ error: "Internal Server Verification Error", details: errorMsg }, { status: 500 });
  }
}
