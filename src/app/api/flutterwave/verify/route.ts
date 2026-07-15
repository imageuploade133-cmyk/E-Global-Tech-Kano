import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function POST(req: Request) {
  let transactionId = "";
  try {
    const body = await req.json();
    transactionId = body.transactionId;

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: 'transactionId'." }, { status: 400 });
    }

    console.log(`[Payment verification started] Verification query triggered for Transaction ID: ${transactionId}`);

    // 1. Verify with Flutterwave's Verify API first before crediting any wallet
    const flwRes = await flutterwaveService.verifyTransaction(transactionId);

    // Validate payment status
    if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
      console.warn(`[verification failed] Flutterwave status check was negative:`, flwRes);
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

    // Validate payment amount before crediting
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid payment amount. Validation failed." }, { status: 400 });
    }

    // Validate currency before crediting
    if (currency !== "NGN" && currency !== "USD") {
      return NextResponse.json({ error: `Unsupported transaction currency: ${currency}` }, { status: 400 });
    }

    // Validate transaction reference format
    if (!tx_ref || !tx_ref.startsWith("flw-tx-")) {
      return NextResponse.json({ error: "Invalid transaction reference prefix." }, { status: 400 });
    }

    console.log(`[Payment verified] Flutterwave returned success status for ID: ${transactionId}. Ref: ${tx_ref}, Amount: ${amount}, Currency: ${currency}`);

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

    // Prevent background credential lookup crashes on Vercel by verifying presence of credentials first
    const { hasAdminCredentials } = await import("@/lib/firebase-admin");
    if (!hasAdminCredentials) {
      console.error("[Firebase Admin Error] Missing service account credentials. Aborting transaction to prevent Vercel crash.");
      return NextResponse.json({
        error: "Configuration Error: Firebase Service Account Credentials are not configured on Vercel.",
        details: "To securely credit wallet balances on the backend, please generate a Firebase Service Account private key JSON in your Firebase Console (Project Settings -> Service Accounts), and add it as the FIREBASE_SERVICE_ACCOUNT_KEY environment variable in your Vercel project settings."
      }, { status: 500 });
    }

    console.log(`[Firestore transaction started] Running atomic transaction to check duplicates and credit balance.`);

    let currentOperation = "";
    let currentDocPath = "";

    // 2. Perform safe, atomic database transaction to update balances and log records using Firebase Admin SDK
    const result = await adminDb.runTransaction(async (transaction) => {
      try {
        // Check if duplicate already processed inside flutterwave_transactions collection
        const flwTxRef = adminDb.collection("flutterwave_transactions").doc(transactionId);

        currentOperation = "Reading transaction record";
        currentDocPath = `flutterwave_transactions/${transactionId}`;
        console.log("Reading transaction record...");
        const flwTxDoc = await transaction.get(flwTxRef);

        if (flwTxDoc.exists) {
          return {
            duplicate: true,
            message: "Already processed",
          };
        }

        const userDocRef = adminDb.collection("users").doc(userId);

        currentOperation = "Reading user";
        currentDocPath = `users/${userId}`;
        console.log("Reading user...");
        const userDoc = await transaction.get(userDocRef);

        if (!userDoc.exists) {
          throw new Error("Target user profile was not found in Firestore.");
        }

        const userData = userDoc.data();
        const currentBalance = Number(userData?.balance) || 0;
        const fundedAmount = Number(amount);
        const newBalance = currentBalance + fundedAmount;

        // Increment atomic balance using FieldValue.increment
        currentOperation = "Updating wallet";
        currentDocPath = `users/${userId}`;
        console.log("Updating wallet...");
        transaction.update(userDocRef, { balance: FieldValue.increment(fundedAmount) });
        console.log(`[Wallet credited] USER ID: ${userId}, PREVIOUS BALANCE: ₦${currentBalance}, FUNDING AMOUNT: ₦${fundedAmount}, NEW ESTIMATED BALANCE: ₦${newBalance}`);

        // Create document in flutterwave_transactions to prevent duplicates
        currentOperation = "Creating flutterwave transaction";
        currentDocPath = `flutterwave_transactions/${transactionId}`;
        console.log("Creating flutterwave transaction...");
        transaction.set(flwTxRef, {
          userId,
          amount: fundedAmount,
          currency,
          reference: tx_ref,
          flwId: transactionId,
          status: "SUCCESSFUL",
          processedAt: new Date().toISOString(),
        });

        // Save transaction record inside transactions collection for general ledger logging
        const ledgerRef = adminDb.collection("transactions").doc(`tx-${transactionId}`);
        currentOperation = "Creating ledger entry";
        currentDocPath = `transactions/tx-${transactionId}`;
        console.log("Creating ledger entry...");
        const txRecord = {
          userId,
          amount: fundedAmount,
          currency: currency || "NGN",
          reference: tx_ref,
          flwId: transactionId,
          type: "DEPOSIT",
          description: `Flutterwave Funding Ref: ${tx_ref}`,
          recipientName: customer?.name || "Wallet Credit",
          status: "SUCCESS",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          fee: 0.00,
          createdAt: new Date().toISOString(),
        };
        transaction.set(ledgerRef, txRecord);
        console.log(`[Transaction recorded] Ledger history entry recorded successfully.`);

        // Log committing message before transaction completes/commits
        currentOperation = "Committing transaction";
        currentDocPath = "N/A";
        console.log("Committing transaction...");

        return {
          duplicate: false,
          newBalance,
          fundedAmount,
        };
      } catch (innerError: unknown) {
        const error = innerError as Error & { code?: string };
        console.error(`[Firestore Operation Error] Failed during operation: "${currentOperation}" on document: "${currentDocPath}"`);
        console.error(`Error Code: ${error.code || "N/A"}`);
        console.error(`Error Stack:`, error.stack);
        throw innerError; // rethrow to abort the transaction
      }
    });

    if (result.duplicate) {
      console.log(`[Duplicate prevented] Reference already credited: ${transactionId}`);
      return NextResponse.json({
        success: true,
        message: result.message,
        details: "No double-spending allowed.",
      });
    }

    console.log(`[Transaction committed] Firestore atomic updates successfully committed.`);
    console.log(`[Verification complete] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

    return NextResponse.json({
      success: true,
      message: "Transaction verified and wallet funded successfully!",
      fundedAmount: result.fundedAmount,
      newBalance: result.newBalance,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Verification Error Failed] ID: ${transactionId || "N/A"} Error Details:`, error.message, error.stack);
    return NextResponse.json({ error: "Internal Server Verification Error", details: error.message }, { status: 500 });
  }
}

// Keep GET for backwards compatibility / web redirect checks
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: Transaction ID 'id'." }, { status: 400 });
    }

    // Call identical logic
    const response = await fetch(`${new URL(req.url).origin}/api/flutterwave/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId }),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Flutterwave Verification Exception] Failed GET verify operation:", error.message, error.stack);
    return NextResponse.json({ error: "Internal Server Verification Error", details: error.message }, { status: 500 });
  }
}
