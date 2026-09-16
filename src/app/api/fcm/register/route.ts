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
    const sessionId = req.headers.get("X-Session-ID") || req.headers.get("x-session-id") || body.sessionId || null;

    if (!token) {
      return NextResponse.json({ error: "FCM token is required." }, { status: 400 });
    }

    const cleanToken = token.trim();
    const tokenDocId = `${uid}_${Buffer.from(cleanToken).toString("base64").slice(0, 100)}`; // Safe, uniform composite key
    const tokenRef = adminDb.collection("fcm_tokens").doc(tokenDocId);

    const now = new Date().toISOString();

    await tokenRef.set({
      userId: uid,
      token: cleanToken,
      platform: platform || "web",
      sessionId: sessionId || null,
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
