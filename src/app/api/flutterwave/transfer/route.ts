import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { bankCode, accountNumber, amount, narration, currency, userId } = body;

    // Validate parameters
    if (!bankCode || !accountNumber || !userId) {
      return NextResponse.json({ error: "Missing required bank codes, account numbers, or user reference parameters." }, { status: 400 });
    }
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid transfer amount." }, { status: 400 });
    }

    const transferAmount = Number(amount);
    const transferCurrency = currency || "NGN";
    const ref_id = `flw-trf-${userId}-${Date.now()}`;

    console.log(`[Flutterwave Transfer Initiated] User: ${userId}, Amount: ${transferAmount}, Ref: ${ref_id}`);

    const userDocRef = adminDb.collection("users").doc(userId);
    const trfRef = adminDb.collection("transactions").doc(ref_id);

    // Perform atomic transaction to verify sufficient balance and debit user BEFORE calling Flutterwave
    const result = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userDocRef);
      if (!userDoc.exists) {
        throw new Error("Target user profile was not found in Firestore.");
      }

      const userData = userDoc.data() || {};
      const currentBalance = Number(userData.balance) || 0;

      if (currentBalance < transferAmount) {
        return {
          success: false,
          error: "Insufficient wallet funds to complete outward transfer.",
          currentBalance,
        };
      }

      // Debit atomic wallet balance
      const newBalance = currentBalance - transferAmount;
      transaction.update(userDocRef, { balance: newBalance });

      // Create a pending outward ledger transaction record
      transaction.set(trfRef, {
        userId,
        amount: transferAmount,
        currency: transferCurrency,
        reference: ref_id,
        type: "TRANSFER",
        description: narration || `Outward Settlement to ${accountNumber}`,
        recipientName: `Acc: ${accountNumber} (Pending)`,
        status: "PENDING",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        fee: 10.00, // standard transfer fee
        createdAt: new Date().toISOString(),
      });

      return {
        success: true,
        newBalance,
      };
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error, currentBalance: result.currentBalance }, { status: 400 });
    }

    // Call Flutterwave to perform transfer
    try {
      const flwRes = await flutterwaveService.initiateTransfer({
        account_bank: bankCode,
        account_number: accountNumber,
        amount: transferAmount,
        narration: narration || "E-Tech Outward Transfer",
        currency: transferCurrency,
        reference: ref_id,
      });

      if (flwRes.status === "success") {
        // Update transaction status to SUCCESS upon verification response
        await adminDb.runTransaction(async (transaction) => {
          transaction.update(trfRef, {
            status: "SUCCESS",
            recipientName: flwRes.data.full_name || `Acc: ${accountNumber}`,
          });
        });

        console.log(`[Flutterwave Transfer Completed] Successfully settled! Ref: ${ref_id}, User: ${userId}`);

        return NextResponse.json({
          success: true,
          message: "Transfer initiated successfully!",
          newBalance: result.newBalance,
          refId: ref_id,
        });
      } else {
        // Fallback: If Flutterwave fails, refund the user balance and fail the ledger record
        await adminDb.runTransaction(async (transaction) => {
          const userDoc = await transaction.get(userDocRef);
          if (userDoc.exists) {
            const currentBal = Number(userDoc.data()?.balance) || 0;
            transaction.update(userDocRef, { balance: currentBal + transferAmount });
          }
          transaction.update(trfRef, { status: "FAILED", description: `FAILED: ${flwRes.message}` });
        });

        console.warn(`[Flutterwave Transfer Failed] API rejected: ${flwRes.message}. Refund processed.`);
        return NextResponse.json({ error: "Transfer processing failed", details: flwRes.message }, { status: 500 });
      }
    } catch (err: unknown) {
      // Refund user balance and fail ledger in case of network timeout / crash
      const errorMsg = err instanceof Error ? err.message : String(err);
      await adminDb.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userDocRef);
        if (userDoc.exists) {
          const currentBal = Number(userDoc.data()?.balance) || 0;
          transaction.update(userDocRef, { balance: currentBal + transferAmount });
        }
        transaction.update(trfRef, { status: "FAILED", description: `FAILED: API error: ${errorMsg}` });
      });

      console.error("[Flutterwave Transfer Crash] Refunded. Endpoint failure details:", errorMsg);
      return NextResponse.json({ error: "Internal Server Error during transfer", details: errorMsg }, { status: 500 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Transfer Exception] General crash:", errorMsg);
    return NextResponse.json({ error: "Internal Server Error", details: errorMsg }, { status: 500 });
  }
}
