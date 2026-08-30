import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchFlutterwaveTransferRate } from "@/lib/flutterwave-rates";
import {
  DEFAULT_FULL_EXCHANGE_RATES_CONFIG,
  FullExchangeRatesConfig,
  NON_NGN_CURRENCIES,
  calculateDirectionalCustomerRate,
  getCurrencyAdjustments,
} from "@/lib/exchange-pricing";

export async function GET() {
  try {
    let config: FullExchangeRatesConfig = { ...DEFAULT_FULL_EXCHANGE_RATES_CONFIG };

    try {
      const docSnap = await adminDb.collection("config").doc("exchange_rates").get();
      if (docSnap.exists) {
        const stored = docSnap.data();
        if (stored) {
          config = {
            ...DEFAULT_FULL_EXCHANGE_RATES_CONFIG,
            ...stored,
            swapFees: stored.swapFees ? { ...DEFAULT_FULL_EXCHANGE_RATES_CONFIG.swapFees, ...stored.swapFees } : DEFAULT_FULL_EXCHANGE_RATES_CONFIG.swapFees,
            swapRangeTiers: Array.isArray(stored.swapRangeTiers) ? stored.swapRangeTiers : [],
          };
        }
      }
    } catch (err: any) {
      console.warn("[Public Exchange Rates GET] Config read warning:", err.message);
    }

    const fetchedAt = new Date().toISOString();

    // 1. Resolve USD Base Rate
    const usdMode = config.useFlutterwaveRate ? "FLUTTERWAVE" : (config.useLiveWorldDollarRate ? "LIVE_WORLD" : "MANUAL");
    let usdAvailable = false;
    let baseDollarRate: number | null = null;

    if (config.useFlutterwaveRate) {
      const flwRate = await fetchFlutterwaveTransferRate("USD", "NGN", 1);
      if (flwRate !== null) {
        baseDollarRate = flwRate;
        usdAvailable = true;
      }
    } else if (config.useLiveWorldDollarRate) {
      try {
        const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { cache: "no-store" });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.NGN) {
            baseDollarRate = Number(liveData.rates.NGN);
            usdAvailable = true;
          }
        }
      } catch (liveErr: any) {
        console.warn("[Public Exchange Rates GET] Live USD rate fetch fallback:", liveErr.message);
      }
    } else {
      baseDollarRate = config.manualDollarRate;
      usdAvailable = true;
    }

    // 2. Resolve XOF Base Rate
    const xofMode = config.useFlutterwaveXofRate ? "FLUTTERWAVE" : (config.useLiveWorldXofRate ? "LIVE_WORLD" : "MANUAL");
    let xofAvailable = false;
    let baseXofRate: number | null = null;

    if (config.useFlutterwaveXofRate) {
      const flwXofRate = await fetchFlutterwaveTransferRate("XOF", "NGN", 1);
      if (flwXofRate !== null) {
        baseXofRate = flwXofRate;
        xofAvailable = true;
      }
    } else if (config.useLiveWorldXofRate) {
      try {
        const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/XOF", { cache: "no-store" });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.NGN) {
            baseXofRate = Number(liveData.rates.NGN);
            xofAvailable = true;
          }
        }
      } catch (liveErr: any) {
        console.warn("[Public Exchange Rates GET] Live XOF rate fetch fallback:", liveErr.message);
      }
    } else {
      baseXofRate = config.manualXofRate;
      xofAvailable = true;
    }

    // Two-sided calculation for USD & XOF
    const usdAdj = getCurrencyAdjustments(config, "USD");
    const usdSellRate = baseDollarRate !== null ? baseDollarRate + usdAdj.buyAdjustment : null;
    const usdBuyRate = baseDollarRate !== null ? Math.max(0.01, baseDollarRate - usdAdj.sellAdjustment) : null;

    const xofAdj = getCurrencyAdjustments(config, "XOF");
    const xofSellRate = baseXofRate !== null ? baseXofRate + xofAdj.buyAdjustment : null;
    const xofBuyRate = baseXofRate !== null ? Math.max(0.001, baseXofRate - xofAdj.sellAdjustment) : null;

    // Cross pairs
    let ngnToUsdRate: number | null = null;
    let ngnToUsdAvailable = false;
    if (config.useFlutterwaveRate) {
      const flwNgnToUsd = await fetchFlutterwaveTransferRate("NGN", "USD", 1);
      if (flwNgnToUsd !== null) {
        ngnToUsdRate = flwNgnToUsd;
        ngnToUsdAvailable = true;
      }
    } else if (usdSellRate !== null && usdSellRate > 0) {
      ngnToUsdRate = 1 / usdSellRate;
      ngnToUsdAvailable = true;
    }

    let ngnToXofRate: number | null = null;
    let ngnToXofAvailable = false;
    if (config.useFlutterwaveXofRate) {
      const flwNgnToXof = await fetchFlutterwaveTransferRate("NGN", "XOF", 1);
      if (flwNgnToXof !== null) {
        ngnToXofRate = flwNgnToXof;
        ngnToXofAvailable = true;
      }
    } else if (xofSellRate !== null && xofSellRate > 0) {
      ngnToXofRate = 1 / xofSellRate;
      ngnToXofAvailable = true;
    }

    let usdToXofRate: number | null = null;
    let usdToXofAvailable = false;
    if (config.useFlutterwaveRate && config.useFlutterwaveXofRate) {
      const flwUsdToXof = await fetchFlutterwaveTransferRate("USD", "XOF", 1);
      if (flwUsdToXof !== null) {
        usdToXofRate = flwUsdToXof;
        usdToXofAvailable = true;
      }
    } else if (usdSellRate !== null && xofSellRate !== null && xofSellRate > 0) {
      usdToXofRate = usdSellRate / xofSellRate;
      usdToXofAvailable = true;
    }

    let xofToUsdRate: number | null = null;
    let xofToUsdAvailable = false;
    if (config.useFlutterwaveRate && config.useFlutterwaveXofRate) {
      const flwXofToUsd = await fetchFlutterwaveTransferRate("XOF", "USD", 1);
      if (flwXofToUsd !== null) {
        xofToUsdRate = flwXofToUsd;
        xofToUsdAvailable = true;
      }
    } else if (usdToXofRate !== null && usdToXofRate > 0) {
      xofToUsdRate = 1 / usdToXofRate;
      xofToUsdAvailable = true;
    }

    const primaryMode = (config.useFlutterwaveRate || config.useFlutterwaveXofRate)
      ? "FLUTTERWAVE"
      : ((config.useLiveWorldDollarRate || config.useLiveWorldXofRate) ? "LIVE_WORLD" : "MANUAL");

    return NextResponse.json({
      success: true,
      provider: primaryMode,
      rates: {
        dollarMode: usdMode,
        baseDollarRate,
        dollarCommissionFee: usdAdj.buyAdjustment,
        usdSellMarkup: usdAdj.buyAdjustment,
        usdBuyMarkup: usdAdj.sellAdjustment,
        usdSellRate,
        usdBuyRate,
        effectiveDollarSellRate: usdSellRate,
        liveDollarRateFetched: usdAvailable,

        xofMode,
        baseXofRate,
        xofCommissionFee: xofAdj.buyAdjustment,
        xofSellMarkup: xofAdj.buyAdjustment,
        xofBuyMarkup: xofAdj.sellAdjustment,
        xofSellRate,
        xofBuyRate,
        effectiveXofSellRate: xofSellRate,
        liveXofRateFetched: xofAvailable,
        xofToNgnRate: xofSellRate,

        usdToNgn: {
          mode: usdMode,
          available: usdAvailable,
          baseRate: baseDollarRate,
          buyMarkup: usdAdj.sellAdjustment,
          sellMarkup: usdAdj.buyAdjustment,
          rate: usdBuyRate,
          fetchedAt,
          error: usdAvailable ? null : "Flutterwave rate unavailable",
        },
        ngnToUsd: {
          mode: usdMode,
          available: ngnToUsdAvailable || usdAvailable,
          baseRate: baseDollarRate,
          sellMarkup: usdAdj.buyAdjustment,
          rate: ngnToUsdRate || (usdSellRate ? 1 / usdSellRate : null),
          fetchedAt,
          error: (ngnToUsdAvailable || usdAvailable) ? null : "Flutterwave rate unavailable",
        },
        xofToNgn: {
          mode: xofMode,
          available: xofAvailable,
          baseRate: baseXofRate,
          buyMarkup: xofAdj.sellAdjustment,
          sellMarkup: xofAdj.buyAdjustment,
          rate: xofBuyRate,
          fetchedAt,
          error: xofAvailable ? null : "Flutterwave rate unavailable",
        },
        ngnToXof: {
          mode: xofMode,
          available: ngnToXofAvailable || xofAvailable,
          baseRate: baseXofRate,
          sellMarkup: xofAdj.buyAdjustment,
          rate: ngnToXofRate || (xofSellRate ? 1 / xofSellRate : null),
          fetchedAt,
          error: (ngnToXofAvailable || xofAvailable) ? null : "Flutterwave rate unavailable",
        },
        usdToXof: {
          mode: primaryMode,
          available: usdToXofAvailable,
          rate: usdToXofRate,
          fetchedAt,
          error: usdToXofAvailable ? null : "Flutterwave rate unavailable",
        },
        xofToUsd: {
          mode: primaryMode,
          available: xofToUsdAvailable,
          rate: xofToUsdRate,
          fetchedAt,
          error: xofToUsdAvailable ? null : "Flutterwave rate unavailable",
        },
      },
      swapFees: config.swapFees,
      swapRangeTiers: config.swapRangeTiers,
      fetchedAt,
    });
  } catch (err: any) {
    console.error("[Public Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch active exchange rates", details: err.message }, { status: 500 });
  }
}
