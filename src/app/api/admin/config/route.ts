import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const docSnap = await adminDb.collection("config").doc("app").get();
    if (docSnap.exists) {
      return NextResponse.json({ success: true, config: docSnap.data() });
    }
    return NextResponse.json({ success: false, error: "Config document not found." }, { status: 404 });
  } catch (err: any) {
    console.error("[Admin Config GET API] Error:", err.message);
    return NextResponse.json({ error: "Unauthorized or server exception", details: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const updates = await req.json();

    // Secure Firestore write with await - wait for Firestore to confirm success before returning success
    await adminDb.collection("config").doc("app").set(updates, { merge: true });

    // Fetch the updated document to return authoritative server data
    const updatedDoc = await adminDb.collection("config").doc("app").get();

    return NextResponse.json({
      success: true,
      message: "Branding and app configuration updated successfully!",
      config: updatedDoc.data()
    });
  } catch (err: any) {
    console.error("[Admin Config POST API] Error:", err.message);
    return NextResponse.json({ error: "Operation failed", details: err.message }, { status: 500 });
  }
}
