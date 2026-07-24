import { NextResponse } from "next/server";
import { MOCK_ITEMS } from "./config";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const biller_code = url.searchParams.get("biller_code") || "";
    const country = url.searchParams.get("country") || "NG";
    const authHeader = req.headers.get("Authorization") || "";

    const fallback = MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }];

    // Dynamically retrieve live/test bill items from Flutterwave via the payment gateway proxy
    const response = await fetch("https://etechglobalhub.duckdns.org/api/flutterwave/proxy", {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        method: "get",
        endpoint: `/bill-items?biller_code=${biller_code}&country=${country}`,
      }),
    });

    if (!response.ok) {
      return NextResponse.json({ success: true, data: fallback });
    }

    const resData = await response.json();
    const finalItems = resData.data || resData || fallback;
    return NextResponse.json({ success: true, data: finalItems });
  } catch {
    const url = new URL(req.url);
    const biller_code = url.searchParams.get("biller_code") || "";
    return NextResponse.json({ success: true, data: MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }] });
  }
}
