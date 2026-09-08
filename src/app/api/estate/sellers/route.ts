import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// GET /api/estate/sellers - Get current user seller profile
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized access token required." }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
    }

    const uid = decoded.uid;
    const docSnap = await adminDb.collection("estate_sellers").doc(uid).get();

    if (!docSnap.exists) {
      return NextResponse.json({ success: true, seller: null });
    }

    return NextResponse.json({
      success: true,
      seller: { uid: docSnap.id, ...docSnap.data() },
    });
  } catch (err: any) {
    console.error("[GET /api/estate/sellers Error]:", err.message);
    return NextResponse.json({ error: "Failed to fetch seller profile." }, { status: 500 });
  }
}

// POST /api/estate/sellers - Register or update seller/agent profile
export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized access token required." }, { status: 401 });
    }

    const token = authHeader.split("Bearer ")[1];
    let decoded;
    try {
      decoded = await adminAuth.verifyIdToken(token);
    } catch {
      return NextResponse.json({ error: "Invalid session token." }, { status: 401 });
    }

    const uid = decoded.uid;
    const body = await req.json();

    const { displayName, agencyName, phone, email, address, avatarUrl, idDocumentUrl } = body;

    if (!displayName || !phone || !email) {
      return NextResponse.json(
        { error: "Display name, phone number, and email address are required." },
        { status: 400 }
      );
    }

    const docRef = adminDb.collection("estate_sellers").doc(uid);
    const existingSnap = await docRef.get();
    const existingData = existingSnap.data() || {};

    const nowIso = new Date().toISOString();
    const sellerPayload = {
      uid,
      displayName: String(displayName).trim(),
      agencyName: agencyName ? String(agencyName).trim() : "",
      phone: String(phone).trim(),
      email: String(email).trim().toLowerCase(),
      address: address ? String(address).trim() : "",
      avatarUrl: avatarUrl || existingData.avatarUrl || "",
      idDocumentUrl: idDocumentUrl || existingData.idDocumentUrl || "",
      isVerified: existingData.isVerified || false,
      verificationStatus: existingData.verificationStatus || "PENDING",
      createdAt: existingData.createdAt || nowIso,
      updatedAt: nowIso,
    };

    await docRef.set(sellerPayload, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Seller/Agent profile saved successfully.",
      seller: sellerPayload,
    });
  } catch (err: any) {
    console.error("[POST /api/estate/sellers Error]:", err.message);
    return NextResponse.json({ error: "Failed to save seller profile." }, { status: 500 });
  }
}
