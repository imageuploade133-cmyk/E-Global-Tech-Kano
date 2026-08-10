import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { adminDb } from "@/lib/firebase-admin";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.CPANEL_SESSION_SECRET || "cpanel_secure_session_secret_987654321_etech_global";

export async function GET() {
  try {
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("cpanel_session")?.value;

    if (!sessionToken) {
      return NextResponse.json({ success: false, error: "No active session." }, { status: 401 });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(sessionToken, JWT_SECRET);
    } catch (jwtErr) {
      return NextResponse.json({ success: false, error: "Session expired or invalid." }, { status: 401 });
    }

    if (!decoded || !decoded.uid) {
      return NextResponse.json({ success: false, error: "Invalid session token." }, { status: 401 });
    }

    // Mock playtesting
    if (decoded.uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        user: {
          uid: "mock-admin-uid",
          name: "MOCK SUPER ADMIN",
          email: decoded.email,
          role: "SUPER_ADMIN",
          permissions: ["can_transact", "can_verify_kyc", "can_manage_gateways", "can_view_audit_logs", "can_moderate_users"]
        }
      });
    }

    // Query user doc from Firestore to verify their role/status
    const userDoc = await adminDb.collection("users").doc(decoded.uid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ success: false, error: "Admin profile not found in Firestore." }, { status: 401 });
    }

    const userData = userDoc.data() || {};
    const isEmailAdmin = decoded.email === "abdulkadir123shaba@gmail.com";
    const isAdmin = userData.role === "admin" || userData.role === "SUPER_ADMIN" || isEmailAdmin;

    if (!isAdmin) {
      return NextResponse.json({ success: false, error: "Forbidden: Not an administrator." }, { status: 403 });
    }

    const finalRole = isEmailAdmin ? "SUPER_ADMIN" : (userData.role || "admin");

    return NextResponse.json({
      success: true,
      user: {
        uid: decoded.uid,
        name: userData.name || userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Admin",
        email: decoded.email,
        role: finalRole,
        permissions: userData.permissions || []
      }
    });

  } catch (err: any) {
    console.error("[CPanel Session Exception] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
