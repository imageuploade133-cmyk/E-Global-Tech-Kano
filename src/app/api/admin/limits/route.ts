import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";

export async function GET(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const searchQuery = (searchParams.get("search") || searchParams.get("q") || "").trim().toLowerCase();

    if (!searchQuery) {
      return NextResponse.json({ success: true, users: [] });
    }

    const usersSnap = await adminDb.collection("users").get();
    const results: any[] = [];

    usersSnap.forEach((doc) => {
      const data = doc.data();
      const email = (data.email || "").toLowerCase();
      const phone = (data.phoneNumber || data.phone || "").toLowerCase();
      const name = (data.name || data.displayName || `${data.firstName || ""} ${data.lastName || ""}`).toLowerCase();
      const bvn = (data.bvn || data.nin || "").toLowerCase();

      if (
        email.includes(searchQuery) ||
        phone.includes(searchQuery) ||
        name.includes(searchQuery) ||
        bvn.includes(searchQuery)
      ) {
        results.push({
          uid: doc.id,
          name: data.name || data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "User",
          email: data.email || "",
          phoneNumber: data.phoneNumber || data.phone || "",
          dailyTransferLimit: data.dailyTransferLimit !== undefined ? Number(data.dailyTransferLimit) : 500000,
          maxSingleTransferLimit: data.maxSingleTransferLimit !== undefined ? Number(data.maxSingleTransferLimit) : 200000,
          dailyDepositLimit: data.dailyDepositLimit !== undefined ? Number(data.dailyDepositLimit) : 1000000,
          unlimitedTransfers: !!data.unlimitedTransfers,
          unlimitedDeposits: !!data.unlimitedDeposits,
          updatedAt: data.updatedAt || "",
        });
      }
    });

    return NextResponse.json({
      success: true,
      users: results,
      count: results.length,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Limits GET Error]:", error.message);
    return NextResponse.json({ error: "Failed to search user limits", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const {
      targetUid,
      uid,
      dailyTransferLimit,
      maxSingleTransferLimit,
      dailyDepositLimit,
      unlimitedTransfers,
      unlimitedDeposits,
    } = body;

    const userUid = targetUid || uid;

    if (!userUid) {
      return NextResponse.json({ error: "Missing required parameter: userUid" }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(userUid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return NextResponse.json({ error: "Target user profile not found." }, { status: 404 });
    }

    const updatePayload: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (dailyTransferLimit !== undefined) updatePayload.dailyTransferLimit = Number(dailyTransferLimit);
    if (maxSingleTransferLimit !== undefined) updatePayload.maxSingleTransferLimit = Number(maxSingleTransferLimit);
    if (dailyDepositLimit !== undefined) updatePayload.dailyDepositLimit = Number(dailyDepositLimit);
    if (unlimitedTransfers !== undefined) updatePayload.unlimitedTransfers = !!unlimitedTransfers;
    if (unlimitedDeposits !== undefined) updatePayload.unlimitedDeposits = !!unlimitedDeposits;

    await userRef.set(updatePayload, { merge: true });

    return NextResponse.json({
      success: true,
      message: "User account limits updated successfully!",
      userUid,
      ...updatePayload,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Limits POST Error]:", error.message);
    return NextResponse.json({ error: "Failed to update user account limits", details: error.message }, { status: 500 });
  }
}
