import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { accountNumber, bankCode } = body;

    if (!accountNumber || !bankCode) {
      return NextResponse.json(
        { error: "Account number 'accountNumber' and bank code 'bankCode' are required parameters." },
        { status: 400 }
      );
    }

    console.log(`[Flutterwave Account Resolution] Resolving Bank Code: ${bankCode}, Acc: ${accountNumber}`);

    const resData = await flutterwaveService.verifyBankAccount({
      account_number: accountNumber,
      account_bank: bankCode,
    });

    if (resData.status === "success") {
      return NextResponse.json({
        success: true,
        accountName: resData.data.account_name,
        accountNumber: resData.data.account_number,
      });
    } else {
      return NextResponse.json(
        { error: "Account resolution failed", details: resData.message },
        { status: 400 }
      );
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[Flutterwave Account Verify Error] Endpoint failure:", errorMsg);
    return NextResponse.json({ error: "Internal Server Account Lookup Error", details: errorMsg }, { status: 500 });
  }
}
