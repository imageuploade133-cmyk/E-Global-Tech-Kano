import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-auth-middleware";

// GET /api/estate/admin/properties - CPanel Admin manage property directory & approvals
export async function GET(req: Request) {
  try {
    const authCheck = await requireAdminPermission(req, "estate.view");
    if (authCheck.error) return authCheck.error;

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    let queryRef: FirebaseFirestore.Query = adminDb.collection("estate_properties");

    if (status) {
      queryRef = queryRef.where("status", "==", status);
    }

    const snap = await queryRef.limit(100).get();
    const properties: any[] = [];

    snap.forEach((docSnap) => {
      properties.push({ id: docSnap.id, ...docSnap.data() });
    });

    return NextResponse.json({ success: true, properties });
  } catch (err: any) {
    console.error("[GET /api/estate/admin/properties Error]:", err.message);
    return NextResponse.json({ error: "Failed to fetch administrative properties." }, { status: 500 });
  }
}

// POST /api/estate/admin/properties - Approve / Reject / Feature property
export async function POST(req: Request) {
  try {
    const authCheck = await requireAdminPermission(req, "estate.manage");
    if (authCheck.error) return authCheck.error;

    const body = await req.json();
    const { action, propertyId, rejectionReason, featured } = body;

    if (!propertyId || !action) {
      return NextResponse.json({ error: "Property ID and action are required." }, { status: 400 });
    }

    const docRef = adminDb.collection("estate_properties").doc(propertyId);
    const docSnap = await docRef.get();

    if (!docSnap.exists) {
      return NextResponse.json({ error: "Property listing not found." }, { status: 404 });
    }

    const nowIso = new Date().toISOString();

    if (action === "approve") {
      await docRef.update({
        status: "APPROVED",
        publishedAt: nowIso,
        updatedAt: nowIso,
      });
      return NextResponse.json({ success: true, message: "Property listing approved and published." });
    } else if (action === "reject") {
      await docRef.update({
        status: "REJECTED",
        rejectionReason: rejectionReason ? String(rejectionReason).trim() : "Does not meet listing guidelines.",
        updatedAt: nowIso,
      });
      return NextResponse.json({ success: true, message: "Property listing rejected." });
    } else if (action === "toggle_featured") {
      const currentFeatured = !!docSnap.data()?.featured;
      await docRef.update({
        featured: !currentFeatured,
        updatedAt: nowIso,
      });
      return NextResponse.json({
        success: true,
        message: !currentFeatured ? "Property featured on marketplace home." : "Property unfeatured.",
      });
    } else if (action === "delete") {
      await docRef.delete();
      return NextResponse.json({ success: true, message: "Property listing deleted permanently." });
    }

    return NextResponse.json({ error: "Invalid admin property action." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/estate/admin/properties Error]:", err.message);
    return NextResponse.json({ error: "Failed to perform admin property action." }, { status: 500 });
  }
}
