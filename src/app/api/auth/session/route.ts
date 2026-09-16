import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

export async function POST(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    if (!uid) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const deviceName = body.deviceName || body.platform || "Web/Mobile Browser";
    const userAgent = req.headers.get("user-agent") || "Unknown";

    // Generate cryptographically secure unpredictable session ID
    const newSessionId = `sess_${uid}_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const nowIso = new Date().toISOString();

    const userRef = adminDb.collection("users").doc(uid);

    // Atomically replace active session inside Firestore transaction
    let previousSessionId: string | null = null;
    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const data = userDoc.data() || {};
        previousSessionId = data.activeSessionId || null;
      }

      transaction.set(userRef, {
        activeSessionId: newSessionId,
        activeSessionCreatedAt: nowIso,
        activeSessionDevice: deviceName,
        activeSessionUserAgent: userAgent,
        updatedAt: nowIso,
      }, { merge: true });
    });

    // Target FCM tokens belonging to the previous device/session strictly; EXCLUDE new active device session ID
    if (previousSessionId && previousSessionId !== newSessionId) {
      try {
        const tokensSnap = await adminDb.collection("fcm_tokens").where("userId", "==", uid).get();
        if (!tokensSnap.empty) {
          const messaging = getMessaging();

          for (const docSnap of tokensSnap.docs) {
            const tData = docSnap.data();
            // STRICT RULE: Target the previous active session strictly; NEVER send revocation push to new active session tokens
            if (tData.token && tData.sessionId !== newSessionId) {
              if (!tData.sessionId || tData.sessionId === previousSessionId) {
                await messaging.send({
                  token: tData.token,
                  notification: {
                    title: "⚠️ Session Revoked",
                    body: "Your account was signed in on another device. You have been logged out on this device.",
                  },
                  data: {
                    type: "session_revoked",
                    title: "⚠️ Session Revoked",
                    body: "Your account was signed in on another device. You have been logged out on this device.",
                  },
                  android: { priority: "high" },
                  apns: { payload: { aps: { sound: "default" } } },
                }).catch(() => {});
              }
            }
          }
        }
      } catch (fcmErr) {
        console.warn("[Session API] Realtime session revocation push notice exception:", fcmErr);
      }
    }

    console.log(`[Session API] Atomically created new active session for user ${uid}. Session ID: ${newSessionId}`);

    return NextResponse.json({
      success: true,
      sessionId: newSessionId,
      message: "Active session established successfully.",
    });

  } catch (err: any) {
    console.error("[Session API Exception]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to establish active session." }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    if (!uid) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    await userRef.set({
      activeSessionId: null,
      activeSessionRevokedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    console.log(`[Session API] Atomically revoked active session for user ${uid}`);

    return NextResponse.json({
      success: true,
      message: "Session revoked successfully.",
    });

  } catch (err: any) {
    console.error("[Session API Delete Exception]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to revoke session." }, { status: 500 });
  }
}
