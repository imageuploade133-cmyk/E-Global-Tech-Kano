import { NextResponse } from "next/server";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const BANKS_API_URL = "https://api.flutterwave.com/v3/banks/NG";

interface CachedBank {
  name: string;
  code: string;
}

let cachedBanksList: CachedBank[] | null = null;
let lastFetchedTime = 0;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

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

    if (cachedBanksList && now - lastFetchedTime < CACHE_TTL_MS) {
      return NextResponse.json(cachedBanksList);
    }

    if (!FLW_SECRET_KEY) {
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
      if (cachedBanksList) {
        return NextResponse.json(cachedBanksList);
      }
      return NextResponse.json(FALLBACK_NIGERIAN_BANKS);
    }

    const rawBanks = resData.data || [];
    const simplifiedBanks: CachedBank[] = rawBanks.map((bank: { name: string; code: string }) => ({
      name: bank.name,
      code: bank.code,
    }));

    cachedBanksList = simplifiedBanks;
    lastFetchedTime = now;

    return NextResponse.json(simplifiedBanks);
  } catch (err: unknown) {
    if (cachedBanksList) {
      return NextResponse.json(cachedBanksList);
    }
    return NextResponse.json(FALLBACK_NIGERIAN_BANKS);
  }
}
