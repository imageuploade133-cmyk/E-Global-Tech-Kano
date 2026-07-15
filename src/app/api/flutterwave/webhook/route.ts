import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb, hasAdminCredentials } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("verif-hash") || req.headers.get("x-flutterwave-signature");

    console.log(`[webhook received] WEBHOOK REQUEST DETECTED. Signature: ${signature ? "Present" : "Missing"}, Payload Size: ${rawBody.length} bytes`);

    // 1. Verify webhook signatures using FLW_WEBHOOK_SECRET
    const isValid = flutterwaveService.validateWebhookSignature(signature, rawBody);

    if (!isValid) {
      console.warn("[Flutterwave Webhook Error] Invalid signature header check. Rejection triggered.");
      return NextResponse.json({ error: "Invalid cryptographic signature." }, { status: 401 });
    }

    console.log(`[verification successful] Webhook cryptographic signature validated successfully.`);

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    console.log(`[webhook received] Webhook event type: "${event || payload["event.type"]}"`);

    // We only process completed credit operations
    if (event === "charge.completed" && data.status === "successful") {
      const transactionId = String(data.id);
      const { amount, currency, tx_ref, customer } = data;

      // Extract userId from reference: flw-tx-{userId}-{timestamp}
      const parts = tx_ref.split("-");
      const userId = parts[2] && parts[2] !== "anon" ? parts[2] : null;

      if (!userId) {
        console.warn(`[Flutterwave Webhook Warning] User ID could not be matched for tx_ref: ${tx_ref}`);
        return NextResponse.json({ error: "Context user reference unresolved." }, { status: 400 });
      }

      // Prevent background credentials-lookup failure on Vercel
      if (!hasAdminCredentials) {
        console.error("[Firebase Admin Error] Missing service account credentials on Vercel webhook handler. Aborting transaction.");
        return NextResponse.json({ error: "Configuration Error: Firebase Service Account Credentials are not configured on Vercel." }, { status: 500 });
      }

      // Check duplicate inside flutterwave_transactions to prevent double crediting using Admin SDK
      const result = await adminDb.runTransaction(async (transaction) => {
        const flwTxRef = adminDb.collection("flutterwave_transactions").doc(transactionId);
        const flwTxDoc = await transaction.get(flwTxRef);

        if (flwTxDoc.exists) {
          return {
            duplicate: true,
            message: "Duplicate prevented. Webhook already processed this transaction ID.",
          };
        }

        const userDocRef = adminDb.collection("users").doc(userId);
        const userDoc = await transaction.get(userDocRef);
        if (!userDoc.exists) {
          throw new Error("Target user profile was not found in Firestore.");
        }

        const userData = userDoc.data() || {};
        const currentBalance = Number(userData.balance) || 0;
        const fundedAmount = Number(amount);

        const newBalance = currentBalance + fundedAmount;
        transaction.update(userDocRef, { balance: newBalance });
        console.log(`[wallet credited] USER ID: ${userId}, PREVIOUS BALANCE: ₦${currentBalance}, FUNDING AMOUNT: ₦${fundedAmount}, NEW BALANCE: ₦${newBalance}`);

        // Mark payment processed inside flutterwave_transactions
        transaction.set(flwTxRef, {
          userId,
          amount: fundedAmount,
          currency,
          reference: tx_ref,
          flwId: transactionId,
          status: "SUCCESSFUL",
          processedAt: new Date().toISOString(),
        });

        // Save ledger histories
        const ledgerRef = adminDb.collection("transactions").doc();
        const txRecord = {
          userId,
          amount: fundedAmount,
          currency: currency || "NGN",
          reference: tx_ref,
          flwId: transactionId,
          type: "DEPOSIT",
          description: `Flutterwave Webhook: ${tx_ref}`,
          recipientName: customer.name || "Webhook Fund",
          status: "SUCCESS",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          fee: 0.00,
          createdAt: new Date().toISOString(),
        };
        transaction.set(ledgerRef, txRecord);
        console.log(`[transaction saved] ID: ${transactionId}, REFERENCE: ${tx_ref}, RECORD:`, txRecord);

        return {
          duplicate: false,
          newBalance,
        };
      });

      if (result.duplicate) {
        console.log(`[Flutterwave Webhook Duplicate Blocked] Trans ID: ${transactionId}`);
        return NextResponse.json({ success: true, message: result.message });
      }

      console.log(`[Flutterwave Webhook Success] Atomic credit complete. User: ${userId}, Balance: ₦${result.newBalance}`);
    }

    // Always acknowledge the webhook event with HTTP 200
    return NextResponse.json({ success: true, message: "Webhook acknowledged." }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Webhook Exception] Processing crash occurred:", errorMsg);
    return NextResponse.json({ error: "Webhook Server Error", details: errorMsg }, { status: 500 });
  }
}
