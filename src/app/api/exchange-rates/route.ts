import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { fetchFlutterwaveTransferRate } from "@/lib/flutterwave-rates";

export async function GET() {
  try {
    let useFlutterwaveRate = false;
    let useLiveWorldDollarRate = false;
    let manualDollarRate = 1550;
    let dollarCommissionFee = 15;

    let useFlutterwaveXofRate = false;
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
          useFlutterwaveRate = Boolean(stored.useFlutterwaveRate);
          useLiveWorldDollarRate = Boolean(stored.useLiveWorldDollarRate);
          manualDollarRate = Math.max(1, Number(stored.manualDollarRate) || 1550);
          dollarCommissionFee = Math.max(0, Number(stored.dollarCommissionFee) || 0);

          useFlutterwaveXofRate = Boolean(stored.useFlutterwaveXofRate);
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

    // Fetch live market USD rate if Flutterwave or Live World mode is enabled
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

    // Fetch live market XOF rate if Flutterwave or Live World mode is enabled
    if (useFlutterwaveXofRate) {
      const flwXofRate = await fetchFlutterwaveTransferRate("NGN", "XOF", 1);
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

    return NextResponse.json({
      success: true,
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
      },
      swapFees,
      swapRangeTiers,
    });
  } catch (err: any) {
    console.error("[Public Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch active exchange rates", details: err.message }, { status: 500 });
  }
}
