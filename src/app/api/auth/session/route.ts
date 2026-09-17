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
    let prevDeviceName: string | null = null;
    let prevCreatedAt: string | null = null;

    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (userDoc.exists) {
        const data = userDoc.data() || {};
        previousSessionId = data.activeSessionId || null;
        prevDeviceName = data.activeSessionDevice || null;
        prevCreatedAt = data.activeSessionCreatedAt || null;
      }

      transaction.set(userRef, {
        activeSessionId: newSessionId,
        activeSessionCreatedAt: nowIso,
        activeSessionDevice: deviceName,
        activeSessionUserAgent: userAgent,
        previousSessionDevice: prevDeviceName,
        previousSessionRevokedAt: nowIso,
        updatedAt: nowIso,
      }, { merge: true });
    });

    // Target FCM tokens belonging to the previous active session strictly; EXCLUDE new active device session ID
    if (previousSessionId && previousSessionId !== newSessionId) {
      try {
        const tokensSnap = await adminDb.collection("fcm_tokens").where("userId", "==", uid).get();
        if (!tokensSnap.empty) {
          const messaging = getMessaging();

          for (const docSnap of tokensSnap.docs) {
            const tData = docSnap.data();
            // STRICT RULE: Send session_revoked strictly to tokens matching previousSessionId (and NEVER newSessionId)
            if (tData.token && tData.sessionId && tData.sessionId === previousSessionId && tData.sessionId !== newSessionId) {
              await messaging.send({
                token: tData.token,
                notification: {
                  title: "⚠️ Account Signed In On Another Device",
                  body: "Your account was accessed from a new device. This session has been logged out.",
                },
                data: {
                  type: "session_revoked",
                  title: "⚠️ Account Signed In On Another Device",
                  body: "Your account was accessed from a new device. This session has been logged out.",
                },
                android: { priority: "high" },
                apns: { payload: { aps: { sound: "default" } } },
              }).catch(() => {});
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

    const providedSessionId = req.headers.get("X-Session-ID") || req.headers.get("x-session-id");
    if (!providedSessionId) {
      return NextResponse.json({ error: "REVOKED_SESSION: Missing session ID header." }, { status: 401 });
    }

    const userRef = adminDb.collection("users").doc(uid);
    const nowIso = new Date().toISOString();

    // Atomically clear active session ONLY IF the provided X-Session-ID matches the currently active server session
    let revoked = false;
    await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("REVOKED_SESSION: User account document missing.");
      }

      const activeSessionId = userDoc.data()?.activeSessionId;

      if (!activeSessionId || activeSessionId !== providedSessionId) {
        throw new Error("REVOKED_SESSION: Cannot revoke an inactive or already replaced session.");
      }

      transaction.update(userRef, {
        activeSessionId: null,
        activeSessionRevokedAt: nowIso,
        updatedAt: nowIso,
      });

      revoked = true;
    });

    console.log(`[Session API] Atomically revoked active session for user ${uid}`);

    return NextResponse.json({
      success: true,
      message: "Session revoked successfully.",
    });

  } catch (err: any) {
    console.error("[Session API Delete Exception]:", err.message);
    const status = err.message && err.message.includes("REVOKED_SESSION") ? 401 : 500;
    return NextResponse.json({ error: err.message || "Failed to revoke session." }, { status });
  }
}
