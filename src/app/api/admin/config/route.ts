import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
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
    };

    return NextResponse.json({ success: true, config: mergedConfig });
  } catch (err: any) {
    console.error("[Admin Config GET API] Exception:", err.message);
    return NextResponse.json({ error: "Unauthorized or server exception", details: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const updates = await req.json();

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
