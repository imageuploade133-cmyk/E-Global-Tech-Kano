import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

// GET: Fetch all reviews for admin management (including hidden reviews)
export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId");

    let query: any = adminDb.collection("store_reviews");
    if (productId) {
      query = query.where("productId", "==", productId);
    }

    const reviewsSnap = await query.get();
    const reviews = reviewsSnap.docs.map((doc: any) => ({
      id: doc.id,
      ...doc.data(),
    }));

    reviews.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, reviews });
  } catch (err: any) {
    console.error("[Admin Store Reviews GET Error]:", err.message);
    return NextResponse.json({ error: "Operation failed", details: err.message }, { status: 500 });
  }
}

// POST: Admin Actions (Reply, Hide/Show, Delete)
export async function POST(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action, reviewId, reply, isHidden } = body;

    if (!reviewId) {
      return NextResponse.json({ error: "Review ID is required." }, { status: 400 });
    }

    const ref = adminDb.collection("store_reviews").doc(reviewId);

    if (action === "reply") {
      await ref.set(
        {
          adminReply: {
            message: (reply || "").trim(),
            repliedAt: new Date().toISOString(),
            repliedBy: uid,
          },
        },
        { merge: true }
      );
      return NextResponse.json({ success: true, message: "Review reply saved." });
    }

    if (action === "toggle_hide") {
      await ref.set({ isHidden: Boolean(isHidden) }, { merge: true });
      return NextResponse.json({
        success: true,
        message: isHidden ? "Review hidden from public store." : "Review visible on public store.",
      });
    }

    if (action === "delete") {
      await ref.delete();
      return NextResponse.json({ success: true, message: "Review deleted successfully." });
    }

    return NextResponse.json({ error: "Invalid action requested." }, { status: 400 });
  } catch (err: any) {
    console.error("[Admin Store Reviews POST Error]:", err.message);
    return NextResponse.json({ error: "Operation failed", details: err.message }, { status: 500 });
  }
}
