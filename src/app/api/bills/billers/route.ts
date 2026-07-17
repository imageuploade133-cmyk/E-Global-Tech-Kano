import { NextResponse } from "next/server";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

const MOCK_BILLERS: Record<string, Array<{ name: string; biller_code: string; label_name: string }>> = {
  AIRTIME: [
    { name: "MTN Airtime", biller_code: "BIL099", label_name: "Mobile Phone Number" },
    { name: "GLO Airtime", biller_code: "BIL100", label_name: "Mobile Phone Number" },
    { name: "Airtel Airtime", biller_code: "BIL101", label_name: "Mobile Phone Number" },
    { name: "9mobile Airtime", biller_code: "BIL102", label_name: "Mobile Phone Number" },
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
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || "AIRTIME";
    const country = url.searchParams.get("country") || "NG";

    const isSandbox = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST-");

    const fallback = MOCK_BILLERS[category] || MOCK_BILLERS.AIRTIME;

    if (isSandbox) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const response = await fetch(`https://api.flutterwave.com/v3/billers?category=${category}&country=${country}`, {
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const resData = await response.json();
    return NextResponse.json({ success: true, data: resData.data || fallback });
  } catch {
    const url = new URL(req.url);
    const category = url.searchParams.get("category") || "AIRTIME";
    return NextResponse.json({ success: true, data: MOCK_BILLERS[category] || MOCK_BILLERS.AIRTIME });
  }
}
