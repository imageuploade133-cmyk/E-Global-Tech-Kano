import { NextResponse } from "next/server";

const MOCK_BILLERS: Record<string, Array<{ name: string; biller_code: string; label_name: string }>> = {
  AIRTIME: [
    { name: "MTN Airtime", biller_code: "BIL099", label_name: "Mobile Phone Number" },
    { name: "GLO Airtime", biller_code: "BIL102", label_name: "Mobile Phone Number" },
    { name: "Airtel Airtime", biller_code: "BIL100", label_name: "Mobile Phone Number" },
    { name: "9mobile Airtime", biller_code: "BIL101", label_name: "Mobile Phone Number" },
  ],
  MOBILEDATA: [
    { name: "MTN Mobile Data", biller_code: "BIL104", label_name: "Mobile Phone Number" },
    { name: "GLO Mobile Data", biller_code: "BIL105", label_name: "Mobile Phone Number" },
    { name: "Airtel Mobile Data", biller_code: "BIL106", label_name: "Mobile Phone Number" },
    { name: "9mobile Mobile Data", biller_code: "BIL107", label_name: "Mobile Phone Number" },
  ],
  CABLE: [
    { name: "DSTV Subscription", biller_code: "BIL108", label_name: "Smartcard Number" },
    { name: "GOTV Subscription", biller_code: "BIL109", label_name: "Smartcard/IUC Number" },
    { name: "StarTimes Subscription", biller_code: "BIL110", label_name: "Smartcard Number" },
  ],
  UTILITY: [
    { name: "Ikeja Electric Prepaid", biller_code: "BIL111", label_name: "Meter Number" },
    { name: "Eko Electric Prepaid", biller_code: "BIL112", label_name: "Meter Number" },
    { name: "Abuja Electric Prepaid", biller_code: "BIL113", label_name: "Meter Number" },
    { name: "Kano Electric Prepaid", biller_code: "BIL114", label_name: "Meter Number" },
  ],
  INTERNET: [
    { name: "Smile Internet", biller_code: "BIL115", label_name: "Smile Account Number" },
    { name: "Spectranet Internet", biller_code: "BIL116", label_name: "Spectranet Account ID" },
  ],
  BETTING: [
    { name: "Bet9ja", biller_code: "BIL117", label_name: "Bet9ja User ID" },
    { name: "SportyBet", biller_code: "BIL118", label_name: "SportyBet Phone/User ID" },
    { name: "Nairabet", biller_code: "BIL119", label_name: "Nairabet Customer ID" },
  ],
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = (url.searchParams.get("category") || "AIRTIME").toUpperCase();
    const country = url.searchParams.get("country") || "NG";
    const authHeader = req.headers.get("Authorization") || "";

    const fallback = MOCK_BILLERS[category] || MOCK_BILLERS.AIRTIME;

    // Fetch the unified cached active bill directory from the payment-gateway
    const response = await fetch("https://etechglobalhub.duckdns.org/api/flutterwave/bills/directory", {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const resData = await response.json();
    const directory = (resData.data || []) as Array<{
      biller_code: string;
      item_code: string;
      biller_name: string;
      item_name: string;
      country: string;
      amount: number;
      is_airtime: boolean;
      label_name: string;
    }>;

    if (directory.length === 0) {
      return NextResponse.json({ success: true, data: fallback });
    }

    // Filter by country and category type
    let filtered = directory.filter(item => item.country === country);

    if (category === "AIRTIME") {
      filtered = filtered.filter(item => item.is_airtime === true);
    } else if (category === "MOBILEDATA") {
      filtered = filtered.filter(item => item.is_airtime === false && item.biller_name.toLowerCase().includes("data"));
    } else if (category === "CABLE") {
      filtered = filtered.filter(item => item.biller_name.toLowerCase().includes("tv") || item.biller_name.toLowerCase().includes("dstv") || item.biller_name.toLowerCase().includes("gotv") || item.biller_name.toLowerCase().includes("startimes"));
    } else if (category === "UTILITY") {
      filtered = filtered.filter(item => item.biller_name.toLowerCase().includes("electric") || item.biller_name.toLowerCase().includes("power"));
    } else if (category === "INTERNET") {
      filtered = filtered.filter(item => item.biller_name.toLowerCase().includes("internet") || item.biller_name.toLowerCase().includes("smile") || item.biller_name.toLowerCase().includes("spectranet"));
    } else if (category === "BETTING") {
      filtered = filtered.filter(item => item.biller_name.toLowerCase().includes("bet") || item.biller_name.toLowerCase().includes("nairabet"));
    }

    // Deduplicate to extract unique billers
    const uniqueBillerCodes = Array.from(new Set(filtered.map(b => b.biller_code)));
    const finalBillers = uniqueBillerCodes.map((code, idx) => {
      const bMatch = filtered.find(b => b.biller_code === code)!;
      return {
        id: idx + 1,
        name: bMatch.biller_name,
        biller_code: code,
        label_name: bMatch.label_name || "Customer Number",
      };
    });

    return NextResponse.json({ success: true, data: finalBillers.length > 0 ? finalBillers : fallback });
  } catch {
    const url = new URL(req.url);
    const category = (url.searchParams.get("category") || "AIRTIME").toUpperCase();
    return NextResponse.json({ success: true, data: MOCK_BILLERS[category] || MOCK_BILLERS.AIRTIME });
  }
}
