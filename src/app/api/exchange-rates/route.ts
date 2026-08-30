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

    let baseDollarRate = manualDollarRate;
    let liveDollarRateFetched = false;

    // Resolve USD -> NGN Rate
    if (useFlutterwaveRate) {
      const flwRate = await fetchFlutterwaveTransferRate("USD", "NGN", 1);
      if (flwRate !== null) {
        baseDollarRate = flwRate;
        liveDollarRateFetched = true;
      }
    } else if (useLiveWorldDollarRate) {
      try {
        const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { cache: "no-store" });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.NGN) {
            baseDollarRate = Number(liveData.rates.NGN);
            liveDollarRateFetched = true;
          }
        }
      } catch (liveErr: any) {
        console.warn("[Public Exchange Rates GET] Live USD rate fetch fallback:", liveErr.message);
      }
    }

    let baseXofRate = manualXofRate;
    let liveXofRateFetched = false;

    // Resolve XOF -> NGN Rate (queries source=XOF, destination=NGN)
    if (useFlutterwaveXofRate) {
      const flwXofRate = await fetchFlutterwaveTransferRate("XOF", "NGN", 1);
      if (flwXofRate !== null) {
        baseXofRate = flwXofRate;
        liveXofRateFetched = true;
      }
    } else if (useLiveWorldXofRate) {
      try {
        const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/XOF", { cache: "no-store" });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.NGN) {
            baseXofRate = Number(liveData.rates.NGN);
            liveXofRateFetched = true;
          }
        }
      } catch (liveErr: any) {
        console.warn("[Public Exchange Rates GET] Live XOF rate fetch fallback:", liveErr.message);
      }
    }

    // Add administrator's configured commission fees onto base rates
    const effectiveDollarSellRate = baseDollarRate + dollarCommissionFee;
    const effectiveXofSellRate = baseXofRate + xofCommissionFee;

    // Direct queries for reverse / cross-currency pairs
    let ngnToUsdRate = 1 / effectiveDollarSellRate;
    if (useFlutterwaveRate) {
      const directNgnToUsd = await fetchFlutterwaveTransferRate("NGN", "USD", 1);
      if (directNgnToUsd !== null) {
        ngnToUsdRate = directNgnToUsd;
      }
    }

    let ngnToXofRate = effectiveXofSellRate > 0 ? 1 / effectiveXofSellRate : manualXofRate;
    if (useFlutterwaveXofRate) {
      const directNgnToXof = await fetchFlutterwaveTransferRate("NGN", "XOF", 1);
      if (directNgnToXof !== null) {
        ngnToXofRate = directNgnToXof;
      }
    }

    let usdToXofRate = effectiveDollarSellRate * (ngnToXofRate || baseXofRate);
    if (useFlutterwaveRate && useFlutterwaveXofRate) {
      const directUsdToXof = await fetchFlutterwaveTransferRate("USD", "XOF", 1);
      if (directUsdToXof !== null) {
        usdToXofRate = directUsdToXof;
      }
    }

    let xofToUsdRate = usdToXofRate > 0 ? 1 / usdToXofRate : 1 / (effectiveDollarSellRate * effectiveXofSellRate);
    if (useFlutterwaveRate && useFlutterwaveXofRate) {
      const directXofToUsd = await fetchFlutterwaveTransferRate("XOF", "USD", 1);
      if (directXofToUsd !== null) {
        xofToUsdRate = directXofToUsd;
      }
    }

    const primaryMode = (useFlutterwaveRate || useFlutterwaveXofRate)
      ? "FLUTTERWAVE"
      : ((useLiveWorldDollarRate || useLiveWorldXofRate) ? "LIVE_WORLD" : "MANUAL");

    return NextResponse.json({
      success: true,
      provider: primaryMode,
      rates: {
        dollarMode: useFlutterwaveRate ? "FLUTTERWAVE" : (useLiveWorldDollarRate ? "LIVE_WORLD" : "MANUAL"),
        baseDollarRate,
        dollarCommissionFee,
        effectiveDollarSellRate,
        liveDollarRateFetched,
        xofMode: useFlutterwaveXofRate ? "FLUTTERWAVE" : (useLiveWorldXofRate ? "LIVE_WORLD" : "MANUAL"),
        baseXofRate,
        xofCommissionFee,
        effectiveXofSellRate,
        liveXofRateFetched,
        xofToNgnRate: effectiveXofSellRate,
        usdToNgn: { rate: effectiveDollarSellRate, baseRate: baseDollarRate, commission: dollarCommissionFee },
        ngnToUsd: { rate: ngnToUsdRate },
        xofToNgn: { rate: effectiveXofSellRate, baseRate: baseXofRate, commission: xofCommissionFee },
        ngnToXof: { rate: ngnToXofRate },
        usdToXof: { rate: usdToXofRate },
        xofToUsd: { rate: xofToUsdRate },
      },
      swapFees,
      swapRangeTiers,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("[Public Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch active exchange rates", details: err.message }, { status: 500 });
  }
}
