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
    const accountNumber = body.accountNumber || body.account_number;
    const bankCode = body.bankCode || body.account_bank || body.bank_code;

    if (!accountNumber || String(accountNumber).length !== 10) {
      return NextResponse.json({ error: "Please enter a valid 10-digit account number." }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const res = await fetch(`${gatewayUrl}/api/flutterwave/account-resolve`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        accountNumber,
        account_number: accountNumber,
        bankCode,
        account_bank: bankCode,
      }),
    });

    const data = await res.json();
    if (res.ok && data.success) {
      const account_name = data.account_name || data.accountName || data.data?.account_name || data.data?.accountName;
      return NextResponse.json({
        success: true,
        account_name,
        accountName: account_name,
        bank_name: data.bank_name || data.bankName,
        bank_code: bankCode,
      });
    }

    return NextResponse.json(
      { error: data.error || data.message || "Failed to resolve account details." },
      { status: res.status || 400 }
    );
  } catch (err: any) {
    console.error("[Account Resolve API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to communicate with account resolution service." },
      { status: 500 }
    );
  }
}
