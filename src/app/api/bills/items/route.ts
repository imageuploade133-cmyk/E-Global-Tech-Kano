import { NextResponse } from "next/server";
import { MOCK_ITEMS } from "./config";

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const biller_code = url.searchParams.get("biller_code") || "";
    const authHeader = req.headers.get("Authorization") || "";

    const fallback = MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }];

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

    // Filter items belonging to the selected biller_code
    const filteredItems = directory.filter(item => item.biller_code === biller_code);

    if (filteredItems.length === 0) {
      return NextResponse.json({ success: true, data: fallback });
    }

    // Format to standard BillItem structure expected by frontend
    const finalItems = filteredItems.map((item, idx) => ({
      id: idx + 1,
      biller_code: item.biller_code,
      name: item.item_name,
      item_code: item.item_code,
      amount: item.amount,
      is_fixed_amount: item.amount > 0,
    }));

    return NextResponse.json({ success: true, data: finalItems });
  } catch {
    const url = new URL(req.url);
    const biller_code = url.searchParams.get("biller_code") || "";
    return NextResponse.json({ success: true, data: MOCK_ITEMS[biller_code] || [{ name: "Custom Package", item_code: "ITEM_CUSTOM", amount: 0 }] });
  }
}
