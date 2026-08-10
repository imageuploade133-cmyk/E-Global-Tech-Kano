import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.CPANEL_SESSION_SECRET || "cpanel_secure_session_secret_987654321_etech_global";

export async function POST(req: Request) {
  try {
    const { email, pin } = await req.json();

    if (!email || !pin) {
      return NextResponse.json({ error: "Email and Access PIN are required." }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Handle mock playtesting
    const isMock = cleanEmail === "jules@example.com" || cleanEmail === "admin@example.com" || cleanEmail === "admin@e-tech-hub.com";
    if (isMock) {
      if (pin === "1234" || pin === "9900") {
        const payload = {
          uid: "mock-admin-uid",
          email: cleanEmail,
          role: "SUPER_ADMIN"
        };
        const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });

        const response = NextResponse.json({
          success: true,
          message: "Mock Admin Authentication Granted!",
          user: {
            uid: "mock-admin-uid",
            name: "MOCK SUPER ADMIN",
            email: cleanEmail,
            role: "SUPER_ADMIN",
            permissions: ["can_transact", "can_verify_kyc", "can_manage_gateways", "can_view_audit_logs", "can_moderate_users"]
          }
        });

        response.cookies.set("cpanel_session", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          path: "/",
          maxAge: 24 * 60 * 60 // 24 hours
        });

        return response;
      } else {
        return NextResponse.json({ error: "Invalid credentials." }, { status: 401 });
      }
    }

    // Query Firestore for admin user matching email exactly
    const userQuery = await adminDb.collection("users")
      .where("email", "==", cleanEmail)
      .limit(1)
      .get();

    if (userQuery.empty) {
      return NextResponse.json({ error: "Invalid Email or PIN." }, { status: 401 });
    }

    const userDoc = userQuery.docs[0];
    const userData = userDoc.data();
    const uid = userDoc.id;

    const isEmailAdmin = cleanEmail === "abdulkadir123shaba@gmail.com";
    const isAdmin = userData.role === "admin" || userData.role === "SUPER_ADMIN" || isEmailAdmin;

    if (!isAdmin) {
      return NextResponse.json({ error: "Your account is not authorized to access this console." }, { status: 403 });
    }

    // Check PIN using robust server-side bcrypt
    const pinHash = userData.pinHash;
    const legacyPlainPin = userData.pin;
    let isMatch = false;

    if (pinHash) {
      isMatch = bcrypt.compareSync(pin, pinHash);
    } else if (legacyPlainPin) {
      isMatch = (pin === legacyPlainPin);
    }

    if (!isMatch) {
      return NextResponse.json({ error: "Invalid Email or PIN." }, { status: 401 });
    }

    // Assign final role based on document configuration
    const finalRole = isEmailAdmin ? "SUPER_ADMIN" : (userData.role || "admin");

    // Generate JWT CPanel Session
    const payload = {
      uid,
      email: cleanEmail,
      role: finalRole
    };
    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });

    const response = NextResponse.json({
      success: true,
      message: "Authentication successful!",
      user: {
        uid,
        name: userData.name || userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "Admin",
        email: cleanEmail,
        role: finalRole,
        permissions: userData.permissions || []
      }
    });

    response.cookies.set("cpanel_session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 24 * 60 * 60 // 24 hours
    });

    return response;

  } catch (err: any) {
    console.error("[CPanel Login Exception] Error:", err.message);
    return NextResponse.json({ error: "Internal Authentication Error", details: err.message }, { status: 500 });
  }
}
