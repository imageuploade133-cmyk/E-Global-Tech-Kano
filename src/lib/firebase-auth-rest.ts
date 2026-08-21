import crypto from "crypto";

let accessTokenCache: { token: string; expiresAt: number } | null = null;

function base64url(input: string | Buffer): string {
  const buf = typeof input === "string" ? Buffer.from(input) : input;
  return buf
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function cleanPrivateKey(key: string): string {
  if (!key) return "";
  let k = key.trim();
  // Strip outer quotes if environment variable was wrapped in quotes in .env / Vercel dashboard
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
}

/**
 * Mint a Google Identity Toolkit OAuth2 Access Token using Node.js native crypto RSA-SHA256.
 * Zero external libraries (100% immune to jwks-rsa/jose ESM/CommonJS bundle conflicts).
 */
export async function getGoogleOAuth2AccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  if (accessTokenCache && accessTokenCache.expiresAt > now + 60) {
    return accessTokenCache.token;
  }

  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    try {
      const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      clientEmail = clientEmail || parsed.client_email;
      rawPrivateKey = rawPrivateKey || parsed.private_key;
    } catch (err: any) {
      console.warn("[getGoogleOAuth2AccessToken] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", err.message);
    }
  }

  if (!clientEmail || !rawPrivateKey) {
    throw new Error("Missing FIREBASE_CLIENT_EMAIL or FIREBASE_PRIVATE_KEY environment variables.");
  }

  const privateKey = cleanPrivateKey(rawPrivateKey);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: clientEmail,
    sub: clientEmail,
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
    scope: "https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/cloud-platform",
  };

  const unsignedToken = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(payload))}`;

  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const signatureBase64 = signer.sign(privateKey, "base64");
  const signedJwt = `${unsignedToken}.${signatureBase64.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_")}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: signedJwt,
    }),
  });

  const data = await res.json();

  if (!res.ok || !data.access_token) {
    throw new Error(`Google OAuth2 Token Exchange Error: ${data.error_description || data.error || res.statusText}`);
  }

  accessTokenCache = {
    token: data.access_token,
    expiresAt: now + (data.expires_in || 3600),
  };

  return data.access_token;
}

/**
 * Creates a new user in Firebase Authentication using Google's Identity Toolkit v1 REST API.
 */
export async function createFirebaseAuthUser(params: {
  email: string;
  password?: string;
  displayName?: string;
}): Promise<{ uid: string }> {
  const token = await getGoogleOAuth2AccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: params.email,
      password: params.password,
      displayName: params.displayName,
      emailVerified: true,
    }),
  });

  const data = await res.json();
  if (!res.ok || !data.localId) {
    throw new Error(data.error?.message || "Failed to create user in Firebase Authentication REST API.");
  }

  return { uid: data.localId };
}

/**
 * Sets Custom Claims on a user account using Google's Identity Toolkit v1 REST API.
 */
export async function setFirebaseAuthCustomClaims(uid: string, customClaims: Record<string, any>): Promise<void> {
  const token = await getGoogleOAuth2AccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:${uid}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      customAttributes: JSON.stringify(customClaims),
    }),
  });

  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error?.message || "Failed to set custom claims via Identity Toolkit REST API.");
  }
}

/**
 * Lookup Firebase Auth User by Email using Google's Identity Toolkit v1 REST API.
 */
export async function getFirebaseAuthUserByEmail(email: string): Promise<{ uid: string } | null> {
  const token = await getGoogleOAuth2AccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:lookup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      email: [email],
    }),
  });

  const data = await res.json();
  if (res.ok && Array.isArray(data.users) && data.users.length > 0) {
    return { uid: data.users[0].localId };
  }

  return null;
}
