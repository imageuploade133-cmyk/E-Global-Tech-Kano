import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "branding.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    // 1. Get base visual configurations from config/app
    let baseConfig: any = {};
    try {
      const docSnap = await adminDb.collection("config").doc("app").get();
      if (docSnap.exists) {
        baseConfig = docSnap.data() || {};
      }
    } catch (err: any) {
      console.warn("[Admin Config GET API] Base config read failed, using empty:", err.message);
    }

    // 2. Perform low-cost structured aggregations on Firestore collections
    let totalUsers = 0;
    let globalNgnBalance = 0;
    let globalUsdBalance = 0;
    let totalFixedDeposit = 0;
    let todayDeposit = 0;
    let todayTransfer = 0;
    let totalAirtimePurchase = 0;
    let totalBonus = 0;

    // A. Count total users using cost-efficient count() aggregation query
    try {
      const usersCountSnap = await adminDb.collection("users").count().get();
      totalUsers = usersCountSnap.data().count || 0;
    } catch (err: any) {
      console.warn("[Admin Config GET API] users count aggregation failed:", err.message);
    }

    // B. Calculate global NGN balance from NGN wallets
    try {
      const ngnWalletsSnap = await adminDb.collection("wallets")
        .where("currency", "==", "NGN")
        .get();
      ngnWalletsSnap.forEach((doc) => {
        globalNgnBalance += Number(doc.data().balance) || 0;
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] NGN wallets sum failed:", err.message);
    }

    // C. Calculate global USD balance from USD wallets
    try {
      const usdWalletsSnap = await adminDb.collection("wallets")
        .where("currency", "==", "USD")
        .get();
      usdWalletsSnap.forEach((doc) => {
        globalUsdBalance += Number(doc.data().balance) || 0;
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] USD wallets sum failed:", err.message);
    }

    // D. Sum active fixed deposits
    try {
      const activeInvestmentsSnap = await adminDb.collection("investments")
        .where("status", "==", "ACTIVE")
        .get();
      activeInvestmentsSnap.forEach((doc) => {
        const data = doc.data();
        if (data.type === "fixed_deposit" || data.planType === "fixed_deposit") {
          totalFixedDeposit += Number(data.amount) || 0;
        }
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] active fixed deposits sum failed:", err.message);
    }

    // E. Sum today's transactions (deposits and transfers)
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);

      const todayTxSnap = await adminDb.collection("transactions")
        .where("createdAt", ">=", startOfToday.toISOString())
        .get();

      todayTxSnap.forEach((doc) => {
        const data = doc.data();
        const amt = Number(data.amount) || 0;
        if (data.status === "SUCCESS") {
          if (data.type === "DEPOSIT") {
            todayDeposit += amt;
          } else if (data.type === "TRANSFER") {
            todayTransfer += amt;
          }
        }
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] today's transactions sum failed:", err.message);
    }

    // F. Sum total successful airtime purchases
    try {
      const airtimeTxSnap = await adminDb.collection("transactions")
        .where("type", "==", "AIRTIME")
        .where("status", "==", "SUCCESS")
        .get();
      airtimeTxSnap.forEach((doc) => {
        totalAirtimePurchase += Number(doc.data().amount) || 0;
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] airtime purchases sum failed:", err.message);
    }

    // G. Sum total bonus wallet balance from wallets
    try {
      const walletsSnap = await adminDb.collection("wallets").get();
      walletsSnap.forEach((doc) => {
        totalBonus += Number(doc.data().bonusBalance) || 0;
      });
    } catch (err: any) {
      console.warn("[Admin Config GET API] total bonus sum failed:", err.message);
    }

    // H. Low-Cost Aggregations for Transfer Profit and Data Profit (Uses count() aggregation: 1 read per 1,000 txs)
    let totalTransferProfit = 0;
    let totalDataProfit = 0;
    try {
      let dataProfitMargin = 0;
      let transferProfitMargin = 0;

      const marginSnap = await adminDb.collection("config").doc("vtu_profit_margins").get();
      if (marginSnap.exists) {
        const marginData = marginSnap.data();
        dataProfitMargin = Number(marginData?.dataProfitMargin) || 0;
        transferProfitMargin = Number(marginData?.transferProfitMargin) || 0;
      }

      // Calculate transfer profit based on count() aggregation query (1 read per 1,000 txs)
      const transferCountSnap = await adminDb.collection("transactions")
        .where("type", "==", "TRANSFER")
        .where("status", "==", "SUCCESS")
        .count()
        .get();
      const transferCount = transferCountSnap.data().count || 0;
      totalTransferProfit = transferCount * transferProfitMargin;

      // Calculate data profit based on count() aggregation query (1 read per 1,000 txs)
      const dataCountSnap = await adminDb.collection("transactions")
        .where("type", "==", "DATA")
        .where("status", "==", "SUCCESS")
        .count()
        .get();
      const dataCount = dataCountSnap.data().count || 0;
      totalDataProfit = dataCount * dataProfitMargin;
    } catch (err: any) {
      console.warn("[Admin Config GET API] profit aggregation failed:", err.message);
    }

    // 3. Compile and merge aggregated values into config object
    const mergedConfig = {
      ...baseConfig,
      totalUsers,
      globalNgnBalance,
      globalUsdBalance,
      totalFixedDeposit,
      todayDeposit,
      todayTransfer,
      totalAirtimePurchase,
      totalBonus,
      totalTransferProfit,
      totalDataProfit,
    };

    // REQUIREMENT 3 & 4: Ensure imgbbApiKey is NEVER returned to browser clients
    delete (mergedConfig as any).imgbbApiKey;

    return NextResponse.json({ success: true, config: mergedConfig });
  } catch (err: any) {
    console.error("[Admin Config GET API] Exception:", err.message);
    return NextResponse.json({ error: "Unauthorized or server exception", details: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "branding.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    const updates = await req.json();

    // REQUIREMENT 4: Prevent client/admin requests from setting or storing imgbbApiKey in config/app
    if (updates && typeof updates === "object") {
      delete updates.imgbbApiKey;
    }

    // Secure Firestore write with await - wait for Firestore to confirm success before returning success
    await adminDb.collection("config").doc("app").set(updates, { merge: true });

    // Fetch the updated document to return authoritative server data
    const updatedDoc = await adminDb.collection("config").doc("app").get();

    return NextResponse.json({
      success: true,
      message: "Branding and app configuration updated successfully!",
      config: updatedDoc.data()
    });
  } catch (err: any) {
    console.error("[Admin Config POST API] Error:", err.message);
    return NextResponse.json({ error: "Operation failed", details: err.message }, { status: 500 });
  }
}
