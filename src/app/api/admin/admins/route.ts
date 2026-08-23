import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";
import { createFirebaseAuthUser, setFirebaseAuthCustomClaims, getFirebaseAuthUserByEmail } from "@/lib/firebase-auth-rest";

const GRANULAR_PERMISSIONS_CATALOG = [
  { key: "users.view", label: "View Users", category: "Users" },
  { key: "users.edit", label: "Edit Users", category: "Users" },
  { key: "users.suspend", label: "Suspend Users", category: "Users" },
  { key: "transactions.view", label: "View Transactions", category: "Transactions" },
  { key: "deposits.view", label: "View Deposits", category: "Deposits" },
  { key: "withdrawals.view", label: "View Withdrawals", category: "Withdrawals" },
  { key: "withdrawals.approve", label: "Approve Withdrawals", category: "Withdrawals" },
  { key: "withdrawals.reject", label: "Reject Withdrawals", category: "Withdrawals" },
  { key: "kyc.view", label: "View KYC", category: "KYC" },
  { key: "kyc.approve", label: "Approve KYC", category: "KYC" },
  { key: "kyc.reject", label: "Reject KYC", category: "KYC" },
  { key: "vtu.view", label: "View VTU", category: "VTU" },
  { key: "vtu.manage", label: "Manage VTU", category: "VTU" },
  { key: "virtual_accounts.view", label: "View Virtual Accounts", category: "Virtual Accounts" },
  { key: "virtual_accounts.manage", label: "Manage Virtual Accounts", category: "Virtual Accounts" },
  { key: "admins.view", label: "View Administrators", category: "Admin Management" },
  { key: "admins.create", label: "Create Administrators", category: "Admin Management" },
  { key: "admins.edit", label: "Edit Administrators", category: "Admin Management" },
  { key: "admins.disable", label: "Disable Administrators", category: "Admin Management" },
  { key: "admins.delete", label: "Delete Administrators", category: "Admin Management" },
  { key: "admins.change_role", label: "Change Admin Roles", category: "Admin Management" },
  { key: "settings.view", label: "View Settings", category: "Settings" },
  { key: "settings.manage", label: "Manage Settings", category: "Settings" },
];

async function logAdminAction(payload: {
  adminUid: string;
  adminEmail: string;
  action: string;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  result?: string;
  ipAddress?: string;
  userAgent?: string;
}) {
  try {
    const now = new Date().toISOString();
    await adminDb.collection("admin_audit_logs").add({
      ...payload,
      timestamp: now,
      createdAt: now,
    });
  } catch (err: any) {
    console.warn("[Admin Audit Log Error]:", err.message);
  }
}

