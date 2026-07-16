import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { VirtualAccountService } from "@/services/virtual-account-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 10 account creation calls per minute max
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  let uid = "";
  let emailFallback = "";
  let nameFallback = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
    emailFallback = authResult.email || "";
    nameFallback = authResult.name || "";
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authentication token." }, { status: 401 });
  }

  try {
    console.log(`[Permanent Account API] Triggered for user: ${uid} (Fallback Email: ${emailFallback}, Fallback Name: ${nameFallback})`);

    // Call virtual account service to resolve existing or register a new one idempotently
    const account = await VirtualAccountService.getOrCreateVirtualAccount(uid, emailFallback, nameFallback);

    return NextResponse.json({
      success: true,
      account: {
        bankName: account.bankName,
        accountNumber: account.accountNumber,
        accountName: account.accountName,
        currency: account.currency,
        reference: account.txRef,
        isPermanent: account.isPermanent,
        status: account.status,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Permanent Account API Error] Failed for ${uid}:`, error.message, error.stack);

    return NextResponse.json(
      { error: error.message || "Failed to create or retrieve your permanent virtual account." },
      { status: 500 }
    );
  }
}
