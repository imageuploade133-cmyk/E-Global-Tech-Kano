import { NextResponse } from "next/server";
import { BankService } from "@/services/bank-service";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function POST(req: Request) {
  try {
    // 1. Verify admin privilege securely
    await verifyAdminAuth(req);

    console.log("[Admin Sync Banks] Manual bank synchronization triggered by administrator...");

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    // 2. Perform sync from VM Payment Gateway
    const result = await BankService.syncBanks(idToken);

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
