/**
 * Helper to fetch live FX conversion rates directly from Flutterwave Transfers Rates API.
 * Endpoint: POST https://api.flutterwave.com/v3/transfers/rates
 * Doc reference: https://developer.flutterwave.com/docs/real-time-fx-conversion
 */
export async function fetchFlutterwaveTransferRate(
  fromCurrency: string,
  toCurrency: string,
  amount: number = 1
): Promise<number | null> {
  const flwKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!flwKey) {
    console.warn("[fetchFlutterwaveTransferRate] FLUTTERWAVE_SECRET_KEY is not defined in environment variables.");
    return null;
  }

  const from = fromCurrency.toUpperCase().trim();
  const to = toCurrency.toUpperCase().trim();

  try {
    const res = await fetch("https://api.flutterwave.com/v3/transfers/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${flwKey}`,
      },
      body: JSON.stringify({
        source: { currency: from },
        destination: { currency: to, amount: amount },
      }),
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok && data?.status === "success" && data?.data?.rate) {
      const rateNum = parseFloat(String(data.data.rate));
      if (!isNaN(rateNum) && rateNum > 0) {
        console.log(`[fetchFlutterwaveTransferRate] Live rate fetched (${from} -> ${to}): ${rateNum}`);
        return rateNum;
      }
    }

    // Secondary fallback URL without /v3 if endpoint path differs
    const fallbackRes = await fetch("https://api.flutterwave.com/transfers/rates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${flwKey}`,
      },
      body: JSON.stringify({
        source: { currency: from },
        destination: { currency: to, amount: amount },
      }),
      cache: "no-store",
    });

    const fallbackData = await fallbackRes.json();
    if (fallbackRes.ok && fallbackData?.status === "success" && fallbackData?.data?.rate) {
      const rateNum = parseFloat(String(fallbackData.data.rate));
      if (!isNaN(rateNum) && rateNum > 0) {
        console.log(`[fetchFlutterwaveTransferRate] Live rate fetched via fallback path (${from} -> ${to}): ${rateNum}`);
        return rateNum;
      }
    }
  } catch (err: any) {
    console.warn(`[fetchFlutterwaveTransferRate] Exception fetching live rate (${from} -> ${to}):`, err.message);
  }

  return null;
}
