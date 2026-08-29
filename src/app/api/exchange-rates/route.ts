import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    let useLiveWorldDollarRate = false;
    let manualDollarRate = 1550;
    let dollarCommissionFee = 15;
    let xofToNgnRate = 2.5;
    let swapFees = {
      ngnToUsd: 50,
      usdToNgn: 1.5,
      ngnToXof: 30,
      xofToNgn: 10,
      usdToXof: 2.0,
      xofToUsd: 15,
    };

    try {
      const docSnap = await adminDb.collection("config").doc("exchange_rates").get();
      if (docSnap.exists) {
        const stored = docSnap.data();
        if (stored) {
          useLiveWorldDollarRate = Boolean(stored.useLiveWorldDollarRate);
          manualDollarRate = Math.max(1, Number(stored.manualDollarRate) || 1550);
          dollarCommissionFee = Math.max(0, Number(stored.dollarCommissionFee) || 0);
          xofToNgnRate = Math.max(0.01, Number(stored.xofToNgnRate) || 2.5);
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
        }
      }
    } catch (err: any) {
      console.warn("[Public Exchange Rates GET] Config read warning:", err.message);
    }

    let baseDollarRate = manualDollarRate;
    let liveMarketRateFetched = false;

    // Fetch live market USD rate if live mode is enabled
    if (useLiveWorldDollarRate) {
      try {
        const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { cache: "no-store" });
        if (liveRes.ok) {
          const liveData = await liveRes.json();
          if (liveData?.rates?.NGN) {
            baseDollarRate = Number(liveData.rates.NGN);
            liveMarketRateFetched = true;
          }
        }
      } catch (liveErr: any) {
        console.warn("[Public Exchange Rates GET] Live rate fetch fallback:", liveErr.message);
      }
    }

    // Add administrator's configured commission fee onto base dollar rate
    const effectiveDollarSellRate = baseDollarRate + dollarCommissionFee;

    return NextResponse.json({
      success: true,
      rates: {
        mode: useLiveWorldDollarRate ? "LIVE_WORLD" : "MANUAL",
        baseDollarRate,
        dollarCommissionFee,
        effectiveDollarSellRate,
        xofToNgnRate,
        liveMarketRateFetched,
      },
      swapFees,
    });
  } catch (err: any) {
    console.error("[Public Exchange Rates GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch active exchange rates", details: err.message }, { status: 500 });
  }
}
