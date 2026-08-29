import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

interface ExchangeRatesConfig {
  useLiveWorldDollarRate: boolean;
  manualDollarRate: number;
  dollarCommissionFee: number;
  xofToNgnRate: number;
  // Multi-Pair Swap Fees (Flat ₦ or USD or XOF or Percentage)
  swapFees: {
    ngnToUsd: number;
    usdToNgn: number;
    ngnToXof: number;
    xofToNgn: number;
    usdToXof: number;
    xofToUsd: number;
  };
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_EXCHANGE_RATES_CONFIG: ExchangeRatesConfig = {
  useLiveWorldDollarRate: false,
  manualDollarRate: 1550,
  dollarCommissionFee: 15,
  xofToNgnRate: 2.5,
  swapFees: {
    ngnToUsd: 50,
    usdToNgn: 1.5,
    ngnToXof: 30,
    xofToNgn: 10,
    usdToXof: 2.0,
    xofToUsd: 15,
  },
};

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "exchange_rates.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    let config = { ...DEFAULT_EXCHANGE_RATES_CONFIG };

    try {
      const docSnap = await adminDb.collection("config").doc("exchange_rates").get();
      if (docSnap.exists) {
        const stored = docSnap.data();
        config = {
          useLiveWorldDollarRate: Boolean(stored?.useLiveWorldDollarRate),
          manualDollarRate: Math.max(1, Number(stored?.manualDollarRate) || 1550),
          dollarCommissionFee: Math.max(0, Number(stored?.dollarCommissionFee) || 0),
          xofToNgnRate: Math.max(0.1, Number(stored?.xofToNgnRate) || 2.5),
          swapFees: {
            ngnToUsd: Math.max(0, Number(stored?.swapFees?.ngnToUsd) || 0),
            usdToNgn: Math.max(0, Number(stored?.swapFees?.usdToNgn) || 0),
            ngnToXof: Math.max(0, Number(stored?.swapFees?.ngnToXof) || 0),
            xofToNgn: Math.max(0, Number(stored?.swapFees?.xofToNgn) || 0),
            usdToXof: Math.max(0, Number(stored?.swapFees?.usdToXof) || 0),
            xofToUsd: Math.max(0, Number(stored?.swapFees?.xofToUsd) || 0),
          },
          updatedAt: stored?.updatedAt,
          updatedBy: stored?.updatedBy,
        };
      }
    } catch (err: any) {
      console.warn("[Admin Exchange Rates GET] Firestore fetch warning:", err.message);
    }

    return NextResponse.json({ success: true, config });
  } catch (err: any) {
    console.error("[Admin Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Unauthorized or backend exception", details: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "exchange_rates.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    const adminEmail = perm.auth?.email || "admin";
    const body = await req.json();

    const useLiveWorldDollarRate = Boolean(body.useLiveWorldDollarRate);
    const manualDollarRate = Math.max(1, Number(body.manualDollarRate) || 1550);
    const dollarCommissionFee = Math.max(0, Number(body.dollarCommissionFee) || 0);
    const xofToNgnRate = Math.max(0.01, Number(body.xofToNgnRate) || 2.5);

    const swapFees = {
      ngnToUsd: Math.max(0, Number(body.swapFees?.ngnToUsd) || 0),
      usdToNgn: Math.max(0, Number(body.swapFees?.usdToNgn) || 0),
      ngnToXof: Math.max(0, Number(body.swapFees?.ngnToXof) || 0),
      xofToNgn: Math.max(0, Number(body.swapFees?.xofToNgn) || 0),
      usdToXof: Math.max(0, Number(body.swapFees?.usdToXof) || 0),
      xofToUsd: Math.max(0, Number(body.swapFees?.xofToUsd) || 0),
    };

    const updatedConfig: ExchangeRatesConfig = {
      useLiveWorldDollarRate,
      manualDollarRate,
      dollarCommissionFee,
      xofToNgnRate,
      swapFees,
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail,
    };

    await adminDb.collection("config").doc("exchange_rates").set(updatedConfig, { merge: true });

    await adminDb.collection("admin_audit_logs").add({
      action: "update_exchange_rates_config",
      adminEmail,
      useLiveWorldDollarRate,
      manualDollarRate,
      dollarCommissionFee,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      message: "Exchange rates and swap fees updated successfully!",
      config: updatedConfig,
    });
  } catch (err: any) {
    console.error("[Admin Exchange Rates POST Exception]:", err.message);
    return NextResponse.json({ error: "Failed to update exchange rate settings", details: err.message }, { status: 500 });
  }
}
