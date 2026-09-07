import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function POST(req: Request) {
  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { amount, currency, email, fullName, redirectUrl } = body;

    if (!amount || Number(amount) < 100) {
      return NextResponse.json({ error: "Minimum allowed amount is ₦100.00" }, { status: 400 });
    }

    const tx_ref = `flw-tx-${uid}-${Date.now()}`;
    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const res = await fetch(`${gatewayUrl}/api/flutterwave/card-charge`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        tx_ref,
        amount: Number(amount),
        currency: currency || "NGN",
        email: email || "customer@eglobal.com",
        fullName: fullName || "E-Global Customer",
        redirectUrl: redirectUrl || `${req.headers.get("origin") || "http://localhost:3000"}/?verify=flw`,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success && (data.link || data.paymentLink)) {
      return NextResponse.json({
        success: true,
        link: data.link || data.paymentLink,
        tx_ref,
      });
    }

    return NextResponse.json(
      { error: data.error || data.message || "Failed to initialize card payment link." },
      { status: res.status || 400 }
    );
  } catch (err: any) {
    console.error("[Card Charge API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to communicate with card charge gateway." },
      { status: 500 }
    );
  }
}
