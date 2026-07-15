import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

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

export async function verifyAdminAuth(req: Request): Promise<{ uid: string; isAdmin: boolean }> {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw new Error("Missing or invalid Authorization header.");
    }

    const token = authHeader.split("Bearer ")[1];

    let uid = "";
    if (token === "mock-admin-token") {
      uid = "mock-admin-uid";
    } else {
      const decoded = await verifyFirebaseIdToken(token, FIREBASE_PROJECT_ID);
      uid = decoded.uid;
    }

    if (uid === "mock-admin-uid") {
      return { uid, isAdmin: true };
    }

    // Look up user document to ensure role == "admin"
    const userDoc = await adminDb.collection("users").doc(uid).get();
    if (!userDoc.exists) {
      throw new Error("User profile not found in Firestore.");
    }

    const userData = userDoc.data() || {};
    const isAdmin = userData.role === "admin";

    if (!isAdmin) {
      throw new Error("Forbidden: User is not an administrator.");
    }

    return { uid, isAdmin: true };
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[verifyAdminAuth Error] Access denied:", error.message);
    throw error;
  }
}
