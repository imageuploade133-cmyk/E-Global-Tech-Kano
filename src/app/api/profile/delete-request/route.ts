import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function POST(req: Request) {
  try {
    let uid = "";
    try {
      const authUser = await authenticateUserRequest(req);
      uid = authUser.uid;
    } catch {
      return NextResponse.json(
        { error: "Unauthorized: Please sign in to send account deletion requests." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "request"; // "request" or "cancel"
    const reason = String(body.reason || "User requested account deletion.").trim().slice(0, 500);

    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const nowIso = new Date().toISOString();

    if (action === "cancel") {
      await userRef.update({
        deleteRequested: false,
        deleteRequestedAt: null,
        deleteReason: null,
        updatedAt: nowIso,
      });

      return NextResponse.json({
        success: true,
        message: "Account deletion request has been successfully canceled.",
      });
    }

    await userRef.update({
      deleteRequested: true,
      deleteRequestedAt: nowIso,
      deleteReason: reason,
      updatedAt: nowIso,
    });

    // Also record in deletion requests collection for fast admin lookup
    await adminDb.collection("account_deletion_requests").doc(uid).set({
      uid,
      email: userData.email || "",
      phoneNumber: userData.phoneNumber || userData.phone || "",
      name: userData.fullName || userData.name || "E-Global User",
      requestedAt: nowIso,
      reason,
      status: "PENDING",
    }, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Your account deletion request has been submitted to CPanel Administrators.",
    });
  } catch (err: any) {
    console.error("[Delete Request API Error]:", err);
    return NextResponse.json(
      { error: err.message || "Failed to process account deletion request." },
      { status: 500 }
    );
  }
}
