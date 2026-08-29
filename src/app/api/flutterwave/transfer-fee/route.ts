import { NextResponse } from "next/server";
import { authenticateUserRequest, verifyUserKycApproved } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { calculateTransferMarkupFee, TransferTieredMarkup } from "@/lib/transfer-markup-util";

export async function GET(req: Request) {
  const reqId = `fee-req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

  let uid = "";
  // 1. Authenticate user to ensure secure access (no hackers/scammers)
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error(`[Transfer-Fee Auth Error] [${reqId}] Verification failed:`, error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  // 2. Enforce KYC verification consistently for financial services
  const isApproved = await verifyUserKycApproved(uid);
  if (!isApproved) {
    return NextResponse.json({ error: "Forbidden: Account verification is required to perform financial operations." }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const amountStr = searchParams.get("amount") || "0";
    const amount = parseFloat(amountStr);
    const isBulk = searchParams.get("bulk") === "true";
    const countStr = searchParams.get("count") || "1";
    const count = Math.max(1, parseInt(countStr, 10) || 1);

    if (isNaN(amount) || amount < 0) {
      return NextResponse.json({ error: "Invalid transfer amount." }, { status: 400 });
    }

    // 3. Fetch custom global markup configurations securely from Firestore config collection
    let defaultTransferProfitMargin = 0;
    let defaultBulkTransferProfitMargin = 0;
    let transferTieredMargins: TransferTieredMarkup[] = [];
    let bulkTransferTieredMargins: TransferTieredMarkup[] = [];

    const marginRef = adminDb.collection("config").doc("vtu_profit_margins");
    const marginSnap = await marginRef.get();
    if (marginSnap.exists) {
      const marginData = marginSnap.data() || {};
      defaultTransferProfitMargin = Number(marginData.transferProfitMargin) || 0;
      defaultBulkTransferProfitMargin = Number(marginData.bulkTransferProfitMargin) || 0;
      if (Array.isArray(marginData.transferTieredMargins)) {
        transferTieredMargins = marginData.transferTieredMargins;
      }
      if (Array.isArray(marginData.bulkTransferTieredMargins)) {
        bulkTransferTieredMargins = marginData.bulkTransferTieredMargins;
      }
    }

    let finalFee = 10.00;

    if (isBulk) {
      // Bulk transfer fee calculation: evaluate tiered markup for each recipient amount or count
      const amountsParam = searchParams.get("amounts");
      const baseFlatFee = 10.00;
      if (amountsParam) {
        const itemAmounts = amountsParam.split(",").map((a) => Number(a) || 0);
        let accumulatedFees = 0;
        for (const itemAmt of itemAmounts) {
          const markup = calculateTransferMarkupFee(itemAmt, defaultBulkTransferProfitMargin, bulkTransferTieredMargins);
          accumulatedFees += baseFlatFee + markup;
        }
        finalFee = accumulatedFees;
      } else {
        // Evaluate based on average amount per recipient if total amount is passed
        const avgAmtPerRec = count > 0 ? amount / count : amount;
        const bulkMarkup = calculateTransferMarkupFee(avgAmtPerRec, defaultBulkTransferProfitMargin, bulkTransferTieredMargins);
        const finalFlatFee = baseFlatFee + bulkMarkup;
        finalFee = count * finalFlatFee;
      }
    } else {
      // Single transfer fee calculation: fetch base fee from remote payment gateway S2S and apply single tiered markup
      let baseFee = 10.00;
      const authHeader = req.headers.get("Authorization") || "";
      const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

      if (uid !== "mock-uid") {
        try {
          const feeRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer-fee?amount=${amount}&currency=NGN`, {
            headers: {
              "Authorization": `Bearer ${idToken}`,
              "Content-Type": "application/json",
            },
          });
          const feeData = await feeRes.json();
          if (feeRes.ok && feeData.success) {
            baseFee = Number(feeData.fee) || 10.00;
          }
        } catch (err: unknown) {
          const error = err as Error;
          console.warn(`[Transfer-Fee API] [${reqId}] Failed to fetch dynamic fee. Using fallback 10 NGN:`, error.message);
        }
      }

      const transferProfitMargin = calculateTransferMarkupFee(amount, defaultTransferProfitMargin, transferTieredMargins);
      finalFee = baseFee + transferProfitMargin;
    }

    const totalDebit = amount + finalFee;

    console.log(`[Transfer-Fee API] [${reqId}] Calculated transfer fee successfully: amount=${amount}, isBulk=${isBulk}, fee=${finalFee}, totalDebit=${totalDebit}`);

    return NextResponse.json({
      success: true,
      fee: finalFee,
      totalDebit
    });

  } catch (error: any) {
    console.error(`[Transfer-Fee API Exception] [${reqId}] CRITICAL FAILURE:`, error.message, error.stack);
    return NextResponse.json({
      error: "Internal server error occurred while calculating transfer fee.",
      message: error.message
    }, { status: 500 });
  }
}
