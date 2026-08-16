import { adminDb, adminApp } from "@/lib/firebase-admin";
import crypto from "crypto";
import { cookies } from "next/headers";
import jwt from "jsonwebtoken";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";
const JWT_SECRET = process.env.CPANEL_SESSION_SECRET || "cpanel_secure_session_secret_987654321_etech_global";
const ROOT_ADMIN_EMAIL = (process.env.ROOT_ADMIN_EMAIL || "").trim().toLowerCase();
const DESIGNATED_ADMIN_EMAIL = "abdulkadir123shaba@gmail.com";

const isDesignatedAdminEmail = (email: string) => {
  const clean = String(email || "").trim().toLowerCase();
  return clean === DESIGNATED_ADMIN_EMAIL || (ROOT_ADMIN_EMAIL && clean === ROOT_ADMIN_EMAIL);
};

async function verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format. Token must have 3 parts.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // Base64 URL decode header and payload safely using "base64url"
  const headerJson = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const payloadJson = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  const kid = headerJson.kid;
  if (!kid) {
    throw new Error("Missing 'kid' claim in JWT header.");
  }

  const certsRes = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!certsRes.ok) {
    throw new Error("Failed to fetch public certificates from Google.");
  }
  const certs = await certsRes.json();
  const cert = certs[kid];
  if (!cert) {
    throw new Error(`Public key not found for kid: ${kid}`);
  }

  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(`${headerB64}.${payloadB64}`);

  const signatureBase64 = signatureB64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const isSignatureValid = verify.verify(cert, signatureBase64, "base64");
  if (!isSignatureValid) {
    throw new Error("Signature verification failed.");
  }

  const now = Math.floor(Date.now() / 1000);
  if (payloadJson.exp < now) {
    throw new Error(`Token has expired. Expired at: ${payloadJson.exp}, current time: ${now}`);
  }
  if (payloadJson.aud !== projectId) {
    throw new Error(`Invalid audience claim. Expected: ${projectId}, Actual: ${payloadJson.aud}`);
  }

  return { uid: payloadJson.sub };
}

export async function verifyAdminAuth(req: Request): Promise<{ uid: string; isAdmin: boolean; email?: string; role?: string; permissions?: string[] }> {
  try {
    // 1. Check CPanel session cookie
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get("cpanel_session")?.value;

    let uid = "";
    let tokenEmail = "";

    if (sessionToken) {
      try {
        const decoded = jwt.verify(sessionToken, JWT_SECRET) as { uid: string; email: string; role: string };
        if (decoded && decoded.uid) {
          if (decoded.uid === "mock-admin-uid") {
            return { uid: decoded.uid, isAdmin: true, email: decoded.email, role: "super_admin", permissions: ["*"] };
          }
          uid = decoded.uid;
          tokenEmail = decoded.email || "";
        }
      } catch (cookieErr: any) {
        console.warn("[verifyAdminAuth] Cookie session verification failed:", cookieErr.message);
      }
    }

    // 2. Fall back to Authorization Bearer header (Firebase ID Token or mock)
    if (!uid) {
      const authHeader = req.headers.get("Authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        if (token === "mock-admin-token") {
          return { uid: "mock-admin-uid", isAdmin: true, email: "admin@example.com", role: "super_admin", permissions: ["*"] };
        } else {
          const decoded = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
          uid = decoded.uid;
        }
      }
    }

    if (!uid) {
      throw new Error("Missing or invalid Authorization header/cookie session.");
    }

    // Look up administrator document in dedicated admin_users collection
    let adminDocSnap = await adminDb.collection("admin_users").doc(uid).get();

    // Auto-provision initial Super Admin if admin_users doc doesn't exist yet but user is designated Super Admin
    if (!adminDocSnap.exists) {
      // Look up user in main users collection or verify by email
      const mainUserSnap = await adminDb.collection("users").doc(uid).get();
      const mainUserData = mainUserSnap.exists ? mainUserSnap.data() || {} : {};
      const userEmail = (mainUserData.email || tokenEmail || "").toLowerCase().trim();

      if (isDesignatedAdminEmail(userEmail)) {
        console.log(`[verifyAdminAuth] Auto-provisioning admin_users record for initial Super Admin: ${userEmail}`);
        const now = new Date().toISOString();
        const initialAdminData = {
          uid,
          email: userEmail || DESIGNATED_ADMIN_EMAIL,
          displayName: mainUserData.name || mainUserData.displayName || "SUPER ADMIN",
          role: "super_admin",
          permissions: ["*"],
          status: "active",
          createdBy: "system_init",
          createdAt: now,
          updatedAt: now,
          lastLoginAt: now,
          mfaEnabled: false
        };
        await adminDb.collection("admin_users").doc(uid).set(initialAdminData);
        adminDocSnap = await adminDb.collection("admin_users").doc(uid).get();
      } else {
        // Fallback: Check if user doc has role == "admin" or "SUPER_ADMIN"
        const userRole = (mainUserData.role || "").trim().toLowerCase();
        if (userRole === "admin" || userRole === "super_admin") {
          const now = new Date().toISOString();
          const legacyAdminData = {
            uid,
            email: userEmail,
            displayName: mainUserData.name || "Administrator",
            role: userRole === "super_admin" ? "super_admin" : "admin",
            permissions: mainUserData.permissions || ["users.view", "transactions.view", "kyc.view"],
            status: "active",
            createdBy: "legacy_migration",
            createdAt: now,
            updatedAt: now,
            lastLoginAt: now,
            mfaEnabled: false
          };
          await adminDb.collection("admin_users").doc(uid).set(legacyAdminData);
          adminDocSnap = await adminDb.collection("admin_users").doc(uid).get();
        }
      }
    }

    if (!adminDocSnap.exists) {
      throw new Error("Forbidden: Account is not configured in admin_users.");
    }

    const adminData = adminDocSnap.data() || {};

    if (adminData.status !== "active") {
      throw new Error("Forbidden: Administrator account is disabled or suspended.");
    }

    return {
      uid,
      isAdmin: true,
      email: adminData.email || "",
      role: adminData.role || "admin",
      permissions: Array.isArray(adminData.permissions) ? adminData.permissions : []
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[verifyAdminAuth Error] Access denied:", error.message);
    throw error;
  }
}

/**
 * Programmatically generates a short-lived Firebase ID Token for a user ID
 * to securely authorize server-to-server calls to the payment-gateway VM on the fly.
 */
export async function mintFirebaseIdToken(uid: string): Promise<string> {
  // If mock admin user, return a mock token
  if (uid === "mock-admin-uid") {
    return "mock-admin-token";
  }

  const { getAuth } = await import("firebase-admin/auth");
  // 1. Create a Firebase Custom Token for the user UID
  const customToken = await getAuth(adminApp).createCustomToken(uid);

  // 2. Exchange the Custom Token for an ID Token using Google Identity Toolkit REST API
  const apiKey = "AIzaSyCuolap_m6yXWEo2csYMyGhEshsHnd1aEQ"; // from src/lib/firebase.ts
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      token: customToken,
      returnSecureToken: true
    })
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(`Failed to exchange custom token for ID token: ${err.error?.message || res.statusText}`);
  }

  const data = await res.json();
  return data.idToken;
}
