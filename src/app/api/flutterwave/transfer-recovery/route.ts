import { NextResponse } from "next/server";
import { TransferRecoveryService } from "@/services/transfer-recovery-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 10 trigger scans per minute max to prevent CRON congestion
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many reconciliation scans. Please try again later." }, { status: 429 });
  }

  try {
    console.log("[Transfer Recovery API] Triggering dynamic scan to resolve stuck transfers...");

    const results = await TransferRecoveryService.recoverProcessingTransfers();

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      message: "Transfer recovery and reconciliation scan completed successfully.",
      results,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer Recovery API Error] Process crashed:", error.message);
    return NextResponse.json({ error: "Reconciliation scan process failed." }, { status: 500 });
  }
}
