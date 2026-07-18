import { NextResponse } from "next/server";
import { BankService } from "@/services/bank-service";
import { PaymentGatewayManager } from "@/lib/payment/PaymentGatewayManager";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

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
      console.warn(`[Verify Account] Bank ${bank.name} has invalid/non-numeric code: ${bankCode}`);
      return NextResponse.json({ error: "Invalid bank selected." }, { status: 400 });
    }

    console.log(`[Verify Account] Validating: Bank: ${bank.name}, Code: ${bankCode}`);

    const isSandbox = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST-");
    if (isSandbox && bankCode !== "044") {
      console.warn(`[Verify Account Sandbox Restriction] Attempt to resolve real bank code ${bankCode} ('${bank.name}') in Sandbox blocked.`);
      return NextResponse.json({
        error: "Real bank account resolution is not supported in Sandbox. Please use the documented test accounts or switch to live credentials."
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
      });
    } else {
      return NextResponse.json({ error: res.error || "Unable to verify account." }, { status: 400 });
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Verify Account Exception] Process crashed:", errorMsg);
    return NextResponse.json({ error: "Please try again later." }, { status: 500 });
  }
}
