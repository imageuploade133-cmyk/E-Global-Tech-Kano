import { NextResponse } from "next/server";
import { PaymentGatewayManager } from "@/lib/payment/PaymentGatewayManager";
import { verifyAndCreditWallet } from "@/lib/wallet-funding";
import { logPaymentEvent } from "@/lib/payment-logger";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const startTime = Date.now();
  let transactionId = "N/A";
  let tx_ref = "N/A";

  // Rate limiting protection
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  if (isRateLimited(ip, 60, 60 * 1000)) {
    console.warn(`[Rate Limited] Webhook IP blocked: ${ip}`);
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((val, key) => {
      headers[key] = val;
    });

    const signature = headers["verif-hash"] || headers["x-flutterwave-signature"] || headers["x-paystack-signature"];

    console.log(`[Webhook Received] Webhook request detected. Signature: ${signature ? "Present" : "Missing"}, Payload Size: ${rawBody.length} bytes`);

    // Verify which gateway sent this webhook dynamically
    let verifiedGateway = null;
    const providers = PaymentGatewayManager.getProviders();

    for (const p of providers) {
      const isValid = await p.verifyWebhook(headers, rawBody);
      if (isValid) {
        verifiedGateway = p;
        break;
      }
    }

    if (!verifiedGateway) {
      console.warn("[Payment Webhook Error] Webhook signature validation failed on all providers.");
      logPaymentEvent({
        category: "Webhook Signature Failure",
        message: "Cryptographic signature validation failed on webhook raw body across all configurations.",
        processingTimeMs: Date.now() - startTime,
      });
      return NextResponse.json({ error: "Invalid cryptographic signature." }, { status: 401 });
    }

    console.log(`[Webhook Verified] Successfully authenticated webhook from gateway: [${verifiedGateway.name}]`);

    const payload = JSON.parse(rawBody);
    let eventName = payload.event || payload.event_type || "";
    let data = payload.data || {};

    // Standardize Paystack payloads into Flutterwave structure for single verify helper
    if (verifiedGateway.name === "paystack") {
      eventName = payload.event === "charge.success" ? "charge.completed" : payload.event;
      data = {
        id: payload.data?.reference || payload.data?.id,
        tx_ref: payload.data?.reference,
        status: payload.data?.status === "success" ? "successful" : payload.data?.status,
        amount: payload.data?.amount ? payload.data.amount / 100 : 0,
        currency: payload.data?.currency,
      };
    }

    logPaymentEvent({
      category: "Webhook Received",
      transactionId: data?.id ? String(data.id) : undefined,
      tx_ref: data?.tx_ref,
      amount: data?.amount ? Number(data.amount) : undefined,
      currency: data?.currency,
      message: `Webhook event verified: ${eventName} via gateway [${verifiedGateway.name}]`,
      processingTimeMs: Date.now() - startTime,
    });

    if (eventName === "charge.completed" && data.status === "successful") {
      transactionId = String(data.id);
      tx_ref = data.tx_ref;

      console.log(`[Webhook Processing] Transaction ID: ${transactionId}, tx_ref: ${tx_ref}`);

      const result = await verifyAndCreditWallet(transactionId);
      console.log(`[Webhook Wallet Funding Result] Wallet funding result:`, result);

      if (result.duplicate) {
        console.log(`[Webhook Duplicate Detection] Webhook duplicate detected: ${transactionId}`);
        return NextResponse.json({
          success: true,
          duplicate: true,
          message: "Transaction already processed."
        }, { status: 200 });
      }

      if (!result.success) {
        console.error(`[Webhook Verification Error] Failed to fund: ${result.message}`);
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, message: "Webhook acknowledged." }, { status: 200 });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Webhook Exception] Processing crash occurred:", errorMsg);

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
