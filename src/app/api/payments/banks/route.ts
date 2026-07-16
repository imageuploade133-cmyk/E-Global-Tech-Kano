import { NextResponse } from "next/server";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const BANKS_API_URL = "https://api.flutterwave.com/v3/banks/NG";

// In-Memory Server-Side Cache
interface CachedBank {
  name: string;
  code: string;
}

let cachedBanksList: CachedBank[] | null = null;
let lastFetchedTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// High-fidelity fallback list in case Flutterwave API is completely unreachable
const FALLBACK_NIGERIAN_BANKS: CachedBank[] = [
  { name: "GTBank", code: "058" },
  { name: "Access Bank", code: "044" },
  { name: "UBA", code: "033" },
  { name: "Zenith Bank", code: "057" },
  { name: "First Bank", code: "011" },
  { name: "Fidelity Bank", code: "070" },
  { name: "FCMB", code: "214" },
  { name: "Sterling Bank", code: "050" },
  { name: "Wema Bank", code: "035" },
  { name: "Keystone Bank", code: "082" },
  { name: "Polaris Bank", code: "076" },
  { name: "Stanbic IBTC", code: "039" },
  { name: "Union Bank", code: "032" },
  { name: "Ecobank", code: "050" },
  { name: "Opay", code: "999992" },
  { name: "Moniepoint", code: "50515" },
];

export async function GET() {
  try {
    const now = Date.now();

    // Check if we have a valid cache (less than 24 hours old)
    if (cachedBanksList && now - lastFetchedTime < CACHE_TTL_MS) {
      console.log(`[Banks Discovery] Serving ${cachedBanksList.length} banks from server-side cache (TTL remaining: ${Math.round((CACHE_TTL_MS - (now - lastFetchedTime)) / 1000)}s)`);
      return NextResponse.json(cachedBanksList);
    }

    console.log(`[Banks Discovery] Cache expired or missing. Fetching Nigerian banks from Flutterwave...`);

    if (!FLW_SECRET_KEY) {
      console.warn("[Banks Discovery] Missing Flutterwave Secret Key. Serving fallback bank list.");
      return NextResponse.json(FALLBACK_NIGERIAN_BANKS);
    }

    const response = await fetch(BANKS_API_URL, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const resData = await response.json();

    if (!response.ok || resData.status !== "success") {
      console.error(`[Banks Discovery Error] API fetch failed:`, resData);
      // Fallback securely to prevent checkout page blockages
      if (cachedBanksList) {
        console.warn(`[Banks Discovery Fallback] Serving expired cached list instead of crashing.`);
        return NextResponse.json(cachedBanksList);
      }
      return NextResponse.json(FALLBACK_NIGERIAN_BANKS);
    }

    const rawBanks = resData.data || [];
    const simplifiedBanks: CachedBank[] = rawBanks.map((bank: { name: string; code: string }) => ({
      name: bank.name,
      code: bank.code,
    }));

    // Update Cache
    cachedBanksList = simplifiedBanks;
    lastFetchedTime = now;
    console.log(`[Banks Discovery Success] Successfully fetched and cached ${simplifiedBanks.length} banks.`);

    return NextResponse.json(simplifiedBanks);
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Banks Discovery Exception] Process failed:`, error.message);
    if (cachedBanksList) {
      return NextResponse.json(cachedBanksList);
    }
    return NextResponse.json(FALLBACK_NIGERIAN_BANKS);
  }
}
