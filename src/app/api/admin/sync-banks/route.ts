import { NextResponse } from "next/server";
import { BankService } from "@/services/bank-service";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    // 1. Verify admin privilege securely
    await verifyAdminAuth(req);

    console.log("[Admin Sync Banks] Manual bank synchronization triggered by administrator...");

    // 2. Perform sync from Flutterwave
    const result = await BankService.syncBanks();

    return NextResponse.json({
      success: true,
      message: "Bank codes successfully synchronized from Flutterwave.",
      count: result.count,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Sync Banks Exception] Failed to sync banks:", error.message);
    return NextResponse.json(
      { error: "Bank synchronization failed.", details: error.message },
      { status: 500 }
    );
  }
}
