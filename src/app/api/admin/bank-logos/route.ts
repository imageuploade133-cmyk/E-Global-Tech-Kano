import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { BankService } from "@/services/bank-service";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const searchQuery = searchParams.get("search") || searchParams.get("q") || "";

    const banks = await BankService.getBanks(searchQuery);

    return NextResponse.json({
      success: true,
      banks,
      count: banks.length
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Bank Logos GET Error]:", error.message);
    return NextResponse.json({ success: true, banks: [], count: 0 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const { bankId, logoUrl } = body;

    if (!bankId) {
      return NextResponse.json({ error: "Missing required parameter: bankId" }, { status: 400 });
    }

    if (typeof logoUrl !== "string") {
      return NextResponse.json({ error: "Invalid parameter: logoUrl must be a string." }, { status: 400 });
    }

    const cleanLogoUrl = logoUrl.trim();

    // Update in Firestore
    const bankRef = adminDb.collection("banks").doc(bankId);
    await bankRef.set(
      {
        logoUrl: cleanLogoUrl || null,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    // Clear memory cache so all clients immediately receive updated logoUrl
    BankService.clearCache();

    return NextResponse.json({
      success: true,
      message: "Bank logo updated successfully!",
      bankId,
      logoUrl: cleanLogoUrl
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Bank Logos POST Error]:", error.message);
    return NextResponse.json({ error: "Failed to update bank logo", details: error.message }, { status: 500 });
  }
}
