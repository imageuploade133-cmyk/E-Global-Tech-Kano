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

    const body = await req.json();
    const { amount, currency, productId, walletType } = body;

    const investAmount = Number(amount);
    if (!amount || isNaN(investAmount) || investAmount <= 0) {
      return NextResponse.json({ error: "Invalid investment amount." }, { status: 400 });
    }

    if (!productId) {
      return NextResponse.json({ error: "Product specification (productId) is required." }, { status: 400 });
    }

    const record = await InvestmentService.createInvestment(userId, {
      amount: investAmount,
      currency: currency || "NGN",
      productId,
      type: "SAVINGS",
      walletType: walletType || "MAIN",
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
