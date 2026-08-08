import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const data = userDoc.data() || {};
    return NextResponse.json({
      success: true,
      dataProfitMargin: Number(data.dataProfitMargin) || 0,
      airtimeProfitMargin: Number(data.airtimeProfitMargin) || 0,
      cableProfitMargin: Number(data.cableProfitMargin) || 0,
      waecProfitMargin: Number(data.waecProfitMargin) || 0,
      electricityProfitMargin: Number(data.electricityProfitMargin) || 0,
      transferProfitMargin: Number(data.transferProfitMargin) || 0,
      bulkTransferProfitMargin: Number(data.bulkTransferProfitMargin) || 0,
    });
  } catch (err: any) {
    console.error("[VTU Profit GET Exception]:", err.message);
    return NextResponse.json({ error: "Unauthorized or backend error", details: err.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    const body = await req.json();
    const {
      dataProfitMargin,
      airtimeProfitMargin,
      cableProfitMargin,
      waecProfitMargin,
      electricityProfitMargin,
      transferProfitMargin,
      bulkTransferProfitMargin
    } = body;

    const updates: Record<string, number> = {};

    if (dataProfitMargin !== undefined) updates.dataProfitMargin = Math.max(0, Number(dataProfitMargin) || 0);
    if (airtimeProfitMargin !== undefined) updates.airtimeProfitMargin = Math.max(0, Number(airtimeProfitMargin) || 0);
    if (cableProfitMargin !== undefined) updates.cableProfitMargin = Math.max(0, Number(cableProfitMargin) || 0);
    if (waecProfitMargin !== undefined) updates.waecProfitMargin = Math.max(0, Number(waecProfitMargin) || 0);
    if (electricityProfitMargin !== undefined) updates.electricityProfitMargin = Math.max(0, Number(electricityProfitMargin) || 0);
    if (transferProfitMargin !== undefined) updates.transferProfitMargin = Math.max(0, Number(transferProfitMargin) || 0);
    if (bulkTransferProfitMargin !== undefined) updates.bulkTransferProfitMargin = Math.max(0, Number(bulkTransferProfitMargin) || 0);

    await adminDb.collection("users").doc(uid).update(updates);

    return NextResponse.json({
      success: true,
      message: "Your custom profit margins and markups have been successfully saved and applied!",
      updated: updates
    });
  } catch (err: any) {
    console.error("[VTU Profit POST Exception]:", err.message);
    return NextResponse.json({ error: "Operation failed", details: err.message }, { status: 500 });
  }
}
