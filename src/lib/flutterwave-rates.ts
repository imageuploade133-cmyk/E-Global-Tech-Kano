/**
 * Helper to fetch live FX conversion rates via payment-gateway VM or direct Flutterwave Transfers Rates V3 API.
 * Endpoint: GET https://api.flutterwave.com/v3/transfers/rates?amount={amount}&destination_currency={dest}&source_currency={src}
 * Doc reference: https://developer.flutterwave.com/docs/real-time-fx-conversion
 */

const rateCache: Map<string, { rate: number; expiresAt: number }> = new Map();
const RATE_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

export async function fetchFlutterwaveTransferRate(
  fromCurrency: string,
  toCurrency: string,
  amount: number = 1
): Promise<number | null> {
  let from = fromCurrency.toUpperCase().trim();
  let to = toCurrency.toUpperCase().trim();

  if (from === "FCFA") from = "XOF";
  if (to === "FCFA") to = "XOF";

  if (from === to) return 1;

  const cacheKey = `${from}_${to}_${amount}`;
  const now = Date.now();
  const cached = rateCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.rate;
  }

  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
  const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

  // 1. Try VM server-to-server gateway first (keeps secret key on VM)
  try {
    const vmRes = await fetch(
      `${gatewayUrl}/api/flutterwave/rates?sourceCurrency=${from}&destinationCurrency=${to}&amount=${amount}`,
      {
        method: "GET",
        headers: {
          "x-api-key": apiKey,
          "Authorization": `Bearer ${apiKey}`,
        },
        cache: "no-store",
      }
    );

    if (vmRes.ok) {
      const vmData = await vmRes.json();
      if (vmData?.success && typeof vmData.rate === "number" && vmData.rate > 0) {
        const rate = vmData.rate;
        rateCache.set(cacheKey, { rate, expiresAt: now + RATE_CACHE_TTL_MS });
        console.log(`[fetchFlutterwaveTransferRate] VM S2S rate fetched (${from} -> ${to}): ${rate}`);
        return rate;
      }
    }
  } catch (vmErr: any) {
    console.warn(`[fetchFlutterwaveTransferRate] VM S2S request warning (${from} -> ${to}):`, vmErr.message);
  }

  // 2. Fallback: Direct Flutterwave V3 GET request (Server-side only if FLUTTERWAVE_SECRET_KEY set)
  const flwKey = process.env.FLUTTERWAVE_SECRET_KEY;
  if (!flwKey) {
    return null;
  }

  try {
    const url = `https://api.flutterwave.com/v3/transfers/rates?amount=${amount}&destination_currency=${to}&source_currency=${from}`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${flwKey}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const data = await res.json();
    if (res.ok && data?.status === "success" && data?.data?.rate) {
      const rateNum = parseFloat(String(data.data.rate));
      if (!isNaN(rateNum) && rateNum > 0) {
        rateCache.set(cacheKey, { rate: rateNum, expiresAt: now + RATE_CACHE_TTL_MS });
        console.log(`[fetchFlutterwaveTransferRate] Direct Flutterwave V3 GET rate fetched (${from} -> ${to}): ${rateNum}`);
        return rateNum;
      }
    } else {
      console.warn(`[fetchFlutterwaveTransferRate] Direct Flutterwave V3 GET returned error (${from} -> ${to}):`, data?.message);
    }
  } catch (err: any) {
    console.warn(`[fetchFlutterwaveTransferRate] Direct V3 GET exception (${from} -> ${to}):`, err.message);
  }

  return null;
}
