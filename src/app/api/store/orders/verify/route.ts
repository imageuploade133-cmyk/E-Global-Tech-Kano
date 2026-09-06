import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const orderId = url.searchParams.get("orderId");
    const transactionId = url.searchParams.get("transaction_id") || url.searchParams.get("tx_id");
    const status = url.searchParams.get("status");

    if (!orderId) {
      return NextResponse.redirect(new URL("/store?error=Missing order ID", req.url));
    }

    const orderRef = adminDb.collection("store_orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.redirect(new URL("/store?error=Order not found", req.url));
    }

    const orderData = orderSnap.data();

    // If order is already paid, redirect safely
    if (orderData?.paymentStatus === "PAID" && orderData?.status !== "Pending Payment") {
      return NextResponse.redirect(new URL(`/store?orderSuccess=${orderId}`, req.url));
    }

    // Resolve Flutterwave Secret Key
    let flutterwaveSecretKey = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || "";
    if (!flutterwaveSecretKey) {
      try {
        const configDoc = await adminDb.collection("config").doc("app_config").get();
        if (configDoc.exists) {
          const cfg = configDoc.data() || {};
          flutterwaveSecretKey = cfg.flutterwaveSecretKey || cfg.flwSecretKey || cfg.flw_secret_key || "";
        }
      } catch (err: any) {
        console.warn("[Store Order Verify] Flutterwave config lookup warning:", err.message);
      }
    }

    let isVerified = false;
    let flwTxRef = "";

    if (transactionId && flutterwaveSecretKey) {
      try {
        const verifyRes = await fetch(`https://api.flutterwave.com/v3/transactions/${transactionId}/verify`, {
          headers: {
            Authorization: `Bearer ${flutterwaveSecretKey}`,
          },
        });
        const verifyData = await verifyRes.json();

        if (
          verifyRes.ok &&
          verifyData.status === "success" &&
          verifyData.data?.status === "successful" &&
          Number(verifyData.data?.amount) >= Number(orderData?.totalAmount || 0)
        ) {
          isVerified = true;
          flwTxRef = verifyData.data?.tx_ref || transactionId;
        }
      } catch (err: any) {
        console.error("[Store Order Verify] Flutterwave transaction verification exception:", err.message);
      }
    }

    const now = new Date().toISOString();

    if (isVerified) {
      // Payment Verified: Mark order as PAID and status as Pending (Fulfillment Pending)
      await orderRef.update({
        status: "Pending", // Pending Fulfillment by Admin in CPanel
        paymentStatus: "PAID",
        paymentVerificationRef: flwTxRef || `FLW-VERIFIED-${Date.now()}`,
        updatedAt: now,
      });

      return NextResponse.redirect(new URL(`/store?orderSuccess=${orderId}`, req.url));
    } else {
      // Payment Failed or Cancelled: Keep as Payment Failed and do NOT complete order
      await orderRef.update({
        status: "Payment Failed",
        paymentStatus: "FAILED",
        updatedAt: now,
      });

      return NextResponse.redirect(new URL(`/store?orderError=Payment was not completed or failed.`, req.url));
    }
  } catch (err: any) {
    console.error("[Store Order Verify GET Exception]:", err.message);
    return NextResponse.redirect(new URL("/store?error=Verification failed", req.url));
  }
}
