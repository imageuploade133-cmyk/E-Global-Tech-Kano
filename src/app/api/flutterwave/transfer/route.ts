import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb, hasAdminCredentials } from "@/lib/firebase-admin";
import { WalletService } from "@/lib/wallet-service";

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

    // Prevent background credentials-lookup failure on Vercel
    if (!hasAdminCredentials) {
      console.error("[Firebase Admin Error] Missing service account credentials. Aborting transaction to prevent Vercel crash.");
      return NextResponse.json({
        error: "Configuration Error: Firebase Service Account Credentials are not configured on Vercel.",
        details: "To securely debit wallet balances on the backend, please generate a Firebase Service Account private key JSON in your Firebase Console (Project Settings -> Service Accounts), and add it as the FIREBASE_SERVICE_ACCOUNT_KEY environment variable in your Vercel project settings."
      }, { status: 500 });
    }

    const trfRef = adminDb.collection("transactions").doc(`tx-${ref_id}`);

    // Perform atomic transaction to verify sufficient balance and debit user BEFORE calling Flutterwave
    const result = await adminDb.runTransaction(async (transaction) => {
      try {
        const debitRes = await WalletService.debitWallet(transaction, {
          userId,
          amount: transferAmount,
          currency: transferCurrency,
          reference: ref_id,
          docId: `tx-${ref_id}`,
          type: "TRANSFER",
          description: narration || `Outward Settlement to ${accountNumber}`,
          recipientName: `Acc: ${accountNumber} (Pending)`,
          fee: 10.00, // standard transfer fee
          isPending: true, // starts as PENDING until confirmed by FLW
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

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
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
          await WalletService.creditWallet(transaction, {
            userId,
            amount: transferAmount,
            currency: transferCurrency,
            reference: `${ref_id}-refund`,
            docId: `tx-${ref_id}-refund`,
            description: `Refund: Outward transfer failed: ${flwRes.message}`,
            recipientName: "System Refund",
          });
          transaction.update(trfRef, { status: "FAILED", description: `FAILED: ${flwRes.message}` });
        });

        console.warn(`[Flutterwave Transfer Failed] API rejected: ${flwRes.message}. Refund processed.`);
        return NextResponse.json({ error: "Transfer processing failed", details: flwRes.message }, { status: 500 });
      }
    } catch (err: unknown) {
      // Refund user balance and fail ledger in case of network timeout / crash
      const errorMsg = err instanceof Error ? err.message : String(err);
      await adminDb.runTransaction(async (transaction) => {
        await WalletService.creditWallet(transaction, {
          userId,
          amount: transferAmount,
          currency: transferCurrency,
          reference: `${ref_id}-refund`,
          docId: `tx-${ref_id}-refund`,
          description: `Refund: Outward transfer error: ${errorMsg}`,
          recipientName: "System Refund",
        });
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
