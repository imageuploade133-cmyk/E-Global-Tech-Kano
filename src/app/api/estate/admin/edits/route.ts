import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

// GET /api/estate/admin/edits - List property edit logs for admin review
export async function GET(req: Request) {
  try {
    const authResult = await requireAdminPermission(req, "estate.view");
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || "ALL";

    let queryRef: FirebaseFirestore.Query = adminDb.collection("estate_property_edits");

    if (status !== "ALL") {
      queryRef = queryRef.where("status", "==", status);
    }

    const snap = await queryRef.limit(100).get();
    const edits: any[] = [];

    snap.forEach((docSnap) => {
      const data = docSnap.data();
      edits.push({
        id: docSnap.id,
        ...data,
      });
    });

    edits.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, edits });
  } catch (err: any) {
    console.error("[GET /api/estate/admin/edits Error]:", err.message);
    return NextResponse.json({ error: "Failed to fetch property edit logs." }, { status: 500 });
  }
}

// POST /api/estate/admin/edits - Admin approve, reject/revert, or flag property edit
export async function POST(req: Request) {
  try {
    const authResult = await requireAdminPermission(req, "estate.manage");
    if (!authResult.authorized) {
      return NextResponse.json({ error: authResult.error }, { status: authResult.status });
    }

    const body = await req.json();
    const { editLogId, action, adminNote } = body;

    if (!editLogId || !action) {
      return NextResponse.json({ error: "Edit log ID and action are required." }, { status: 400 });
    }

    const editLogRef = adminDb.collection("estate_property_edits").doc(editLogId);
    const editSnap = await editLogRef.get();

    if (!editSnap.exists) {
      return NextResponse.json({ error: "Property edit record not found." }, { status: 404 });
    }

    const editData = editSnap.data() || {};
    const propertyId = editData.propertyId;
    const nowIso = new Date().toISOString();

    const propDocRef = adminDb.collection("estate_properties").doc(propertyId);

    if (action === "approve") {
      await editLogRef.update({
        status: "APPROVED",
        adminNote: adminNote ? String(adminNote).trim() : "Property update approved by administrator.",
        updatedAt: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: "Property edit approved successfully.",
      });
    }

    if (action === "reject") {
      // Revert property back to previous snapshot data
      if (editData.previousData) {
        await propDocRef.set(
          {
            ...editData.previousData,
            updatedAt: nowIso,
          },
          { merge: true }
        );
      }

      await editLogRef.update({
        status: "REJECTED",
        adminNote: adminNote ? String(adminNote).trim() : "Property update rejected and reverted by administrator.",
        updatedAt: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: "Property edit rejected and changes reverted successfully.",
      });
    }

    if (action === "flag") {
      // Flag property and move back to PENDING_REVIEW with admin note
      await propDocRef.update({
        status: "PENDING_REVIEW",
        rejectionReason: adminNote ? String(adminNote).trim() : "Listing update flagged. Please contact Support.",
        updatedAt: nowIso,
      });

      await editLogRef.update({
        status: "FLAGGED",
        adminNote: adminNote ? String(adminNote).trim() : "Listing edit flagged to contact Support.",
        updatedAt: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: "Property edit flagged to contact Support successfully.",
      });
    }

    return NextResponse.json({ error: "Invalid action type." }, { status: 400 });
  } catch (err: any) {
    console.error("[POST /api/estate/admin/edits Error]:", err.message);
    return NextResponse.json({ error: "Failed to process property edit moderation." }, { status: 500 });
  }
}
