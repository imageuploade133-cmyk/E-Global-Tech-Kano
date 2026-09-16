import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

export async function POST(req: Request) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const { token, platform } = body;

    if (!token) {
      return NextResponse.json({ error: "FCM token is required." }, { status: 400 });
    }

    // Resolve server-authoritative active session ID directly from Firestore users/{uid}
    let authoritativeSessionId: string | null = null;
    if (uid !== "mock-uid" && uid !== "mock-admin-uid") {
      try {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (userDoc.exists) {
          authoritativeSessionId = userDoc.data()?.activeSessionId || null;
        }
      } catch (docErr: any) {
        console.warn(`[FCM API Warning] Failed to fetch active session for user ${uid}:`, docErr.message);
      }
    }

    // Fall back to validated X-Session-ID header if Firestore lookup returned null
    if (!authoritativeSessionId) {
      authoritativeSessionId = req.headers.get("X-Session-ID") || req.headers.get("x-session-id") || null;
    }

    const cleanToken = token.trim();
    const tokenDocId = `${uid}_${Buffer.from(cleanToken).toString("base64").slice(0, 100)}`; // Safe, uniform composite key
    const tokenRef = adminDb.collection("fcm_tokens").doc(tokenDocId);

    const now = new Date().toISOString();

    await tokenRef.set({
      userId: uid,
      token: cleanToken,
      platform: platform || "web",
      sessionId: authoritativeSessionId,
      createdAt: now,
      updatedAt: now,
    }, { merge: true });

    console.log(`[FCM API] Registered token for user ${uid}. Token ID: ${tokenDocId}`);

    return NextResponse.json({ success: true, message: "FCM Token registered successfully." });

  } catch (err: any) {
    console.error("[FCM API Exception] Register failed:", err.message);
    return NextResponse.json({ error: "Internal processing error." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "FCM token is required." }, { status: 400 });
    }

    const cleanToken = token.trim();
    const tokenDocId = `${uid}_${Buffer.from(cleanToken).toString("base64").slice(0, 100)}`;
    const tokenRef = adminDb.collection("fcm_tokens").doc(tokenDocId);

    await tokenRef.delete();

    console.log(`[FCM API] Unregistered token for user ${uid}. Token ID: ${tokenDocId}`);

    return NextResponse.json({ success: true, message: "FCM Token unregistered successfully." });

  } catch (err: any) {
    console.error("[FCM API Exception] Unregister failed:", err.message);
    return NextResponse.json({ error: "Internal processing error." }, { status: 500 });
  }
}
