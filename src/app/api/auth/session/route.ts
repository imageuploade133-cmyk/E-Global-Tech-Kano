import { getMessaging } from "firebase-admin/messaging";
import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import crypto from "crypto";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
const GATEWAY_API_KEY = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "";

// Helper to mask sensitive destinations (e.g. 23480***1234 or j***s@gmail.com)
function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 5) return "+234****23";
  const prefix = clean.startsWith("234") ? "+234" : `+${clean.slice(0, Math.min(3, clean.length - 2))}`;
  const suffix = clean.slice(-2);
  return `${prefix}****${suffix}`;
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "••••@••••.com";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

const HMAC_SECRET = process.env.CPANEL_SESSION_SECRET || process.env.JWT_SECRET;

function hashOtp(otp: string): string {
  if (!HMAC_SECRET) {
    throw new Error("Configuration Error: CPANEL_SESSION_SECRET or JWT_SECRET is required.");
  }
  return crypto.createHmac("sha256", HMAC_SECRET).update(otp.trim()).digest("hex");
}

async function dispatchOtpToChannel(
  channel: "whatsapp" | "email",
  destination: string,
  rawOtp: string,
  uid: string
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
      const escapeHtml = (str: string) => String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
      const safeRawOtp = escapeHtml(rawOtp);

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
              ${safeRawOtp}
            </div>
            <p>This verification code expires in 5 minutes. Do not share this code with anyone.</p>
            <p style="color: #d9534f; font-size: 12px; margin-top: 24px;">If you did not initiate this login, please change your PIN and contact support immediately.</p>
          </div>
        `,
      });
      return result;
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

      const newSessionId = `sess_${uid}_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
      const txRes = await adminDb.runTransaction(async (transaction) => {
        // MUST execute ALL Firestore reads BEFORE any write operations inside a transaction
        const challengeSnap = await transaction.get(challengeRef);
        const userDoc = await transaction.get(userRef);

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

        // Validate cumulative failure limit across all resends for this challenge
        const currentTotalFailed = chData.totalFailedAttempts || chData.attempts || 0;
        if (currentTotalFailed >= 3) {
          throw new Error("CHALLENGE_LOCKED: Too many incorrect attempts. Please generate a new security challenge.");
        }

        // Validate cryptographically hashed OTP code
        const hashedSubmitted = hashOtp(String(otpCode));
        if (hashedSubmitted !== chData.otpHash) {
          const updatedAttempts = (chData.attempts || 0) + 1;
          const updatedTotalFailed = currentTotalFailed + 1;
          transaction.update(challengeRef, {
            attempts: updatedAttempts,
            totalFailedAttempts: updatedTotalFailed,
            lastFailedAt: nowIso,
          });

          const remaining = Math.max(0, 3 - updatedTotalFailed);
          throw new Error(`INCORRECT_OTP: Incorrect verification code. You have ${remaining} attempt(s) remaining.`);
        }

        // Extract previous session info from the userDoc read executed at top of transaction
        let prevSessId: string | null = null;
        let prevDevName: string | null = null;
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          prevSessId = uData.activeSessionId || null;
          prevDevName = uData.activeSessionDevice || null;
        }

        // All reads complete -> execute writes
        transaction.update(challengeRef, {
          consumed: true,
          consumedAt: nowIso,
          verified: true,
        });

        // Atomically activate new session
        transaction.set(userRef, {
          activeSessionId: newSessionId,
          activeSessionCreatedAt: nowIso,
          activeSessionDevice: deviceName,
          activeSessionUserAgent: userAgent,
          previousSessionDevice: prevDevName,
          previousSessionRevokedAt: nowIso,
          updatedAt: nowIso,
        }, { merge: true });

        // Audit Log - DO NOT write raw session IDs to audit logs
        const auditRef = adminDb.collection("security_audit_logs").doc();
        transaction.set(auditRef, {
          uid,
          action: "NEW_DEVICE_SESSION_ACTIVATED",
          challengeId,
          deviceName,
          timestamp: nowIso,
        });

        return { previousSessionId: prevSessId, prevDeviceName: prevDevName };
      });

      const previousSessionId = txRes.previousSessionId;

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

      console.log(`[Session API] Successfully verified OTP and activated new session for user ${uid}.`);

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

      // Execute race-safe transactional check and update
      const resendRes = await adminDb.runTransaction(async (transaction) => {
        const challengeSnap = await transaction.get(challengeRef);
        if (!challengeSnap.exists) {
          throw new Error("CHALLENGE_INVALID: Security challenge document not found.");
        }

        const chData = challengeSnap.data() || {};

        if (chData.uid !== uid) {
          throw new Error("CHALLENGE_INVALID: Challenge ownership mismatch.");
        }

        if (chData.consumed === true) {
          throw new Error("CHALLENGE_CONSUMED: Challenge already consumed. Please sign in again.");
        }

        const cumulativeFailures = chData.totalFailedAttempts || chData.attempts || 0;
        if (chData.attempts >= 3 || cumulativeFailures >= 3) {
          throw new Error("CHALLENGE_LOCKED: Too many failed attempts. Security challenge locked. Please generate a new login request.");
        }

        // Check 60-second resend cooldown inside transaction to prevent concurrent bypass
        const lastSentAtMs = chData.lastSentAtMs || 0;
        if (now - lastSentAtMs < 60000) {
          const remaining = Math.ceil((60000 - (now - lastSentAtMs)) / 1000);
          throw new Error(`CHALLENGE_COOLDOWN: Please wait ${remaining} second(s) before requesting a new code.`);
        }

        const userSnap = await transaction.get(userRef);
        const userData = userSnap.exists ? userSnap.data() || {} : {};

        const registeredPhone = (userData.phoneNumber || userData.phone || "").trim();
        const registeredEmail = (userData.email || authResult.email || "").trim();

        const isPhoneVerified = !!registeredPhone;
        const isEmailVerified = !!registeredEmail;

        let channelToUse: "whatsapp" | "email" = "whatsapp";
        let destToUse = "";

        // Server-side channel verification: enforce explicit phone/email verification flags
        if (selectedChannel === "email") {
          if (!isEmailVerified) {
            throw new Error("CHALLENGE_UNVERIFIED_CHANNEL: Verified email address is not configured on this account.");
          }
          channelToUse = "email";
          destToUse = registeredEmail;
        } else if (selectedChannel === "whatsapp") {
          if (!isPhoneVerified) {
            throw new Error("CHALLENGE_UNVERIFIED_CHANNEL: Verified phone number is not configured on this account.");
          }
          channelToUse = "whatsapp";
          destToUse = registeredPhone;
        } else {
          // Default based on explicit verified details
          if (isPhoneVerified) {
            channelToUse = "whatsapp";
            destToUse = registeredPhone;
          } else if (isEmailVerified) {
            channelToUse = "email";
            destToUse = registeredEmail;
          } else {
            throw new Error("CHALLENGE_NO_VERIFIED_CHANNEL: No verified contact channels available on this account.");
          }
        }

        const generatedOtp = crypto.randomInt(100000, 999999).toString();
        const otpHash = hashOtp(generatedOtp);
        const expiresAtMs = now + 5 * 60 * 1000; // 5 minutes

        transaction.update(challengeRef, {
          otpHash,
          channel: channelToUse,
          destination: destToUse,
          lastSentAtMs: now,
          expiresAtMs,
          attempts: 0, // Reset single-code attempt count for new OTP
          // totalFailedAttempts is PRESERVED and NOT reset across resends!
          updatedAt: nowIso,
        });

        return { targetChannel: channelToUse, targetDestination: destToUse, rawOtp: generatedOtp };
      });

      const { targetChannel, targetDestination, rawOtp } = resendRes;

      const dispatched = await dispatchOtpToChannel(targetChannel, targetDestination, rawOtp, uid);

      if (!dispatched) {
        return NextResponse.json({ error: `Failed to deliver verification code via ${targetChannel}. Please try again later.` }, { status: 502 });
      }

      return NextResponse.json({
        success: true,
        message: `New verification code sent via ${targetChannel.toUpperCase()}.`,
        challengeId,
        channel: targetChannel,
        maskedDestination: (targetChannel as string) === "email" ? maskEmail(targetDestination) : maskPhone(targetDestination),
        cooldownSeconds: 60,
      });
    }

    // =========================================================================
    // ACTION 3: INITIAL ESTABLISHMENT (DETECT EXISTING SESSION & GATE WITH OTP)
    // =========================================================================
    const establishResult = await adminDb.runTransaction(async (transaction) => {
      const userSnap = await transaction.get(userRef);
      const uData = userSnap.exists ? userSnap.data() || {} : {};

      const currentActiveSession = uData.activeSessionId as string | undefined;

      if (!currentActiveSession) {
        // First active session creation inside transaction
        const newSessionId = `sess_${uid}_${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
        transaction.set(userRef, {
          activeSessionId: newSessionId,
          activeSessionCreatedAt: nowIso,
          activeSessionDevice: deviceName,
          activeSessionUserAgent: userAgent,
          updatedAt: nowIso,
        }, { merge: true });

        return { establishedSessionId: newSessionId, userData: uData };
      }

      return { establishedSessionId: null, userData: uData };
    });

    const { establishedSessionId, userData } = establishResult;

    // IF NO ACTIVE SESSION EXISTED -> Normal First Device Login Established Atomically
    if (establishedSessionId) {
      console.log(`[Session API] Established FIRST active session for user ${uid}.`);

      return NextResponse.json({
        success: true,
        requiresOtp: false,
        sessionId: establishedSessionId,
        message: "First active session established successfully.",
      });
    }

    // IF AN ACTIVE SESSION ALREADY EXISTS -> GATED NEW-DEVICE OTP CHALLENGE REQUIRED!
    console.log(`[Session API] Active session already exists for user ${uid}. Generating New-Device Security Challenge...`);

    // Enforce 24-hour security hold on newly modified recovery contacts to defend against account takeover
    const lastContactChangeAt = userData.lastSecurityContactChangedAt ? new Date(userData.lastSecurityContactChangedAt).getTime() : 0;
    if (lastContactChangeAt && now - lastContactChangeAt < 24 * 60 * 60 * 1000) {
      const hoursRemaining = Math.ceil((24 * 60 * 60 * 1000 - (now - lastContactChangeAt)) / (60 * 60 * 1000));
      return NextResponse.json({
        error: `Security Hold Active: Your recovery contact was updated recently. New device logins are locked for ${hoursRemaining} hour(s) to protect against account takeover.`
      }, { status: 403 });
    }

    const registeredPhone = (userData.phoneNumber || userData.phone || "").trim();
    const registeredEmail = (userData.email || authResult.email || "").trim();

    // Verify channel has valid destination registered on account
    // Any non-empty registered phone or email associated with the authenticated account acts as a valid factor
    const isPhoneVerified = !!registeredPhone;
    const isEmailVerified = !!registeredEmail;

    if (!isPhoneVerified && !isEmailVerified) {
      return NextResponse.json({ error: "Security Error: No verified contact channels configured on your account. Please contact support." }, { status: 400 });
    }

    // Default channel selection logic:
    // - verified phone exists -> WhatsApp default
    // - verified email exists (and no verified phone) -> email default
    const defaultChannel: "whatsapp" | "email" = isPhoneVerified ? "whatsapp" : "email";
    const defaultDestination = defaultChannel === "whatsapp" ? registeredPhone : registeredEmail;

    const challengeId = `ch_${uid}_${Date.now()}_${crypto.randomBytes(8).toString("hex")}`;
    const rawOtp = crypto.randomInt(100000, 999999).toString();
    const otpHash = hashOtp(rawOtp);
    const expiresAtMs = now + 5 * 60 * 1000; // 5 minutes

    // Do NOT auto-send OTP on initial challenge creation.
    // User will select channel and click "Send Verification Code" manually.
    const challengeDoc = {
      challengeId,
      uid,
      otpHash,
      channel: defaultChannel,
      destination: defaultDestination,
      deviceName,
      userAgent,
      attempts: 0,
      totalFailedAttempts: 0,
      consumed: false,
      verified: false,
      createdAtMs: now,
      lastSentAtMs: 0, // Not sent yet
      expiresAtMs,
      createdAt: nowIso,
    };

    // Execute race-safe creation check inside a Firestore transaction
    await adminDb.runTransaction(async (transaction) => {
      const existingQuery = adminDb.collection("new_device_challenges")
        .where("uid", "==", uid)
        .where("consumed", "==", false);

      const existingSnaps = await transaction.get(existingQuery);

      if (!existingSnaps.empty) {
        for (const cDoc of existingSnaps.docs) {
          // Invalidate/consume previous unconsumed challenges for this user so only 1 active challenge exists
          transaction.update(cDoc.ref, {
            consumed: true,
            consumedReason: "SUPERSEDED_BY_NEW_CHALLENGE",
            consumedAt: nowIso,
          });
        }
      }

      const challengeRefNew = adminDb.collection("new_device_challenges").doc(challengeId);
      transaction.set(challengeRefNew, challengeDoc);
    });

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
    if (registeredEmail) {
      channels.push({
        type: "email",
        label: `Email OTP (${maskEmail(registeredEmail)})`,
        masked: maskEmail(registeredEmail),
      });
    }
    if (registeredPhone) {
      channels.push({
        type: "whatsapp",
        label: `Phone Number OTP (${maskPhone(registeredPhone)})`,
        masked: maskPhone(registeredPhone),
      });
    }

    return NextResponse.json({
      success: true,
      requiresOtp: true,
      challengeId,
      channel: defaultChannel,
      maskedDestination: defaultChannel === "whatsapp" ? maskPhone(defaultDestination) : maskEmail(defaultDestination),
      channels,
      otpSent: false,
      cooldownSeconds: 0,
      expiresInSeconds: 300,
      message: "Security Verification Required: Please select your preferred channel and click Send Code.",
    });

  } catch (err: any) {
    console.error("[Session API Exception]:", err.message);
    let userMsg = err.message || "Failed to process session request.";

    if (err.message && err.message.startsWith("CHALLENGE_COOLDOWN:")) {
      const parts = err.message.split(":");
      const remaining = parts[1] || "60";
      const challengeId = parts[2] || "";
      const channel = parts[3] || "whatsapp";
      const maskedDestination = parts[4] || "";

      return NextResponse.json({
        error: `Security Rate Limit: Please wait ${remaining} second(s) before generating a new security challenge.`,
        requiresOtp: true,
        challengeId,
        channel,
        maskedDestination,
      }, { status: 429 });
    }

    if (err.message && err.message.includes("INCORRECT_OTP")) {
      userMsg = err.message.replace("INCORRECT_OTP: ", "");
      return NextResponse.json({ error: userMsg }, { status: 400 });
    }
    if (err.message && err.message.includes("CHALLENGE_")) {
      userMsg = err.message.replace(/CHALLENGE_[A-Z_]+:\s*/, "");
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
      return true;
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
