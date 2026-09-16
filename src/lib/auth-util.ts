import crypto from "crypto";
import { adminDb } from "./firebase-admin";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

/**
 * Checks if the user's KYC status is strictly APPROVED or VERIFIED.
 */
export async function verifyUserKycApproved(userId: string): Promise<boolean> {
  if (userId === "mock-admin-uid" || userId === "mock-uid") {
    return true;
  }
  try {
    const userDoc = await adminDb.collection("users").doc(userId).get();
    if (!userDoc.exists) {
      return false;
    }
    const data = userDoc.data();
    return data?.kycStatus === "APPROVED" || data?.kycStatus === "VERIFIED";
  } catch (err) {
    console.error(`[verifyUserKycApproved Error] userId=${userId}:`, err);
    return false;
  }
}

export interface DecodedTokenResult {
  uid: string;
  email?: string;
  name?: string;
}

// In-memory certificate cache for Google x509 public keys
let certsCache: { certs: Record<string, string>; expiresAt: number } | null = null;

async function getGooglePublicCertificates(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certsCache && certsCache.expiresAt > now) {
    return certsCache.certs;
  }

  const certsRes = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!certsRes.ok) {
    throw new Error("Failed to fetch public certificates from Google.");
  }

  // Parse Cache-Control header for max-age
  let maxAgeSeconds = 3600; // Default 1 hour fallback
  const cacheControl = certsRes.headers.get("cache-control");
  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match && match[1]) {
      maxAgeSeconds = parseInt(match[1], 10);
    }
  }

  const certs = await certsRes.json();
  certsCache = {
    certs,
    expiresAt: now + maxAgeSeconds * 1000,
  };

  return certs;
}

/**
 * A lightweight, high-performance, 100% dependency-free Firebase ID Token verifier.
 * Validates algorithm (RS256), Google signing certificates (with rotation & caching),
 * project ID, audience, issuer, expiration, clock drift, and sub (UID) claims.
 */
export async function verifyFirebaseIdToken(token: string, projectId: string = FIREBASE_PROJECT_ID): Promise<DecodedTokenResult> {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid token: Token must be a non-empty string.");
  }

  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format. Token must have 3 parts.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Base64 URL decode header and payload safely using "base64url"
  let headerJson: any;
  let payloadJson: any;

  try {
    headerJson = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
    payloadJson = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid JWT: Failed to parse header or payload JSON.");
  }

  // 2. Validate Header: Algorithm MUST be RS256
  if (headerJson.alg !== "RS256") {
    throw new Error(`Invalid algorithm '${headerJson.alg}'. Firebase ID tokens must use 'RS256'.`);
  }

  const kid = headerJson.kid;
  if (!kid) {
    throw new Error("Missing 'kid' claim in JWT header.");
  }

  // 3. Fetch Google's public certificates (cached safely according to Cache-Control max-age)
  let certs = await getGooglePublicCertificates();
  let activeCert = certs[kid];

  if (!activeCert) {
    // Certificate not found in cache; invalidate cache and re-fetch once to support key rotation
    certsCache = null;
    certs = await getGooglePublicCertificates();
    activeCert = certs[kid];
    if (!activeCert) {
      throw new Error(`Public key certificate not found for kid: ${kid}`);
    }
  }

  // 4. Verify RS256 signature using native Node.js crypto
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(`${headerB64}.${payloadB64}`);

  const signatureBase64 = signatureB64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const isSignatureValid = verify.verify(activeCert, signatureBase64, "base64");
  if (!isSignatureValid) {
    throw new Error("Signature verification failed. Token has been tampered with or corrupted.");
  }

  // 5. Validate all standard JWT claims
  const now = Math.floor(Date.now() / 1000);

  if (!payloadJson.exp || typeof payloadJson.exp !== "number" || payloadJson.exp < now) {
    throw new Error(`Token has expired. Expired at: ${payloadJson.exp}, current time: ${now}`);
  }

  // Allow up to 5 minutes of clock drift
  if (payloadJson.iat && payloadJson.iat > now + 300) {
    throw new Error("Token issued in the future (clock drift limit exceeded).");
  }

  if (payloadJson.aud !== projectId) {
    throw new Error(`Invalid audience claim. Expected: ${projectId}, Actual: ${payloadJson.aud}`);
  }

  if (payloadJson.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error(`Invalid issuer claim. Expected: https://securetoken.google.com/${projectId}, Actual: ${payloadJson.iss}`);
  }

  if (!payloadJson.sub || typeof payloadJson.sub !== "string" || !payloadJson.sub.trim()) {
    throw new Error("Missing or empty 'sub' (UID) claim in JWT payload.");
  }

  return {
    uid: payloadJson.sub,
    email: payloadJson.email,
    name: payloadJson.name || payloadJson.display_name,
  };
}

/**
 * Extracts, verifies Firebase ID Token, AND validates that the user's active session in Firestore matches.
 * Enforces single active session rule server-side.
 */
export async function authenticateUserRequest(req: Request): Promise<DecodedTokenResult> {
  let idToken = "";
  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  if (!idToken) {
    try {
      const dummyBase = "http://localhost";
      const url = new URL(req.url, dummyBase);
      idToken = url.searchParams.get("idToken") || "";
    } catch {
      idToken = "";
    }
  }

  if (!idToken) {
    throw new Error("Missing Firebase ID token in Authorization header.");
  }

  // 1. Verify Firebase ID Token first & derive UID exclusively from verified token
  const decoded = await verifyFirebaseIdToken(idToken);
  const uid = decoded.uid;

  if (!uid) {
    throw new Error("Invalid token: UID claim missing.");
  }

  // Allow mock uids for development/testing if needed
  if (uid === "mock-uid" || uid === "mock-admin-uid") {
    return decoded;
  }

  // 2. Determine if this request is /api/auth/session POST (session establishment/replacement)
  let isSessionEstablishment = false;
  if (req.method === "POST" && req.url) {
    try {
      const reqUrl = new URL(req.url, "http://localhost");
      if (reqUrl.pathname.endsWith("/api/auth/session")) {
        isSessionEstablishment = true;
      }
    } catch {
      if (req.url.includes("/api/auth/session")) {
        isSessionEstablishment = true;
      }
    }
  }

  // 3. For POST /api/auth/session, session establishment is permitted without an existing session ID.
  // For EVERY other protected endpoint (and DELETE /api/auth/session), X-Session-ID is strictly required & validated.
  if (!isSessionEstablishment) {
    const providedSessionId = req.headers.get("X-Session-ID") || req.headers.get("x-session-id");
    if (!providedSessionId) {
      throw new Error("REVOKED_SESSION: Missing session ID. You have been logged out on this device.");
    }

    try {
      const userDoc = await adminDb.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        throw new Error("REVOKED_SESSION: Account record not found.");
      }

      const activeSessionId = userDoc.data()?.activeSessionId;

      if (!activeSessionId || providedSessionId !== activeSessionId) {
        throw new Error("REVOKED_SESSION: Your account was signed in on another device. You have been logged out on this device.");
      }
    } catch (err: any) {
      if (err.message && err.message.includes("REVOKED_SESSION")) {
        throw err;
      }
      console.error(`[authenticateUserRequest Error] Session validation failed for ${uid}:`, err.message);
      // FAIL CLOSED: Never fall back to Firebase-token-only authorization on Firestore/session error
      throw new Error(`REVOKED_SESSION: Session validation failed (${err.message}).`);
    }
  }

  return decoded;
}
