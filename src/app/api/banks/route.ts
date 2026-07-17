import { NextResponse } from "next/server";
import { BankService } from "@/services/bank-service";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const search = url.searchParams.get("search") || undefined;

    const banks = await BankService.getBanks(search);

    return NextResponse.json(banks);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[GET /api/banks Error] Failed to retrieve banks list:", error.message);
    return NextResponse.json(
      { error: "Failed to retrieve bank list. Please try again later." },
      { status: 500 }
    );
  }
}
