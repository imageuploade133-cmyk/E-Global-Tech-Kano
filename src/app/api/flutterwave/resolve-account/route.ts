import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { flutterwaveService } from "@/lib/flutterwave";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 30 requests per minute max to prevent account enumeration abuse
  if (isRateLimited(ip, 30, 60 * 1000)) {
    console.warn(`[Resolve Account Rate Limited] IP: ${ip}`);
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // 1. Authenticate user
  try {
    const authUser = await authenticateUserRequest(req);
    console.log(`[Resolve Account Request] Authenticated User: ${authUser.uid}`);
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bankCode, accountNumber } = body;

    // Validation
    if (!bankCode || !accountNumber) {
      console.warn("[Resolve Account Validation Failure] Missing bankCode or accountNumber");
      return NextResponse.json({ error: "Bank code and account number are required fields." }, { status: 400 });
    }

    console.log(`[Resolve Account Flutterwave Query] Bank Code: ${bankCode}, Acc: ${accountNumber}`);

    // 2. Query Flutterwave
    const resData = await flutterwaveService.verifyBankAccount({
      account_number: accountNumber,
      account_bank: bankCode,
    });

    if (resData.status === "success" && resData.data) {
      console.log(`[Resolve Account Success] Resolved Name: ${resData.data.account_name}`);
      return NextResponse.json({
        success: true,
        accountName: resData.data.account_name,
        accountNumber: resData.data.account_number,
        bankCode: bankCode,
      });
    } else {
      console.warn(`[Resolve Account API Reject] Message: ${resData.message}`);
      return NextResponse.json({ success: false, message: resData.message || "Unable to resolve account." }, { status: 400 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Resolve Account Exception] Process crashed:", error.message);
    return NextResponse.json({ success: false, message: "Could not resolve bank account. Verify details and try again." }, { status: 500 });
  }
}
