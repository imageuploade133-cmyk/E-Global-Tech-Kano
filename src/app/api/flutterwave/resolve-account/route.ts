import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { BankService } from "@/services/bank-service";
import { isRateLimited } from "@/lib/rate-limiter";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

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

    // STEP 7 - LOG INCOMING
    const maskedAccountNumber = accountNumber && accountNumber.length >= 4
      ? `******${accountNumber.slice(-4)}`
      : "invalid";

    console.log(`[Resolve Account] Incoming Request - User ID: ${uid}, Selected Bank ID: ${bankId}, Account Number: ${maskedAccountNumber}`);

    // STEP 6 - VALIDATION
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

    console.log(`[Resolve Account] Validated Details - Resolved Bank Name: ${bank.name}, Resolved Flutterwave Code: ${bankCode}`);

    // 2. Sandbox/Test Credentials Check: Flutterwave's sandbox only permits resolving Access Bank (044) details.
    // This constraint is imposed by Flutterwave itself on the sandbox environment and is not an application bug.
    const isSandbox = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST-");
    if (isSandbox && bankCode !== "044") {
      console.warn(`[Resolve Account Sandbox Restriction] Attempt to resolve real bank code ${bankCode} ('${bank.name}') in Sandbox blocked.`);
      return NextResponse.json({
        error: "Real bank account resolution is not supported in Flutterwave Sandbox. Please use the documented test accounts or switch to live credentials."
      }, { status: 400 });
    }

    // Call Flutterwave POST /v3/accounts/resolve with custom retry logic (retry twice on network failure, do not retry HTTP 400)
    let flwData: { status?: string; message?: string; data?: { account_name: string; account_number: string } } | null = null;
    const attempts = 3;
    let lastError: Error | null = null;

    for (let i = 1; i <= attempts; i++) {
      try {
        console.log(`[Resolve Account] Outgoing Flutterwave Request (Attempt ${i}/3) for bank code: ${bankCode}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

        const response = await fetch(`${FLW_BASE_URL}/accounts/resolve`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${FLW_SECRET_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_number: accountNumber,
            account_bank: bankCode,
          }),
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 400) {
          // Do not retry HTTP 400 errors as per STEP 8 instructions
          const errRes = await response.json().catch(() => ({}));
          console.warn(`[Resolve Account] Flutterwave rejected with 400 (no retry):`, errRes);
          return NextResponse.json({ error: "Unable to verify account." }, { status: 400 });
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP Error ${response.status}: ${errText}`);
        }

        flwData = await response.json();
        break; // Success! Exit retry loop
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Resolve Account] Attempt ${i} failed:`, lastError.message);
        if (i === attempts) {
          break;
        }
        // Delay before retry (backoff)
        await new Promise((res) => setTimeout(res, i * 1000));
      }
    }

    // STEP 7 - LOG OUTGOING FLUTTERWAVE RESPONSE
    console.log(`[Resolve Account] Flutterwave Response:`, JSON.stringify(flwData ? { status: flwData.status, message: flwData.message, dataExists: !!flwData.data } : { error: lastError?.message }));

    if (flwData && flwData.status === "success" && flwData.data) {
      console.log(`[Resolve Account Success] Resolved Name: ${flwData.data.account_name}`);
      return NextResponse.json({
        success: true,
        accountName: flwData.data.account_name,
        accountNumber: flwData.data.account_number,
        bankCode: bankCode,
      });
    } else {
      console.warn(`[Resolve Account Reject] Unable to verify account.`);
      return NextResponse.json({ error: "Unable to verify account." }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Resolve Account Exception] Process crashed:", error.message);
    return NextResponse.json({ error: "Please try again later." }, { status: 500 });
  }
}
