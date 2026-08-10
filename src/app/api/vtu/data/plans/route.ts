import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";
import { adminDb } from "@/lib/firebase-admin";

const FALLBACK_DATA_PLANS: Record<string, any[]> = {
  "MTN": [
    { item_code: "mtn_500mb", name: "MTN 500MB (SME Datashare) - 30 Days", amount: 150, plan_code: "1" },
    { item_code: "mtn_1gb", name: "MTN 1GB (SME Datashare) - 30 Days", amount: 280, plan_code: "2" },
    { item_code: "mtn_2gb", name: "MTN 2GB (SME Datashare) - 30 Days", amount: 560, plan_code: "3" },
    { item_code: "mtn_5gb", name: "MTN 5GB (SME Datashare) - 30 Days", amount: 1400, plan_code: "4" },
    { item_code: "mtn_10gb", name: "MTN 10GB (SME Datashare) - 30 Days", amount: 2800, plan_code: "5" },
  ],
  "GLO": [
    { item_code: "glo_1gb", name: "Glo 1.05GB - 14 Days", amount: 450, plan_code: "glo-1" },
    { item_code: "glo_2gb", name: "Glo 2.9GB - 30 Days", amount: 900, plan_code: "glo-2" },
    { item_code: "glo_5gb", name: "Glo 5.8GB - 30 Days", amount: 1350, plan_code: "glo-3" },
  ],
  "AIRTEL": [
    { item_code: "airtel_1gb", name: "Airtel 1GB - 30 Days", amount: 350, plan_code: "airtel-1" },
    { item_code: "airtel_2gb", name: "Airtel 2GB - 30 Days", amount: 700, plan_code: "airtel-2" },
    { item_code: "airtel_5gb", name: "Airtel 5GB - 30 Days", amount: 1400, plan_code: "airtel-3" },
  ],
  "9MOBILE": [
    { item_code: "9mob_1gb", name: "9mobile 1GB - 30 Days", amount: 400, plan_code: "9mob-1" },
    { item_code: "9mob_2gb", name: "9mobile 2GB - 30 Days", amount: 800, plan_code: "9mob-2" },
  ]
};

export async function GET(req: Request) {
  let network = "";
  let uid = "";

  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (e) {
    // If unauthenticated, still allow fallback loading without crash
  }

  try {
    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const { searchParams } = new URL(req.url);
    network = searchParams.get("network") || "";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    // Retrieve admin global custom profit margin setting from Firestore to apply markup dynamically
    let profitMargin = 0;
    if (adminDb) {
      try {
        const marginSnap = await adminDb.collection("config").doc("vtu_profit_margins").get();
        if (marginSnap.exists) {
          profitMargin = Number(marginSnap.data()?.dataProfitMargin) || 0;
        }
      } catch (dbErr) {
        console.warn("[Plans Profit Margin] Failed to read config profitMargin:", dbErr);
      }
    }

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/data/plans?network=${network}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.warn(`[Data Plans Gateway Fallback Activated]: ${gatewayRes.status} - ${errText}`);

      const normNetwork = network.trim().toUpperCase();
      const rawPlans = FALLBACK_DATA_PLANS[normNetwork] || Object.values(FALLBACK_DATA_PLANS).flat();

      // Apply Profit Margin dynamically on FALLBACK PLANS
      const plans = rawPlans.map(p => {
        const amt = Number(p.amount || p.price || 0) + profitMargin;
        return {
          ...p,
          amount: amt,
          price: amt
        };
      });

      return NextResponse.json({
        success: true,
        data: plans
      });
    }

    const resData = await safeParseJson(gatewayRes);

    // Apply Profit Margin dynamically on RETRIEVED API PLANS
    if (resData && Array.isArray(resData.data)) {
      resData.data = resData.data.map((p: any) => {
        const amt = Number(p.amount || p.price || 0) + profitMargin;
        return {
          ...p,
          amount: amt,
          price: amt
        };
      });
    }

    return NextResponse.json(resData);
  } catch (err: unknown) {
    const error = err as Error;
    console.warn("[Data Plans Route Exception Fallback Activated]:", error.message);

    const normNetwork = network.trim().toUpperCase();
    const rawPlans = FALLBACK_DATA_PLANS[normNetwork] || Object.values(FALLBACK_DATA_PLANS).flat();

    // Retrieve admin global custom profit margin setting from Firestore for exception path
    let profitMargin = 0;
    if (adminDb) {
      try {
        const marginSnap = await adminDb.collection("config").doc("vtu_profit_margins").get();
        if (marginSnap.exists) {
          profitMargin = Number(marginSnap.data()?.dataProfitMargin) || 0;
        }
      } catch (dbErr) {}
    }

    const plans = rawPlans.map(p => {
      const amt = Number(p.amount || p.price || 0) + profitMargin;
      return {
        ...p,
        amount: amt,
        price: amt
      };
    });

    return NextResponse.json({
      success: true,
      data: plans
    });
  }
}
