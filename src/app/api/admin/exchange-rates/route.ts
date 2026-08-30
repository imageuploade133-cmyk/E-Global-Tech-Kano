import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export interface SwapRangeTier {
  id: string;
  pair: "ngnToUsd" | "usdToNgn" | "ngnToXof" | "xofToNgn" | "usdToXof" | "xofToUsd";
  minAmount: number;
  maxAmount: number;
  markupFee: number;
}

export interface ExchangeRatesConfig {
  useFlutterwaveRate: boolean;
  useLiveWorldDollarRate: boolean;
  manualDollarRate: number;
  dollarCommissionFee: number;

  useLiveWorldXofRate: boolean;
  manualXofRate: number;
  xofCommissionFee: number;

  xofToNgnRate: number;
  swapFees: {
    ngnToUsd: number;
    usdToNgn: number;
    ngnToXof: number;
    xofToNgn: number;
    usdToXof: number;
    xofToUsd: number;
  };
  swapRangeTiers: SwapRangeTier[];
  updatedAt?: string;
  updatedBy?: string;
}

const DEFAULT_EXCHANGE_RATES_CONFIG: ExchangeRatesConfig = {
  useFlutterwaveRate: false,
  useLiveWorldDollarRate: false,
  manualDollarRate: 1550,
  dollarCommissionFee: 15,
  useLiveWorldXofRate: false,
  manualXofRate: 2.5,
  xofCommissionFee: 0.1,
  xofToNgnRate: 2.5,
  swapFees: {
    ngnToUsd: 50,
    usdToNgn: 1.5,
    ngnToXof: 30,
    xofToNgn: 10,
    usdToXof: 2.0,
    xofToUsd: 15,
  },
  swapRangeTiers: [
    {
      id: "tier-demo-1",
      pair: "ngnToUsd",
      minAmount: 1000,
      maxAmount: 5000,
      markupFee: 1,
    },
  ],
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
          useFlutterwaveRate: Boolean(stored?.useFlutterwaveRate),
          useLiveWorldDollarRate: Boolean(stored?.useLiveWorldDollarRate),
          manualDollarRate: Math.max(1, Number(stored?.manualDollarRate) || 1550),
          dollarCommissionFee: Math.max(0, Number(stored?.dollarCommissionFee) || 0),
          useLiveWorldXofRate: Boolean(stored?.useLiveWorldXofRate),
          manualXofRate: Math.max(0.01, Number(stored?.manualXofRate) || 2.5),
          xofCommissionFee: Math.max(0, Number(stored?.xofCommissionFee) || 0),
          xofToNgnRate: Math.max(0.1, Number(stored?.xofToNgnRate) || 2.5),
          swapFees: {
            ngnToUsd: Math.max(0, Number(stored?.swapFees?.ngnToUsd) || 0),
            usdToNgn: Math.max(0, Number(stored?.swapFees?.usdToNgn) || 0),
            ngnToXof: Math.max(0, Number(stored?.swapFees?.ngnToXof) || 0),
            xofToNgn: Math.max(0, Number(stored?.swapFees?.xofToNgn) || 0),
            usdToXof: Math.max(0, Number(stored?.swapFees?.usdToXof) || 0),
            xofToUsd: Math.max(0, Number(stored?.swapFees?.xofToUsd) || 0),
          },
          swapRangeTiers: Array.isArray(stored?.swapRangeTiers)
            ? stored.swapRangeTiers.map((t: any) => ({
                id: String(t.id || `tier-${Math.random().toString(36).substring(2, 9)}`),
                pair: t.pair || "ngnToUsd",
                minAmount: Math.max(0, Number(t.minAmount) || 0),
                maxAmount: Math.max(0, Number(t.maxAmount) || 0),
                markupFee: Math.max(0, Number(t.markupFee) || 0),
              }))
            : DEFAULT_EXCHANGE_RATES_CONFIG.swapRangeTiers,
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

    const useFlutterwaveRate = Boolean(body.useFlutterwaveRate);
    const useLiveWorldDollarRate = Boolean(body.useLiveWorldDollarRate);
    const manualDollarRate = Math.max(1, Number(body.manualDollarRate) || 1550);
    const dollarCommissionFee = Math.max(0, Number(body.dollarCommissionFee) || 0);

    const useLiveWorldXofRate = Boolean(body.useLiveWorldXofRate);
    const manualXofRate = Math.max(0.01, Number(body.manualXofRate) || 2.5);
    const xofCommissionFee = Math.max(0, Number(body.xofCommissionFee) || 0);
    const xofToNgnRate = Math.max(0.01, Number(body.xofToNgnRate) || manualXofRate);

    const swapFees = {
      ngnToUsd: Math.max(0, Number(body.swapFees?.ngnToUsd) || 0),
      usdToNgn: Math.max(0, Number(body.swapFees?.usdToNgn) || 0),
      ngnToXof: Math.max(0, Number(body.swapFees?.ngnToXof) || 0),
      xofToNgn: Math.max(0, Number(body.swapFees?.xofToNgn) || 0),
      usdToXof: Math.max(0, Number(body.swapFees?.usdToXof) || 0),
      xofToUsd: Math.max(0, Number(body.swapFees?.xofToUsd) || 0),
    };

    const swapRangeTiers: SwapRangeTier[] = [];
    if (Array.isArray(body.swapRangeTiers)) {
      for (const t of body.swapRangeTiers) {
        const minAmount = Math.max(0, Number(t.minAmount) || 0);
        const maxAmount = Math.max(0, Number(t.maxAmount) || 0);
        const markupFee = Math.max(0, Number(t.markupFee) || 0);

        if (maxAmount <= minAmount) {
          return NextResponse.json(
            { error: `Invalid custom range tier: Max amount (${maxAmount}) must be strictly greater than Min amount (${minAmount})` },
            { status: 400 }
          );
        }

        swapRangeTiers.push({
          id: String(t.id || `tier-${Math.random().toString(36).substring(2, 9)}`),
          pair: t.pair,
          minAmount,
          maxAmount,
          markupFee,
        });
      }
    }

    const updatedConfig: ExchangeRatesConfig = {
      useFlutterwaveRate,
      useLiveWorldDollarRate,
      manualDollarRate,
      dollarCommissionFee,
      useLiveWorldXofRate,
      manualXofRate,
      xofCommissionFee,
      xofToNgnRate,
      swapFees,
      swapRangeTiers,
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
      useLiveWorldXofRate,
      manualXofRate,
      xofCommissionFee,
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
