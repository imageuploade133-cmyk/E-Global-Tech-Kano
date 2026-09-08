import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-auth-middleware";

// GET /api/estate/admin/sellers - CPanel fetch sellers
export async function GET(req: Request) {
  try {
    const authCheck = await requireAdminPermission(req, "estate.view");
    if (authCheck.error) return authCheck.error;

    const snap = await adminDb.collection("estate_sellers").limit(100).get();
    const sellers: any[] = [];

    snap.forEach((docSnap) => {
      sellers.push({ uid: docSnap.id, ...docSnap.data() });
    });

    return NextResponse.json({ success: true, sellers });
  } catch (err: any) {
    console.error("[GET /api/estate/admin/sellers Error]:", err.message);
    return NextResponse.json({ error: "Failed to fetch seller directory." }, { status: 500 });
  }
}

// POST /api/estate/admin/sellers - Verify / Reject seller agent
export async function POST(req: Request) {
  try {
    const authCheck = await requireAdminPermission(req, "estate.manage");
    if (authCheck.error) return authCheck.error;

    const body = await req.json();
    const { action, sellerUid } = body;

    if (!sellerUid || !action) {
      return NextResponse.json({ error: "Seller UID and action are required." }, { status: 400 });
    }

    const docRef = adminDb.collection("estate_sellers").doc(sellerUid);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Seller profile not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (action === "verify") {
      await docRef.update({
        isVerified: true,
        verificationStatus: "VERIFIED",
        updatedAt: nowIso,
      });
      return NextResponse.json({ success: true, message: "Seller agent verified successfully." });
    } else if (action === "reject") {
      await docRef.update({
        isVerified: false,
        verificationStatus: "REJECTED",
        updatedAt: nowIso,
      });
      return NextResponse.json({ success: true, message: "Seller agent verification rejected." });
    }

    return NextResponse.json({ error: "Invalid admin seller action." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/estate/admin/sellers Error]:", err.message);
    return NextResponse.json({ error: "Failed to update seller status." }, { status: 500 });
  }
}
