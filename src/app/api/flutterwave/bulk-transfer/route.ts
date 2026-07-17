import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { BulkTransferService } from "@/services/bulk-transfer-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: max 10 bulk transfer batches per minute per IP to prevent spammers
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many bulk transfer requests. Please try again later." }, { status: 429 });
  }

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { title, recipients } = body;

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: "Recipients list must be a non-empty array." }, { status: 400 });
    }

    console.log(`[Bulk Transfer API] Queue request received from ${uid} with ${recipients.length} recipients.`);

    // 1. Validate and queue bulk transfer atomically (Deducts balance in transaction)
    const queueResult = await BulkTransferService.queueBulkTransfer(uid, title || "Bulk Salary Payment", recipients);

    // 2. Dispatch background processing asynchronously to prevent HTTP gateway timeout
    if (queueResult.success) {
      console.log(`[Bulk Transfer API] Batch ${queueResult.bulkTransferId} queued. Spawning background processor worker...`);

      // Fire-and-forget: execute processQueuedBatch in the background without awaiting
      BulkTransferService.processQueuedBatch(queueResult.bulkTransferId).catch((err) => {
        console.error(`[Bulk Transfer API Worker Fail] Background execution failed for ${queueResult.bulkTransferId}:`, err.message);
      });
    }

    return NextResponse.json({
      success: true,
      message: "Bulk transfer batch successfully queued and processing in the background.",
      bulkTransferId: queueResult.bulkTransferId,
      newBalance: queueResult.newBalance,
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Bulk Transfer API Exception] Queue failed:", error.message, error.stack);
    return NextResponse.json({ error: error.message || "Internal Bulk Transfer Processing Error" }, { status: 500 });
  }
}
