import { NextResponse } from "next/server";
import { adminDb, adminAuth } from "@/lib/firebase-admin";

// POST /api/estate/favorites - Toggle save property
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
    const { propertyId } = body;

    if (!propertyId) {
      return NextResponse.json({ error: "Property ID is required." }, { status: 400 });
    }

    const favRef = adminDb.collection("estate_favorites").doc(`${uid}_${propertyId}`);
    const favSnap = await favRef.get();

    if (favSnap.exists) {
      await favRef.delete();
      return NextResponse.json({
        success: true,
        saved: false,
        message: "Property removed from saved favorites.",
      });
    } else {
      await favRef.set({
        id: favRef.id,
        userId: uid,
        propertyId,
        savedAt: new Date().toISOString(),
      });
      return NextResponse.json({
        success: true,
        saved: true,
        message: "Property saved to favorites.",
      });
    }
  } catch (err: any) {
    console.error("[POST /api/estate/favorites Error]:", err.message);
    return NextResponse.json({ error: "Failed to toggle saved favorite." }, { status: 500 });
  }
}

// POST /api/estate/reports - Report listing
export async function PUT(req: Request) {
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
    const { propertyId, propertyTitle, reason, details } = body;

    if (!propertyId || !reason) {
      return NextResponse.json({ error: "Property ID and report reason are required." }, { status: 400 });
    }

    const reportRef = adminDb.collection("estate_reports").doc();
    const reportData = {
      id: reportRef.id,
      propertyId,
      propertyTitle: propertyTitle || "Reported Property",
      reporterUserId: uid,
      reason: String(reason).trim(),
      details: details ? String(details).trim() : "",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    await reportRef.set(reportData);

    return NextResponse.json({
      success: true,
      message: "Property report submitted for admin investigation.",
      report: reportData,
    });
  } catch (err: any) {
    console.error("[PUT /api/estate/reports Error]:", err.message);
    return NextResponse.json({ error: "Failed to submit property report." }, { status: 500 });
  }
}
