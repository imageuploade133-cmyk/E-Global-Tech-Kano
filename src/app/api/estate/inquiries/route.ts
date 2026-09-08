import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// GET /api/estate/inquiries - Fetch inquiries sent to seller
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
    const snap = await adminDb
      .collection("estate_inquiries")
      .where("sellerId", "==", uid)
      .limit(50)
      .get();

    const inquiries: any[] = [];
    snap.forEach((docSnap) => {
      inquiries.push({ id: docSnap.id, ...docSnap.data() });
    });

    return NextResponse.json({ success: true, inquiries });
  } catch (err: any) {
    console.error("[GET /api/estate/inquiries Error]:", err.message);
    return NextResponse.json({ error: "Failed to fetch inquiries." }, { status: 500 });
  }
}

// POST /api/estate/inquiries - Submit an inquiry for a property
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

    const { propertyId, propertyTitle, sellerId, message, userName, userPhone, userEmail } = body;

    if (!propertyId || !sellerId || !message) {
      return NextResponse.json(
        { error: "Property ID, Seller ID, and inquiry message are required." },
        { status: 400 }
      );
    }

    const newInquiryRef = adminDb.collection("estate_inquiries").doc();
    const newInquiry = {
      id: newInquiryRef.id,
      propertyId,
      propertyTitle: propertyTitle || "Property Inquiry",
      sellerId,
      userId: uid,
      userName: userName || decoded.email || "Interested Buyer/Tenant",
      userPhone: userPhone || "",
      userEmail: userEmail || decoded.email || "",
      message: String(message).trim(),
      status: "NEW",
      createdAt: new Date().toISOString(),
    };

    await newInquiryRef.set(newInquiry);

    return NextResponse.json({
      success: true,
      message: "Inquiry sent to property agent/seller successfully.",
      inquiry: newInquiry,
    });
  } catch (err: any) {
    console.error("[POST /api/estate/inquiries Error]:", err.message);
    return NextResponse.json({ error: "Failed to submit property inquiry." }, { status: 500 });
  }
}
