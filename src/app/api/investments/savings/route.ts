import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { InvestmentService } from "@/services/investment-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting
  if (isRateLimited(ip, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Too many investment actions. Please try again later." }, { status: 429 });
  }

  try {
    const authResult = await authenticateUserRequest(req);
    const userId = authResult.uid;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const idempotencyHeader = req.headers.get("x-idempotency-key") || req.headers.get("idempotency-key") || "";
    const body = await req.json().catch(() => ({}));
    const { amount, currency, productId, walletType, durationDays, idempotencyKey } = body;

    const investAmount = Number(amount);
    if (!amount || isNaN(investAmount) || !isFinite(investAmount) || investAmount <= 0) {
      return NextResponse.json({ error: "Invalid investment amount. Amount must be a positive number." }, { status: 400 });
    }

    if (!productId || typeof productId !== "string") {
      return NextResponse.json({ error: "Product specification (productId) is required." }, { status: 400 });
    }

    const record = await InvestmentService.createInvestment(userId, {
      amount: investAmount,
      currency: currency || "NGN",
      productId,
      type: "SAVINGS",
      walletType: walletType || "MAIN",
      durationDays: durationDays ? Number(durationDays) : undefined,
      idempotencyKey: idempotencyKey || idempotencyHeader || undefined,
    });

    return NextResponse.json({
      success: true,
      message: "Savings account successfully created and funded!",
      investment: record,
    });
  } catch (err: unknown) {
    console.error("[Savings Create API Error]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message || "Failed to create savings holding." }, { status: 400 });
  }
}
