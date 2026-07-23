import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { InvestmentService } from "@/services/investment-service";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting
  if (isRateLimited(ip, 15, 60 * 1000)) {
    return NextResponse.json({ error: "Too many claims. Please try again later." }, { status: 429 });
  }

  try {
    const authResult = await authenticateUserRequest(req);
    const userId = authResult.uid;
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { record, creditedAmount } = await InvestmentService.claimInvestment(userId, id);

    return NextResponse.json({
      success: true,
      message: `Successfully claimed matured lock! Your wallet was credited with ₦${creditedAmount.toLocaleString()}`,
      investment: record,
      creditedAmount,
    });
  } catch (err: unknown) {
    console.error("[Claim Investment API Error]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message || "Failed to process investment claim." }, { status: 400 });
  }
}
