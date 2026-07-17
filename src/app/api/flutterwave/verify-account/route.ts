import { NextResponse } from "next/server";
import { BankService } from "@/services/bank-service";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountNumber, bankId } = body;

    const maskedAccountNumber = accountNumber && accountNumber.length >= 4
      ? `******${accountNumber.slice(-4)}`
      : "invalid";

    console.log(`[Verify Account] Incoming Request - Selected Bank ID: ${bankId}, Account Number: ${maskedAccountNumber}`);

    // Validation
    if (!accountNumber || !/^\d{10}$/.test(accountNumber)) {
      console.warn(`[Verify Account] Invalid account number format: ${maskedAccountNumber}`);
      return NextResponse.json({ error: "Invalid account number." }, { status: 400 });
    }

    if (!bankId) {
      console.warn("[Verify Account] Missing bankId");
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    // Load bank from Firestore
    const bank = await BankService.getBankById(bankId);
    if (!bank) {
      console.warn(`[Verify Account] Bank not found in Firestore for ID: ${bankId}`);
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    const bankCode = bank.code;
    if (!bankCode || !/^\d+$/.test(bankCode)) {
      console.warn(`[Verify Account] Bank ${bank.name} has invalid/non-numeric Flutterwave code: ${bankCode}`);
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    console.log(`[Verify Account] Validating via Flutterwave: Bank: ${bank.name}, Code: ${bankCode}`);

    // Call Flutterwave POST /v3/accounts/resolve with custom retry logic
    let flwData: { status?: string; message?: string; data?: { account_name: string; account_number: string } } | null = null;
    const attempts = 3;
    let lastError: Error | null = null;

    for (let i = 1; i <= attempts; i++) {
      try {
        console.log(`[Verify Account] Outgoing Flutterwave Request (Attempt ${i}/3) for bank code: ${bankCode}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

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
          const errRes = await response.json().catch(() => ({}));
          console.warn(`[Verify Account] Flutterwave rejected with 400 (no retry):`, errRes);
          return NextResponse.json({ error: "Unable to verify account." }, { status: 400 });
        }

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`HTTP Error ${response.status}: ${errText}`);
        }

        flwData = await response.json();
        break;
      } catch (err: unknown) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[Verify Account] Attempt ${i} failed:`, lastError.message);
        if (i === attempts) {
          break;
        }
        await new Promise((res) => setTimeout(res, i * 1000));
      }
    }

    console.log(`[Verify Account] Flutterwave Response:`, JSON.stringify(flwData ? { status: flwData.status, message: flwData.message, dataExists: !!flwData.data } : { error: lastError?.message }));

    if (flwData && flwData.status === "success" && flwData.data) {
      return NextResponse.json({
        success: true,
        accountName: flwData.data.account_name,
        accountNumber: flwData.data.account_number,
      });
    } else {
      return NextResponse.json({ error: "Unable to verify account." }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Verify Account Exception] Process crashed:", errorMsg);
    return NextResponse.json({ error: "Please try again later." }, { status: 500 });
  }
}
