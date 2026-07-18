import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { BankService } from "@/services/bank-service";
import { PaymentGatewayManager } from "@/lib/payment/PaymentGatewayManager";
import { isRateLimited } from "@/lib/rate-limiter";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 30 requests per minute max to prevent account enumeration abuse
  if (isRateLimited(ip, 30, 60 * 1000)) {
    console.warn(`[Resolve Account Rate Limited] IP: ${ip}`);
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  // 1. Authenticate user
  let uid = "anonymous";
  try {
    const authUser = await authenticateUserRequest(req);
    uid = authUser.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { bankId, accountNumber } = body;

    const maskedAccountNumber = accountNumber && accountNumber.length >= 4
      ? `******${accountNumber.slice(-4)}`
      : "invalid";

    console.log(`[Resolve Account] Incoming Request - User ID: ${uid}, Selected Bank ID: ${bankId}, Account Number: ${maskedAccountNumber}`);

    // VALIDATION
    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
      console.warn(`[Resolve Account Validation Failure] Invalid account number format: ${maskedAccountNumber}`);
      return NextResponse.json({ error: "Invalid account number." }, { status: 400 });
    }

    if (!bankId) {
      console.warn("[Resolve Account Validation Failure] Missing bankId");
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    // Load bank from Firestore
    const bank = await BankService.getBankById(bankId);
    if (!bank) {
      console.warn(`[Resolve Account Validation Failure] Bank not found in Firestore for ID: ${bankId}`);
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    const bankCode = bank.code;
    if (!bankCode || !/^\d+$/.test(bankCode)) {
      console.warn(`[Resolve Account Validation Failure] Bank ${bank.name} has invalid/non-numeric Flutterwave code: ${bankCode}`);
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    console.log(`[Resolve Account] Validated Details - Resolved Bank Name: ${bank.name}, Resolved Code: ${bankCode}`);

    // Sandbox/Test Credentials Check: Fallback for test key
    const isSandbox = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST-");
    if (isSandbox && bankCode !== "044") {
      console.warn(`[Resolve Account Sandbox Restriction] Attempt to resolve real bank code ${bankCode} ('${bank.name}') in Sandbox blocked.`);
      return NextResponse.json({
        error: "Real bank account resolution is not supported in Flutterwave Sandbox. Please use the documented test accounts or switch to live credentials."
      }, { status: 400 });
    }

    // Call dynamic account resolution through PaymentGatewayManager
    const res = await PaymentGatewayManager.resolveAccount({
      bankId,
      accountNumber,
    });

    if (res.success) {
      return NextResponse.json({
        success: true,
        accountName: res.accountName,
        accountNumber: accountNumber,
        bankCode: bankCode,
      });
    } else {
      console.warn(`[Resolve Account Reject] Unable to verify account.`);
      return NextResponse.json({ error: res.error || "Unable to verify account." }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Resolve Account Exception] Process crashed:", error.message);
    return NextResponse.json({ error: "Please try again later." }, { status: 500 });
  }
}
