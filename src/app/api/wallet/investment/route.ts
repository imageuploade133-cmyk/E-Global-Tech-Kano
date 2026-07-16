import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { WalletService } from "@/lib/wallet-service";
import { adminDb } from "@/lib/firebase-admin";
import { isRateLimited } from "@/lib/rate-limiter";
import { logPaymentEvent } from "@/lib/payment-logger";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 10 requests per minute max
  if (isRateLimited(ip, 10, 60 * 1000)) {
    return NextResponse.json({ error: "Too many investment actions. Please try again later." }, { status: 429 });
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
    const { amount, currency, optionId, optionName, apr, maturityDate, userId } = body;

    const targetUserId = userId || uid;
    if (uid !== targetUserId) {
      return NextResponse.json({ error: "Forbidden: You do not own this wallet." }, { status: 403 });
    }

    const investAmount = Number(amount);
    const investCurrency = currency || "NGN";

    // Inputs Validation
    if (!amount || isNaN(investAmount) || investAmount <= 0) {
      return NextResponse.json({ error: "Invalid investment amount." }, { status: 400 });
    }
    if (!optionId || !optionName || typeof apr !== "number") {
      return NextResponse.json({ error: "Missing required savings plan details." }, { status: 400 });
    }
    if (!maturityDate) {
      return NextResponse.json({ error: "Maturity date is required." }, { status: 400 });
    }

    // Maturity Date Validation: at least 7 days from now
    const minMaturity = new Date();
    minMaturity.setDate(minMaturity.getDate() + 7);
    const chosenDate = new Date(maturityDate);
    if (chosenDate < minMaturity) {
      return NextResponse.json({ error: "Maturity date must be at least 7 days in the future." }, { status: 400 });
    }

    const ref_id = `inv-${uid}-${Date.now()}`;

    // Perform atomic transaction to deduct wallet balance and write ledger and active investment record
    const result = await adminDb.runTransaction(async (transaction) => {
      try {
        const debitRes = await WalletService.debitWallet(transaction, {
          userId: targetUserId,
          amount: investAmount,
          currency: investCurrency,
          reference: ref_id,
          type: "INVESTMENT",
          description: `Locked Savings: ${optionName} (Maturity: ${maturityDate})`,
          recipientName: `${optionName}`,
          fee: 0,
        });

        // Create the active investment document securely in backend database
        const investRef = adminDb.collection("investments").doc(ref_id);
        transaction.set(investRef, {
          id: ref_id,
          userId: targetUserId,
          optionId,
          optionName,
          amount: investAmount,
          currency: investCurrency,
          apr,
          startDate: new Date().toISOString(),
          endDate: chosenDate.toISOString(),
          status: "ACTIVE",
          createdAt: new Date().toISOString(),
        });

        return {
          success: true,
          newBalance: debitRes.newBalance,
        };
      } catch (err: unknown) {
        const error = err as Error;
        return {
          success: false,
          error: error.message,
        };
      }
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    // Log structured Investment Created event
    logPaymentEvent({
      category: "Investment Created",
      userId: targetUserId,
      tx_ref: ref_id,
      amount: investAmount,
      currency: investCurrency,
      message: `Successfully created premium locked savings lock for plan ${optionName}. New Wallet Balance: ₦${result.newBalance}`,
      processingTimeMs: Date.now() - startTime,
    });

    return NextResponse.json({
      success: true,
      message: "Locked savings plan successfully active!",
      newBalance: result.newBalance,
      reference: ref_id,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Investment API Exception] Process crashed:", error.message, error.stack);
    return NextResponse.json({ error: "Internal Investment Processing Error" }, { status: 500 });
  }
}
