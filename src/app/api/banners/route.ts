import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const page = searchParams.get("page"); // optional target page filter

    const bannersSnap = await adminDb.collection("banners").orderBy("createdAt", "desc").get();
    let banners = bannersSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    if (page) {
      banners = banners.filter((b: any) => b.targetPage === "all" || b.targetPage === page);
    }

    return NextResponse.json({ success: true, banners });
  } catch (err: any) {
    console.error("[Public Banners GET Exception]:", err.message);
    return NextResponse.json({ error: "Failed to fetch banners", details: err.message }, { status: 500 });
  }
}
