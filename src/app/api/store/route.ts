import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const docSnap = await adminDb.collection("config").doc("store_data").get();
    const data = docSnap.exists ? docSnap.data() || {} : {};

    return NextResponse.json({
      success: true,
      items: data.items || [],
      slides: data.slides || [],
      settings: data.settings || { borderColor: "#FC7A00", hideBorders: false },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Store GET Error]:", error.message);
    return NextResponse.json({ success: true, items: [], slides: [], settings: { borderColor: "#FC7A00", hideBorders: false } });
  }
}
