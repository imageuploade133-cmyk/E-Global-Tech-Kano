import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_STORE_CATEGORIES } from "@/lib/store-defaults";

export async function GET() {
  try {
    const docSnap = await adminDb.collection("config").doc("store_data").get();
    const data = docSnap.exists ? docSnap.data() || {} : {};

    const categories = Array.isArray(data.categories) && data.categories.length > 0
      ? data.categories
      : DEFAULT_STORE_CATEGORIES;

    const rawItems = Array.isArray(data.items) ? data.items : [];
    const visibleItems = rawItems.filter((i: any) => !i.isHidden);

    return NextResponse.json({
      success: true,
      items: visibleItems,
      slides: Array.isArray(data.slides) ? data.slides : [],
      categories,
      settings: data.settings || { storeName: "E-Tech Store", storeLogoUrl: "", borderColor: "#FC7A00", hideBorders: false },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Store GET Error]:", error.message);

    return NextResponse.json({
      success: true,
      items: [],
      slides: [],
      categories: DEFAULT_STORE_CATEGORIES,
      settings: { storeName: "E-Tech Store", storeLogoUrl: "", borderColor: "#FC7A00", hideBorders: false },
    });
  }
}