export async function GET(req: Request) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    // Return list of admins from admin_users collection
    const snap = await adminDb.collection("admin_users").orderBy("createdAt", "desc").get();
    const admins: any[] = [];
    snap.forEach((doc) => {
      admins.push({ uid: doc.id, ...doc.data() });
    });

    return NextResponse.json({
      success: true,
      admins,
      catalog: GRANULAR_PERMISSIONS_CATALOG,
      callerRole: auth.role,
    });
  } catch (err: any) {
    console.error("[Admin Management GET Error]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to fetch administrator directory." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await verifyAdminAuth(req);
    if (!auth.isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const callerRole = (auth.role || "").toLowerCase();
    const isSuperAdmin = callerRole === "super_admin" || auth.email === "abdulkadir123shaba@gmail.com";

    if (!isSuperAdmin) {
      return NextResponse.json({ error: "Forbidden: Only Super Admins can manage administrator accounts." }, { status: 403 });
    }

    const body = await req.json();
    const { action, adminData } = body;
    const now = new Date().toISOString();

    if (action === "create_admin") {
      const { email, password, displayName, phoneNumber, role, permissions } = adminData || {};
      if (!email || !email.includes("@")) {
        return NextResponse.json({ error: "Valid administrator email address is required." }, { status: 400 });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      let cleanPhone = String(phoneNumber || "").trim().replace(/[^\d+]/g, "");
      if (cleanPhone && cleanPhone.startsWith("0")) {
        cleanPhone = "+234" + cleanPhone.slice(1);
      } else if (cleanPhone && !cleanPhone.startsWith("+") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
        cleanPhone = "+234" + cleanPhone;
      }

      // Check if admin already exists
      const existingSnap = await adminDb.collection("admin_users").where("email", "==", cleanEmail).limit(1).get();
      if (!existingSnap.empty) {
        return NextResponse.json({ error: "An administrator with this email already exists." }, { status: 400 });
      }

      // Create or look up in Firebase Authentication via dependency-free REST API
      let firebaseUid = "";

      const existingUser = await getFirebaseAuthUserByEmail(cleanEmail);
      if (existingUser) {
        firebaseUid = existingUser.uid;
      } else {
        if (!password || password.length < 6) {
          return NextResponse.json({ error: "Password must be at least 6 characters long." }, { status: 400 });
        }
        const createdUser = await createFirebaseAuthUser({
          email: cleanEmail,
          password,
          displayName: displayName || cleanEmail.split("@")[0],
        });
        firebaseUid = createdUser.uid;
      }

      const newAdminRecord = {
        uid: firebaseUid,
        email: cleanEmail,
        displayName: displayName || cleanEmail.split("@")[0],
        phoneNumber: cleanPhone,
        role: role || "admin",
        permissions: Array.isArray(permissions) ? permissions : ["users.view", "transactions.view", "kyc.view"],
        status: "active",
        createdBy: auth.email || auth.uid,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: "",
        mfaEnabled: false,
      };

      await adminDb.collection("admin_users").doc(firebaseUid).set(newAdminRecord);

      // Set Custom Claims via dependency-free REST API
      try {
        await setFirebaseAuthCustomClaims(firebaseUid, {
          admin: true,
          role: role || "admin",
        });
      } catch (e: any) {
        console.warn("[Create Admin Claims Warning]:", e.message);
      }

      await logAdminAction({
        adminUid: auth.uid,
        adminEmail: auth.email || "",
        action: "create_admin",
        resource: "admin_users",
        resourceId: firebaseUid,
        newValue: newAdminRecord,
        result: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: `Administrator ${cleanEmail} created successfully!`,
        admin: newAdminRecord,
      });

    } else if (action === "update_admin") {
      const { targetUid, role, permissions, status, displayName, phoneNumber } = adminData || {};
      if (!targetUid) {
        return NextResponse.json({ error: "Target administrator UID is required." }, { status: 400 });
      }

      const targetRef = adminDb.collection("admin_users").doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        return NextResponse.json({ error: "Administrator document not found." }, { status: 404 });
      }

      const currentData = targetSnap.data() || {};

      // Guard against disabling or deleting the last Super Admin
      if (currentData.role === "super_admin" && (role && role !== "super_admin" || status === "disabled")) {
        const superAdminSnap = await adminDb.collection("admin_users")
          .where("role", "==", "super_admin")
          .where("status", "==", "active")
          .get();

        if (superAdminSnap.size <= 1) {
          return NextResponse.json({ error: "Cannot disable or demote the last remaining active Super Admin." }, { status: 400 });
        }
      }

      const updatePayload: any = {
        updatedAt: now,
      };

      if (role !== undefined) updatePayload.role = role;
      if (permissions !== undefined) updatePayload.permissions = permissions;
      if (status !== undefined) updatePayload.status = status;
      if (displayName !== undefined) updatePayload.displayName = displayName;
      if (phoneNumber !== undefined) {
        let cleanPhone = String(phoneNumber || "").trim().replace(/[^\d+]/g, "");
        if (cleanPhone && cleanPhone.startsWith("0")) {
          cleanPhone = "+234" + cleanPhone.slice(1);
        } else if (cleanPhone && !cleanPhone.startsWith("+") && (cleanPhone.length === 10 || cleanPhone.length === 11)) {
          cleanPhone = "+234" + cleanPhone;
        }
        updatePayload.phoneNumber = cleanPhone;
      }

      await targetRef.update(updatePayload);

      await logAdminAction({
        adminUid: auth.uid,
        adminEmail: auth.email || "",
        action: "update_admin",
        resource: "admin_users",
        resourceId: targetUid,
        oldValue: currentData,
        newValue: updatePayload,
        result: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: "Administrator account updated successfully!",
      });

    } else if (action === "delete_admin") {
      const { targetUid } = adminData || {};
      if (!targetUid) {
        return NextResponse.json({ error: "Target administrator UID is required." }, { status: 400 });
      }

      const targetRef = adminDb.collection("admin_users").doc(targetUid);
      const targetSnap = await targetRef.get();
      if (!targetSnap.exists) {
        return NextResponse.json({ error: "Administrator document not found." }, { status: 404 });
      }

      const currentData = targetSnap.data() || {};

      if (currentData.role === "super_admin") {
        const superAdminSnap = await adminDb.collection("admin_users")
          .where("role", "==", "super_admin")
          .where("status", "==", "active")
          .get();

        if (superAdminSnap.size <= 1) {
          return NextResponse.json({ error: "Cannot delete the last remaining active Super Admin." }, { status: 400 });
        }
      }

      await targetRef.delete();

      await logAdminAction({
        adminUid: auth.uid,
        adminEmail: auth.email || "",
        action: "delete_admin",
        resource: "admin_users",
        resourceId: targetUid,
        oldValue: currentData,
        result: "SUCCESS",
      });

      return NextResponse.json({
        success: true,
        message: "Administrator removed successfully!",
      });

    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }

  } catch (err: any) {
    console.error("[Admin Management POST Error]:", err.message);
    return NextResponse.json({ error: err.message || "Operation failed." }, { status: 500 });
  }
}
