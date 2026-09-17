import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
const GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

// Helper to mask sensitive destinations (e.g. 23480***1234 or j***s@gmail.com)
function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 8) return "••••••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "••••@••••.com";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

function hashOtp(otp: string): string {
  return crypto.createHash("sha256").update(otp.trim()).digest("hex");
}

async function dispatchOtpToChannel(
  channel: "whatsapp" | "email",
  destination: string,
  rawOtp: string,
  uid: string,
  idToken: string
): Promise<boolean> {
  if (channel === "whatsapp") {
    try {
      const res = await fetch(`${GATEWAY_URL}/api/auth/send-otp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": GATEWAY_API_KEY,
        },
        body: JSON.stringify({
          phoneNumber: destination,
          type: "new_device_login",
          customMessage: `Your E-Global Pay New Device Security Login Verification Code is *${rawOtp}*. Valid for 5 minutes. Do not share with anyone.`
        }),
      });
      return res.ok;
    } catch (err) {
      console.error("[New Device OTP] WhatsApp dispatch error:", err);
      return false;
    }
  } else {
    try {
      const { sendEmail } = await import("@/lib/email-service");
      const result = await sendEmail({
        to: destination,
        subject: "Security Alert: New Device Login Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #FC7A00; margin-bottom: 16px;">E-Global Pay Security Guard</h2>
            <p>Hello,</p>
            <p>A new device is attempting to log into your account. Use the 6-digit code below to verify and authorize this device:</p>
            <div style="background-color: #f4f4f4; padding: 15px; font-size: 26px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #333; margin: 20px 0; border-radius: 4px;">
              ${rawOtp}
            </div>
            <p>This verification code expires in 5 minutes. Do not share this code with anyone.</p>
            <p style="color: #d9534f; font-size: 12px; margin-top: 24px;">If you did not initiate this login, please change your PIN and contact support immediately.</p>
          </div>
        `,
      });
      return result.success;
    } catch (err) {
      console.error("[New Device OTP] Email dispatch error:", err);
      return false;
    }
  }
}

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    if (!uid) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "establish";
    const deviceName = body.deviceName || body.platform || "Web/Mobile Browser";
    const userAgent = req.headers.get("user-agent") || "Unknown";
    const now = Date.now();
    const nowIso = new Date().toISOString();

    const userRef = adminDb.collection("users").doc(uid);

    // =========================================================================
    // ACTION 1: VERIFY NEW DEVICE OTP CHALLENGE & ACTIVATION
    // =========================================================================
    if (action === "verify_challenge") {
      const { challengeId, otpCode } = body;
      if (!challengeId || !otpCode) {
        return NextResponse.json({ error: "Missing required parameters: challengeId and otpCode." }, { status: 400 });
      }

      const challengeRef = adminDb.collection("new_device_challenges").doc(challengeId);

      let newSessionId = `sess_${uid}_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
      let previousSessionId: string | null = null;
      let prevDeviceName: string | null = null;

      await adminDb.runTransaction(async (transaction) => {
        const challengeSnap = await transaction.get(challengeRef);
        if (!challengeSnap.exists) {
          throw new Error("CHALLENGE_INVALID: Security challenge document not found.");
        }

        const chData = challengeSnap.data() || {};

        if (chData.uid !== uid) {
          throw new Error("CHALLENGE_INVALID: Challenge does not belong to authenticated user.");
        }

        if (chData.consumed === true) {
          throw new Error("CHALLENGE_CONSUMED: This security challenge code has already been used.");
        }

        if (now > chData.expiresAtMs) {
          throw new Error("CHALLENGE_EXPIRED: Verification code has expired. Please request a new code.");
        }

        if (chData.attempts >= 3) {
          throw new Error("CHALLENGE_LOCKED: Too many incorrect attempts. Please generate a new security challenge.");
        }

        // Validate cryptographically hashed OTP code
        const hashedSubmitted = hashOtp(String(otpCode));
        if (hashedSubmitted !== chData.otpHash) {
          const updatedAttempts = (chData.attempts || 0) + 1;
          transaction.update(challengeRef, {
            attempts: updatedAttempts,
            lastFailedAt: nowIso,
          });

          const remaining = Math.max(0, 3 - updatedAttempts);
          throw new Error(`INCORRECT_OTP: Incorrect verification code. You have ${remaining} attempt(s) remaining.`);
        }

        // Mark challenge consumed atomically
        transaction.update(challengeRef, {
          consumed: true,
          consumedAt: nowIso,
          verified: true,
        });

        // Read previous active session metadata before replacing
        const userDoc = await transaction.get(userRef);
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          previousSessionId = uData.activeSessionId || null;
          prevDeviceName = uData.activeSessionDevice || null;
        }

        // Atomically activate new session
        transaction.set(userRef, {
          activeSessionId: newSessionId,
          activeSessionCreatedAt: nowIso,
          activeSessionDevice: deviceName,
          activeSessionUserAgent: userAgent,
          previousSessionDevice: prevDeviceName,
          previousSessionRevokedAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true });

        // Audit Log
        const auditRef = adminDb.collection("security_audit_logs").doc();
        transaction.set(auditRef, {
          uid,
          action: "NEW_DEVICE_SESSION_ACTIVATED",
          challengeId,
          deviceName,
          previousSessionId,
          newSessionId,
          timestamp: nowIso,
        });
      });

      // Target FCM tokens belonging to the previous active session strictly; EXCLUDE new active device session ID
      if (previousSessionId && previousSessionId !== newSessionId) {
        try {
          const tokensSnap = await adminDb.collection("fcm_tokens").where("userId", "==", uid).get();
          if (!tokensSnap.empty) {
            const messaging = getMessaging();

            for (const docSnap of tokensSnap.docs) {
              const tData = docSnap.data();
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

      console.log(`[Session API] Successfully verified OTP and activated new session for user ${uid}. Session ID: ${newSessionId}`);

      return NextResponse.json({
        success: true,
        sessionId: newSessionId,
        message: "Device verification successful. Active session established.",
      });
    }

    // =========================================================================
    // ACTION 2: RESEND / SWITCH OTP CHANNEL
    // =========================================================================
    if (action === "resend_challenge") {
      const { challengeId, selectedChannel } = body;
      if (!challengeId) {
        return NextResponse.json({ error: "Missing required parameter: challengeId" }, { status: 400 });
      }

      const challengeRef = adminDb.collection("new_device_challenges").doc(challengeId);
      const challengeSnap = await challengeRef.get();

      if (!challengeSnap.exists) {
        return NextResponse.json({ error: "Invalid challenge ID." }, { status: 400 });
      }

      const chData = challengeSnap.data() || {};

      if (chData.uid !== uid) {
        return NextResponse.json({ error: "Forbidden: Challenge ownership mismatch." }, { status: 403 });
      }

      if (chData.consumed === true) {
        return NextResponse.json({ error: "Challenge already consumed. Please sign in again." }, { status: 400 });
      }

      // Check 60-second resend cooldown
      const lastSentAtMs = chData.lastSentAtMs || 0;
      if (now - lastSentAtMs < 60000) {
        const remaining = Math.ceil((60000 - (now - lastSentAtMs)) / 1000);
        return NextResponse.json({ error: `Please wait ${remaining} second(s) before requesting a new code.` }, { status: 429 });
      }

      const userSnap = await userRef.get();
      const userData = userSnap.exists ? userSnap.data() || {} : {};

      const registeredPhone = (userData.phoneNumber || userData.phone || "").trim();
      const registeredEmail = (userData.email || authResult.email || "").trim();

      const targetChannel = (selectedChannel === "email" && registeredEmail) ? "email" : "whatsapp";
      const targetDestination = targetChannel === "email" ? registeredEmail : registeredPhone;

      if (!targetDestination) {
        return NextResponse.json({ error: `No registered ${targetChannel} destination found on this profile.` }, { status: 400 });
      }

      const rawOtp = crypto.randomInt(100000, 999999).toString();
      const otpHash = hashOtp(rawOtp);
      const expiresAtMs = now + 5 * 60 * 1000; // 5 minutes

      await challengeRef.set({
        otpHash,
        channel: targetChannel,
        destination: targetDestination,
        lastSentAtMs: now,
        expiresAtMs,
        attempts: 0,
        updatedAt: nowIso,
      }, { merge: true });

      const dispatched = await dispatchOtpToChannel(targetChannel, targetDestination, rawOtp, uid, idToken);

      if (!dispatched) {
        return NextResponse.json({ error: `Failed to deliver verification code via ${targetChannel}. Please try again later.` }, { status: 502 });
      }

      return NextResponse.json({
        success: true,
        message: `New verification code sent via ${targetChannel.toUpperCase()}.`,
        challengeId,
        channel: targetChannel,
        maskedDestination: targetChannel === "email" ? maskEmail(targetDestination) : maskPhone(targetDestination),
        cooldownSeconds: 60,
      });
    }

    // =========================================================================
    // ACTION 3: INITIAL ESTABLISHMENT (DETECT EXISTING SESSION & GATE WITH OTP)
    // =========================================================================
    const userSnap = await userRef.get();
    const userData = userSnap.exists ? userSnap.data() || {} : {};

    const activeSessionId = userData.activeSessionId as string | undefined;

    // IF NO ACTIVE SESSION EXISTS -> Normal First Device Login
    if (!activeSessionId) {
      const newSessionId = `sess_${uid}_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;

      await userRef.set({
        activeSessionId: newSessionId,
        activeSessionCreatedAt: nowIso,
        activeSessionDevice: deviceName,
        activeSessionUserAgent: userAgent,
        updatedAt: nowIso,
      }, { merge: true });

      console.log(`[Session API] Established FIRST active session for user ${uid}. Session ID: ${newSessionId}`);

      return NextResponse.json({
        success: true,
        requiresOtp: false,
        sessionId: newSessionId,
        message: "First active session established successfully.",
      });
    }

    // IF AN ACTIVE SESSION ALREADY EXISTS -> GATED NEW-DEVICE OTP CHALLENGE REQUIRED!
    console.log(`[Session API] Active session already exists for user ${uid}. Generating New-Device Security Challenge...`);

    const registeredPhone = (userData.phoneNumber || userData.phone || "").trim();
    const registeredEmail = (userData.email || authResult.email || "").trim();

    if (!registeredPhone && !registeredEmail) {
      return NextResponse.json({ error: "Security Error: No verified contact channels configured on your account. Please contact support." }, { status: 400 });
    }

    // Default channel: WhatsApp if phone exists, otherwise Email
    const defaultChannel: "whatsapp" | "email" = registeredPhone ? "whatsapp" : "email";
    const defaultDestination = defaultChannel === "whatsapp" ? registeredPhone : registeredEmail;

    const challengeId = `ch_${uid}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashOtp(rawOtp);
    const expiresAtMs = now + 5 * 60 * 1000; // 5 minutes

    const challengeDoc = {
      challengeId,
      uid,
      otpHash,
      channel: defaultChannel,
      destination: defaultDestination,
      deviceName,
      userAgent,
      attempts: 0,
      consumed: false,
      verified: false,
      createdAtMs: now,
      lastSentAtMs: now,
      expiresAtMs,
      createdAt: nowIso,
    };

    await adminDb.collection("new_device_challenges").doc(challengeId).set(challengeDoc);

    const dispatched = await dispatchOtpToChannel(defaultChannel, defaultDestination, rawOtp, uid, idToken);

    if (!dispatched) {
      await adminDb.collection("new_device_challenges").doc(challengeId).delete();
      return NextResponse.json({ error: "Failed to deliver security verification OTP. Please ensure your recovery channel is active or try again later." }, { status: 502 });
    }

    // Audit Log
    await adminDb.collection("security_audit_logs").add({
      uid,
      action: "NEW_DEVICE_CHALLENGE_CREATED",
      challengeId,
      channel: defaultChannel,
      maskedDestination: defaultChannel === "whatsapp" ? maskPhone(defaultDestination) : maskEmail(defaultDestination),
      timestamp: nowIso,
    });

    const channels = [];
    if (registeredPhone) {
      channels.push({
        type: "whatsapp",
        label: `WhatsApp (${maskPhone(registeredPhone)})`,
        masked: maskPhone(registeredPhone),
      });
    }
    if (registeredEmail) {
      channels.push({
        type: "email",
        label: `Email (${maskEmail(registeredEmail)})`,
        masked: maskEmail(registeredEmail),
      });
    }

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      challengeId,
      channel: defaultChannel,
      maskedDestination: defaultChannel === "whatsapp" ? maskPhone(defaultDestination) : maskEmail(defaultDestination),
      channels,
      cooldownSeconds: 60,
      expiresInSeconds: 300,
      message: `Security Verification Required: Verification code sent via ${defaultChannel.toUpperCase()}.`,
    });

  } catch (err: any) {
    console.error("[Session API Exception]:", err.message);
    let userMsg = err.message || "Failed to process session request.";
    if (err.message && err.message.includes("INCORRECT_OTP")) {
      userMsg = err.message.replace("INCORRECT_OTP: ", "");
      return NextResponse.json({ error: userMsg }, { status: 400 });
    }
    if (err.message && err.message.includes("CHALLENGE_")) {
      userMsg = err.message.replace(/CHALLENGE_[A-Z]+:\s*/, "");
      return NextResponse.json({ error: userMsg }, { status: 400 });
    }
    return NextResponse.json({ error: userMsg }, { status: 500 });
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
