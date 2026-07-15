import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { amount, currency, email, name, phone, redirectUrl, userId } = body;

    // Validate inputs
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid payment amount." }, { status: 400 });
    }
    if (!email || !name) {
      return NextResponse.json({ error: "Customer name and email are required parameters." }, { status: 400 });
    }

    const targetUserId = userId || "anon";

    // Build standard, traceable unique references
    const tx_ref = `flw-tx-${targetUserId}-${Date.now()}`;

    console.log(`[payment initialization] INITIALIZATION REQUEST:`, {
      amount: Number(amount),
      currency: currency || "NGN",
      email,
      name,
      phone,
      userId: targetUserId,
      tx_ref,
      redirect_url: redirectUrl || "https://e-global-tech-kano.vercel.app/history"
    });

    // Create a server-managed pending payment record in Firestore
    console.log(`[payment initialization] Creating pending payment record: pending_payments/${tx_ref}`);
    await adminDb.collection("pending_payments").doc(tx_ref).set({
      userId: targetUserId,
      amount: Number(amount),
      currency: currency || "NGN",
      status: "pending",
      createdAt: new Date().toISOString(),
    });

    const resData = await flutterwaveService.initializePayment({
      tx_ref,
      amount: Number(amount),
      currency: currency || "NGN",
      redirect_url: redirectUrl || "https://e-global-tech-kano.vercel.app/history",
      customer: {
        email,
        name,
        phone_number: phone,
      },
      customizations: {
        title: "E-Tech Global Wallet Fund",
        description: "Wallet Provisioning Settlement Link",
        logo: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
      },
    });

    if (resData.status === "success") {
      return NextResponse.json({
        success: true,
        paymentLink: resData.data.link,
        txRef: tx_ref,
      });
    } else {
      // Clean up the pending payment record if Flutterwave initialization failed
      await adminDb.collection("pending_payments").doc(tx_ref).delete().catch(() => {});
      return NextResponse.json(
        { error: "Payment Link Initialization failed", details: resData.message },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Init Error] Endpoint failure:", errorMsg);
    return NextResponse.json({ error: "Internal Server Error", details: errorMsg }, { status: 500 });
  }
}
