import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchFlutterwaveTransferRate } from "@/lib/flutterwave-rates";

export async function GET() {
  try {
    let useFlutterwaveRate = true;
    let useLiveWorldDollarRate = false;
    let manualDollarRate = 1550;
    let dollarCommissionFee = 15;

    let useFlutterwaveXofRate = true;
    let useLiveWorldXofRate = false;
    let manualXofRate = 2.5;
    let xofCommissionFee = 0.1;

    let xofToNgnRate = 2.5;
    let swapFees = {
      ngnToUsd: 50,
      usdToNgn: 1.5,
      ngnToXof: 30,
      xofToNgn: 10,
      usdToXof: 2.0,
      xofToUsd: 15,
    };
    let swapRangeTiers = [];

    try {
      const docSnap = await adminDb.collection("config").doc("exchange_rates").get();
      if (docSnap.exists) {
        const stored = docSnap.data();
        if (stored) {
          useFlutterwaveRate = stored.useFlutterwaveRate !== undefined ? Boolean(stored.useFlutterwaveRate) : true;
          useLiveWorldDollarRate = Boolean(stored.useLiveWorldDollarRate);
          manualDollarRate = Math.max(1, Number(stored.manualDollarRate) || 1550);
          dollarCommissionFee = Math.max(0, Number(stored.dollarCommissionFee) || 0);

          useFlutterwaveXofRate = stored.useFlutterwaveXofRate !== undefined ? Boolean(stored.useFlutterwaveXofRate) : true;
          useLiveWorldXofRate = Boolean(stored.useLiveWorldXofRate);
          manualXofRate = Math.max(0.01, Number(stored.manualXofRate) || 2.5);
          xofCommissionFee = Math.max(0, Number(stored.xofCommissionFee) || 0);

          xofToNgnRate = Math.max(0.01, Number(stored.xofToNgnRate) || manualXofRate);

          if (stored.swapFees) {
            swapFees = {
              ngnToUsd: Math.max(0, Number(stored.swapFees.ngnToUsd) || 0),
              usdToNgn: Math.max(0, Number(stored.swapFees.usdToNgn) || 0),
              ngnToXof: Math.max(0, Number(stored.swapFees.ngnToXof) || 0),
              xofToNgn: Math.max(0, Number(stored.swapFees.xofToNgn) || 0),
              usdToXof: Math.max(0, Number(stored.swapFees.usdToXof) || 0),
              xofToUsd: Math.max(0, Number(stored.swapFees.xofToUsd) || 0),
            };
          }
          if (Array.isArray(stored.swapRangeTiers)) {
            swapRangeTiers = stored.swapRangeTiers;
          }
        }
      }
    } catch (err: any) {
      console.warn("[Public Exchange Rates GET] Config read warning:", err.message);
    }

    const fetchedAt = new Date().toISOString();

    // 1. Resolve USD -> NGN Rate Provider State
    let usdMode = useFlutterwaveRate ? "FLUTTERWAVE" : (useLiveWorldDollarRate ? "LIVE_WORLD" : "MANUAL");
    let usdAvailable = false;
    let baseDollarRate: number | null = null;

    if (useFlutterwaveRate) {
      const flwRate = await fetchFlutterwaveTransferRate("USD", "NGN", 1);
      if (flwRate !== null) {
        baseDollarRate = flwRate;
        usdAvailable = true;
      }
    } else if (useLiveWorldDollarRate) {
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
      baseDollarRate = manualDollarRate;
      usdAvailable = true;
    }

    const effectiveDollarSellRate = (baseDollarRate !== null) ? baseDollarRate + dollarCommissionFee : null;

    // 2. Resolve XOF -> NGN Rate Provider State
    let xofMode = useFlutterwaveXofRate ? "FLUTTERWAVE" : (useLiveWorldXofRate ? "LIVE_WORLD" : "MANUAL");
    let xofAvailable = false;
    let baseXofRate: number | null = null;

    if (useFlutterwaveXofRate) {
      const flwXofRate = await fetchFlutterwaveTransferRate("XOF", "NGN", 1);
      if (flwXofRate !== null) {
        baseXofRate = flwXofRate;
        xofAvailable = true;
      }
    } else if (useLiveWorldXofRate) {
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
      baseXofRate = manualXofRate;
      xofAvailable = true;
    }

    const effectiveXofSellRate = (baseXofRate !== null) ? baseXofRate + xofCommissionFee : null;

    // 3. Resolve Direct Cross Pairs
    // NGN -> USD
    let ngnToUsdRate: number | null = null;
    let ngnToUsdAvailable = false;
    if (useFlutterwaveRate) {
      const flwNgnToUsd = await fetchFlutterwaveTransferRate("NGN", "USD", 1);
      if (flwNgnToUsd !== null) {
        ngnToUsdRate = flwNgnToUsd;
        ngnToUsdAvailable = true;
      } else if (effectiveDollarSellRate !== null && effectiveDollarSellRate > 0) {
        ngnToUsdRate = 1 / effectiveDollarSellRate;
        ngnToUsdAvailable = true;
      }
    } else if (effectiveDollarSellRate !== null && effectiveDollarSellRate > 0) {
      ngnToUsdRate = 1 / effectiveDollarSellRate;
      ngnToUsdAvailable = true;
    }

    // NGN -> XOF
    let ngnToXofRate: number | null = null;
    let ngnToXofAvailable = false;
    if (useFlutterwaveXofRate) {
      const flwNgnToXof = await fetchFlutterwaveTransferRate("NGN", "XOF", 1);
      if (flwNgnToXof !== null) {
        ngnToXofRate = flwNgnToXof;
        ngnToXofAvailable = true;
      } else if (effectiveXofSellRate !== null && effectiveXofSellRate > 0) {
        ngnToXofRate = 1 / effectiveXofSellRate;
        ngnToXofAvailable = true;
      }
    } else if (effectiveXofSellRate !== null && effectiveXofSellRate > 0) {
      ngnToXofRate = 1 / effectiveXofSellRate;
      ngnToXofAvailable = true;
    }

    // USD -> XOF
    let usdToXofRate: number | null = null;
    let usdToXofAvailable = false;
    if (useFlutterwaveRate && useFlutterwaveXofRate) {
      const flwUsdToXof = await fetchFlutterwaveTransferRate("USD", "XOF", 1);
      if (flwUsdToXof !== null) {
        usdToXofRate = flwUsdToXof;
        usdToXofAvailable = true;
      } else if (effectiveDollarSellRate !== null && ngnToXofRate !== null) {
        usdToXofRate = effectiveDollarSellRate * ngnToXofRate;
        usdToXofAvailable = true;
      }
    } else if (effectiveDollarSellRate !== null && effectiveXofSellRate !== null && effectiveXofSellRate > 0) {
      usdToXofRate = effectiveDollarSellRate / effectiveXofSellRate;
      usdToXofAvailable = true;
    }

    // XOF -> USD
    let xofToUsdRate: number | null = null;
    let xofToUsdAvailable = false;
    if (useFlutterwaveRate && useFlutterwaveXofRate) {
      const flwXofToUsd = await fetchFlutterwaveTransferRate("XOF", "USD", 1);
      if (flwXofToUsd !== null) {
        xofToUsdRate = flwXofToUsd;
        xofToUsdAvailable = true;
      } else if (usdToXofRate !== null && usdToXofRate > 0) {
        xofToUsdRate = 1 / usdToXofRate;
        xofToUsdAvailable = true;
      }
    } else if (usdToXofRate !== null && usdToXofRate > 0) {
      xofToUsdRate = 1 / usdToXofRate;
      xofToUsdAvailable = true;
    }

    const primaryMode = (useFlutterwaveRate || useFlutterwaveXofRate)
      ? "FLUTTERWAVE"
      : ((useLiveWorldDollarRate || useLiveWorldXofRate) ? "LIVE_WORLD" : "MANUAL");

    return NextResponse.json({
      success: true,
      provider: primaryMode,
      rates: {
        dollarMode: usdMode,
        baseDollarRate,
        dollarCommissionFee,
        effectiveDollarSellRate,
        liveDollarRateFetched: usdAvailable,

        xofMode,
        baseXofRate,
        xofCommissionFee,
        effectiveXofSellRate,
        liveXofRateFetched: xofAvailable,
        xofToNgnRate: effectiveXofSellRate,

        usdToNgn: {
          mode: usdMode,
          available: usdAvailable,
          baseRate: baseDollarRate,
          commission: dollarCommissionFee,
          rate: effectiveDollarSellRate,
          fetchedAt,
          error: usdAvailable ? null : "Flutterwave rate unavailable",
        },
        ngnToUsd: {
          mode: usdMode,
          available: ngnToUsdAvailable,
          rate: ngnToUsdRate,
          fetchedAt,
          error: ngnToUsdAvailable ? null : "Flutterwave rate unavailable",
        },
        xofToNgn: {
          mode: xofMode,
          available: xofAvailable,
          baseRate: baseXofRate,
          commission: xofCommissionFee,
          rate: effectiveXofSellRate,
          fetchedAt,
          error: xofAvailable ? null : "Flutterwave rate unavailable",
        },
        ngnToXof: {
          mode: xofMode,
          available: ngnToXofAvailable,
          rate: ngnToXofRate,
          fetchedAt,
          error: ngnToXofAvailable ? null : "Flutterwave rate unavailable",
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
      swapFees,
      swapRangeTiers,
      fetchedAt,
    });
  } catch (err: any) {
    console.error("[Public Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch active exchange rates", details: err.message }, { status: 500 });
  }
}
