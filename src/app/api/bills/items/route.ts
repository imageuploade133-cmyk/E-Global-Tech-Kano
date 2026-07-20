import { NextResponse } from "next/server";
import { MOCK_ITEMS } from "./config";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const biller_code = url.searchParams.get("biller_code") || "";
    const country = url.searchParams.get("country") || "NG";

    const isSandbox = !FLW_SECRET_KEY || FLW_SECRET_KEY.startsWith("FLWSECK_TEST-");

    const fallback = MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }];

    if (isSandbox) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const response = await fetch(`https://api.flutterwave.com/v3/bill-items?biller_code=${biller_code}&country=${country}`, {
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
    const biller_code = url.searchParams.get("biller_code") || "";
    return NextResponse.json({ success: true, data: MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }] });
  }
}
