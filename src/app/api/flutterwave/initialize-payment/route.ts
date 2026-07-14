import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";

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

    // Build standard, traceable unique references
    const tx_ref = `flw-tx-${userId || "anon"}-${Date.now()}`;

    console.log(`[payment initialization] INITIALIZATION REQUEST:`, {
      amount: Number(amount),
      currency: currency || "NGN",
      email,
      name,
      phone,
      userId: userId || "anon",
      tx_ref,
      redirect_url: redirectUrl || "https://e-global-tech-kano.vercel.app/history"
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
