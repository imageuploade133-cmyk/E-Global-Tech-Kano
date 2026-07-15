import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { verifyAndCreditWallet } from "@/lib/wallet-funding";
import { logPaymentEvent } from "@/lib/payment-logger";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const startTime = Date.now();
  let transactionId = "N/A";
  let tx_ref = "N/A";

  // Rate limiting protection
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  if (isRateLimited(ip, 60, 60 * 1000)) { // 60 requests per minute for webhooks (more generous)
    console.warn(`[Rate Limited] Webhook IP blocked: ${ip}`);
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("verif-hash") || req.headers.get("x-flutterwave-signature");

    console.log(`[Webhook Received] Webhook request detected. Signature: ${signature ? "Present" : "Missing"}, Payload Size: ${rawBody.length} bytes`);

    // 1. Verify webhook signature using FLW_WEBHOOK_SECRET
    const isValid = flutterwaveService.validateWebhookSignature(signature, rawBody);
    console.log(`[Webhook Signature Validation Result] Webhook signature validation result: ${isValid}`);

    if (!isValid) {
      console.warn("[Flutterwave Webhook Error] Invalid signature header check. Rejection triggered.");
      logPaymentEvent({
        category: "Webhook Signature Failure",
        message: "Cryptographic signature validation failed on webhook raw body.",
        processingTimeMs: Date.now() - startTime,
      });
      return NextResponse.json({ error: "Invalid cryptographic signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    logPaymentEvent({
      category: "Webhook Received",
      transactionId: data?.id ? String(data.id) : undefined,
      tx_ref: data?.tx_ref,
      amount: data?.amount ? Number(data.amount) : undefined,
      currency: data?.currency,
      message: `Webhook event received: ${event}`,
      processingTimeMs: Date.now() - startTime,
    });

    console.log(`[Webhook Event] Webhook event type: "${event || payload["event.type"]}"`);

    // We only process completed credit operations
    if (event === "charge.completed" && data.status === "successful") {
      transactionId = String(data.id);
      tx_ref = data.tx_ref;

      console.log(`[Webhook Processing] Transaction ID: ${transactionId}, tx_ref: ${tx_ref}`);

      // Call the exact same reusable backend verification logic
      console.log(`[Webhook Verification Result] Passing transaction to verifyAndCreditWallet...`);
      const result = await verifyAndCreditWallet(transactionId);
      console.log(`[Webhook Wallet Funding Result] Wallet funding result:`, result);

      if (result.duplicate) {
        console.log(`[Webhook Duplicate Detection] Webhook duplicate detected: ${transactionId}`);
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: "Transaction already processed."
        }, { status: 200 }); // never return 500 for duplicates!
      }

      if (!result.success) {
        console.error(`[Webhook Verification Error] Failed to fund: ${result.message}`);
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
    } else {
      console.log(`[Webhook Ignored] Ignored event type or status: ${event} / ${data?.status}`);
    }

    // Always acknowledge the webhook event with HTTP 200
    return NextResponse.json({ success: true, message: "Webhook acknowledged." }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Webhook Exception] Processing crash occurred:", errorMsg);

    logPaymentEvent({
      category: "Internal Error",
      transactionId,
      tx_ref,
      message: `Exception in webhook route handler: ${errorMsg}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({ error: "Webhook Server Error" }, { status: 500 });
  }
}
