import { NextResponse } from "next/server";
import { PaymentService } from "@/lib/payment-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function GET(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 60 status checks per minute max (allows fast polling from active checkout screens)
  if (isRateLimited(ip, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const txRef = searchParams.get("txRef");

    if (!txRef) {
      return NextResponse.json({ error: "Missing required query parameter 'txRef'." }, { status: 400 });
    }

    console.log(`[Polling Payment Status] txRef: ${txRef}`);

    // Call service layer to verify reference status on Flutterwave rail
    const statusResult = await PaymentService.checkPaymentStatus(txRef);

    return NextResponse.json({
      success: true,
      ...statusResult,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Payment Status API Exception] Checking failed:", error.message, error.stack);
    return NextResponse.json({ error: "Internal Server Error checking payment status." }, { status: 500 });
  }
}
