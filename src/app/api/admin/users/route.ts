import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb, adminApp } from "@/lib/firebase-admin";

// Ensure a safe list of permissible checkable flags
const ALLOWED_PERMISSIONS = [
  "can_transact",
  "can_verify_kyc",
  "can_manage_gateways",
  "can_view_audit_logs",
  "can_moderate_users"
];

export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    // Mock response for playtesting sessions
    if (uid === "mock-admin-uid") {
      const mockUsers = [
        {
          uid: "mock-user-1",
          name: "JULES VERNE",
          email: "jules@example.com",
          phoneNumber: "+2348011223344",
          role: "admin",
          permissions: ["can_transact", "can_view_audit_logs", "can_manage_gateways"],
          balance: 750000,
          createdAt: new Date().toISOString()
        },
        {
          uid: "mock-user-2",
          name: "STEVE COLLINS",
          email: "steve@example.com",
          phoneNumber: "+2348122334455",
          role: "user",
          permissions: ["can_transact"],
          balance: 45000,
          createdAt: new Date().toISOString()
        }
      ];
      return NextResponse.json({ success: true, users: mockUsers });
    }

    // Fetch up to 100 users securely from Firestore
    const usersSnap = await adminDb.collection("users")
      .orderBy("createdAt", "desc")
      .limit(100)
      .get();

    const users = usersSnap.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        name: data.name || data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "USER",
        email: data.email || "",
        phoneNumber: data.phoneNumber || "",
        role: data.role || "user",
        permissions: data.permissions || [],
        balance: data.balance || 0,
        createdAt: data.createdAt || new Date().toISOString()
      };
    });

    return NextResponse.json({ success: true, users });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Users API] Error:", error.message);
    return NextResponse.json({ error: "Unauthorized or server error", details: error.message }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const body = await req.json();
    const { action } = body;

    // Actions: "create" or "update"
    if (action === "create") {
      const {
        firstName,
        lastName,
        email,
        password,
        phonePrefix,
        phoneNumber,
        balance,
        role,
        permissions
      } = body;

      // Validate inputs
      if (!firstName || firstName.trim().length < 2) {
        return NextResponse.json({ error: "First name must be at least 2 characters." }, { status: 400 });
      }
      if (!lastName || lastName.trim().length < 2) {
        return NextResponse.json({ error: "Last name must be at least 2 characters." }, { status: 400 });
      }
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Invalid email address format." }, { status: 400 });
      }
      if (!password || password.length < 6) {
        return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanPhone = `${phonePrefix || ""}${phoneNumber || ""}`.trim();

      // Check permissions safety
      const cleanPermissions = (permissions || []).filter((p: string) => ALLOWED_PERMISSIONS.includes(p));

      // Mock session playtesting
      if (uid === "mock-admin-uid") {
        return NextResponse.json({
          success: true,
          message: "Mock user successfully simulated!",
          user: {
            uid: `mock-uid-${Date.now()}`,
            name: `${firstName} ${lastName}`.toUpperCase(),
            email: cleanEmail,
            phoneNumber: cleanPhone,
            role: role || "user",
            permissions: cleanPermissions,
            balance: Number(balance) || 0,
            createdAt: new Date().toISOString()
          }
        });
      }

      // Check existence
      const emailQuery = await adminDb.collection("users")
        .where("email", "==", cleanEmail)
        .limit(1)
        .get();

      if (!emailQuery.empty) {
        return NextResponse.json({ error: "A user with this email address already exists." }, { status: 400 });
      }

      // Create in Firebase Authentication
      const { getAuth } = await import("firebase-admin/auth");
      const userRecord = await getAuth(adminApp).createUser({
        email: cleanEmail,
        password,
        displayName: `${firstName.trim()} ${lastName.trim()}`.toUpperCase(),
      });

      // Synchronize role Custom Claims instantly
      await getAuth(adminApp).setCustomUserClaims(userRecord.uid, {
        admin: role === "admin"
      });

      // Write user document to Firestore
      await adminDb.collection("users").doc(userRecord.uid).set({
        uid: userRecord.uid,
        name: `${firstName.trim()} ${lastName.trim()}`.toUpperCase(),
        firstName: firstName.trim().toUpperCase(),
        lastName: lastName.trim().toUpperCase(),
        email: cleanEmail,
        phoneNumber: cleanPhone,
        balance: Number(balance) || 0,
        bonusBalance: 0,
        role: role || "user",
        permissions: cleanPermissions,
        createdAt: new Date().toISOString()
      });

      return NextResponse.json({
        success: true,
        message: "User created and authenticated successfully!",
        uid: userRecord.uid
      });

    } else if (action === "update") {
      const { targetUid, role, permissions } = body;

      if (!targetUid) {
        return NextResponse.json({ error: "Missing user identifier." }, { status: 400 });
      }

      const cleanPermissions = (permissions || []).filter((p: string) => ALLOWED_PERMISSIONS.includes(p));

      if (uid === "mock-admin-uid") {
        return NextResponse.json({
          success: true,
          message: "Mock user permissions updated successfully!"
        });
      }

      // Update Firestore user document
      await adminDb.collection("users").doc(targetUid).update({
        role: role || "user",
        permissions: cleanPermissions
      });

      // Update Firebase Auth Custom Claims
      const { getAuth } = await import("firebase-admin/auth");
      await getAuth(adminApp).setCustomUserClaims(targetUid, {
        admin: role === "admin"
      });

      return NextResponse.json({
        success: true,
        message: "User role & permissions updated and synchronized successfully!"
      });

    } else {
      return NextResponse.json({ error: "Invalid action request." }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Users Post API] Error:", error.message);
    return NextResponse.json({ error: "Operation failed", details: error.message }, { status: 500 });
  }
}
