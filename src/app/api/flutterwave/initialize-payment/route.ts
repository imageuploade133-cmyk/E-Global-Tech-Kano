import { NextResponse } from "next/server";
import { PaymentGatewayManager } from "@/lib/payment/PaymentGatewayManager";
import { adminDb } from "@/lib/firebase-admin";
import { logPaymentEvent } from "@/lib/payment-logger";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const startTime = Date.now();
  let targetUserId = "anon";
  let tx_ref = "";
  let amountVal = 0;
  let currencyVal = "NGN";

  // Rate limiting protection
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";
  if (isRateLimited(ip, 30, 60 * 1000)) { // 30 requests per minute
    console.warn(`[Rate Limited] IP blocked: ${ip}`);
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const body = await req.json();
    const { amount, currency, email, name, phone, redirectUrl, userId } = body;

    amountVal = Number(amount);
    currencyVal = currency || "NGN";
    targetUserId = userId || "anon";

    // Validate inputs
    if (!amount || isNaN(amountVal) || amountVal <= 0) {
      logPaymentEvent({
        category: "Internal Error",
        userId: targetUserId,
        currency: currencyVal,
        message: "Invalid payment amount initialization rejected.",
        processingTimeMs: Date.now() - startTime,
      });
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: "Customer name and email are required parameters." }, { status: 400 });
    }

    // Call dynamic PaymentGatewayManager to initialize payment (supports dynamic country-currency routing and failovers)
    const resData = await PaymentGatewayManager.initializePayment({
      amount: amountVal,
      currency: currencyVal,
      email,
      name,
      userId: targetUserId,
      redirectUrl: redirectUrl || "https://e-global-tech-kano.vercel.app/history",
      phone,
    });

    tx_ref = resData.reference;

    if (resData.success) {
      // Create a server-managed pending payment record in Firestore
      console.log(`[Payment Initialization] Creating pending payment record: pending_payments/${tx_ref}`);
      await adminDb.collection("pending_payments").doc(tx_ref).set({
        userId: targetUserId,
        amount: amountVal,
        currency: currencyVal,
        status: "pending",
        createdAt: new Date().toISOString(),
      });

      logPaymentEvent({
        category: "Payment Initialization",
        userId: targetUserId,
        tx_ref,
        amount: amountVal,
        currency: currencyVal,
        message: "Payment successfully initialized and checkout link generated.",
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        paymentLink: resData.paymentLink,
        txRef: tx_ref,
      });
    } else {
      logPaymentEvent({
        category: "Internal Error",
        userId: targetUserId,
        tx_ref,
        amount: amountVal,
        currency: currencyVal,
        message: `Payment initialization failed: ${resData.error}`,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json(
        { error: "Payment Link Initialization failed", details: resData.error },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Payment Init Error] Endpoint failure:", errorMsg);

    logPaymentEvent({
      category: "Internal Error",
      userId: targetUserId,
      tx_ref,
      amount: amountVal,
      currency: currencyVal,
      message: `Exception during payment initialization: ${errorMsg}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
