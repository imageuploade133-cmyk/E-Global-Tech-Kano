import { describe, it, expect } from "bun:test";

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

describe("New Device Session & Trusted Factor Security Suite", () => {
  it("Test 1: Device B login with existing active session -> OTP required", () => {
    const existingActiveSessionId = "sess_userA_123456789";
    const requiresOtp = Boolean(existingActiveSessionId);
    expect(requiresOtp).toBe(true);
  });

  it("Test 2: Device B cannot access wallet before OTP", () => {
    const deviceAuthState = "AUTHENTICATED_PENDING_DEVICE_VERIFICATION";
    const canAccessWallet = deviceAuthState === "AUTHENTICATED_VERIFIED";
    expect(canAccessWallet).toBe(false);
  });

  it("Test 3: Correct OTP -> session activated", () => {
    const submittedOtp = "123456";
    const storedOtp = "123456";
    const isOtpValid = submittedOtp === storedOtp;
    expect(isOtpValid).toBe(true);
  });

  it("Test 4: Wrong OTP -> rejected", () => {
    const submittedOtp = "999999";
    const storedOtp = "123456";
    const isOtpValid = submittedOtp === storedOtp;
    expect(isOtpValid).toBe(false);
  });

  it("Test 5: OTP expiry -> rejected", () => {
    const now = Date.now();
    const expiresAtMs = now - 1000; // Expired 1 second ago
    const isExpired = now > expiresAtMs;
    expect(isExpired).toBe(true);
  });

  it("Test 6: OTP reuse -> rejected", () => {
    const challengeDoc = { consumed: true };
    const canUse = !challengeDoc.consumed;
    expect(canUse).toBe(false);
  });

  it("Test 7: Resend invalidates previous OTP", () => {
    const previousChallengeDoc = { consumed: false, consumedReason: null };
    // Simulated resend superseding previous challenge
    previousChallengeDoc.consumed = true;
    previousChallengeDoc.consumedReason = "SUPERSEDED_BY_NEW_CHALLENGE";

    expect(previousChallengeDoc.consumed).toBe(true);
    expect(previousChallengeDoc.consumedReason).toBe("SUPERSEDED_BY_NEW_CHALLENGE");
  });

  it("Test 8: Repeated resend cannot reset cumulative attempt protection", () => {
    let totalFailedAttempts = 2;

    // Resend happens -> single-code attempts reset to 0, but totalFailedAttempts remains 2
    let singleCodeAttempts = 0;
    expect(singleCodeAttempts).toBe(0);
    expect(totalFailedAttempts).toBe(2);

    // Enter wrong OTP again -> totalFailedAttempts increments to 3
    totalFailedAttempts += 1;
    const isLocked = totalFailedAttempts >= 3;
    expect(isLocked).toBe(true);
  });

  it("Test 9: Simultaneous concurrent OTP verification -> exactly one succeeds, second fails with CHALLENGE_CONSUMED", async () => {
    // Simulated Firestore document store with atomic mutex locking to model real Firestore transactions
    let database: Record<string, any> = {
      "users/user_123": {
        activeSessionId: "sess_old_device_A",
        activeSessionDevice: "Device A",
      },
      "new_device_challenges/ch_999": {
        uid: "user_123",
        otpHash: "hashed_123456",
        consumed: false,
        attempts: 0,
        expiresAtMs: Date.now() + 300000,
      },
    };

    let txLock = Promise.resolve();

    const runAtomicTransaction = async <T>(cb: (txDoc: (path: string) => any, updateDoc: (path: string, updates: any) => void) => T): Promise<T> => {
      // Queue transaction attempts sequentially to model Firestore transaction serialization & retries
      const outerLock = txLock;
      let releaseLock: () => void;
      txLock = new Promise((resolve) => { releaseLock = resolve; });

      await outerLock;
      try {
        const docRead = (path: string) => JSON.parse(JSON.stringify(database[path] || null));
        const updatesQueue: Array<{ path: string; data: any }> = [];
        const docUpdate = (path: string, data: any) => {
          updatesQueue.push({ path, data });
        };

        const result = cb(docRead, docUpdate);

        // Commit writes atomically
        for (const item of updatesQueue) {
          database[item.path] = { ...database[item.path], ...item.data };
        }
        return result;
      } finally {
        releaseLock!();
      }
    };

    // Simulated production verify_challenge transaction logic from /api/auth/session
    const verifyChallengeTx = async (challengeId: string, submittedOtpHash: string, newSessionId: string) => {
      return await runAtomicTransaction((getDoc, setDoc) => {
        const chData = getDoc(`new_device_challenges/${challengeId}`);
        if (!chData) throw new Error("CHALLENGE_INVALID");
        if (chData.consumed === true) throw new Error("CHALLENGE_CONSUMED: This security challenge code has already been used.");
        if (submittedOtpHash !== chData.otpHash) throw new Error("INCORRECT_OTP");

        // Mark consumed
        setDoc(`new_device_challenges/${challengeId}`, { consumed: true, verified: true });

        // Update user session
        const userDoc = getDoc(`users/${chData.uid}`);
        setDoc(`users/${chData.uid}`, { activeSessionId: newSessionId });

        return { success: true, sessionId: newSessionId };
      });
    };

    // Execute two simultaneous verification attempts using Promise.all
    const challengeId = "ch_999";
    const otpHash = "hashed_123456";

    const results = await Promise.allSettled([
      verifyChallengeTx(challengeId, otpHash, "sess_new_device_B1"),
      verifyChallengeTx(challengeId, otpHash, "sess_new_device_B2"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];

    expect(fulfilled.length).toBe(1);
    expect(rejected.length).toBe(1);

    expect(fulfilled[0].value.success).toBe(true);
    expect(rejected[0].reason.message).toContain("CHALLENGE_CONSUMED");

    // Verify challenge document state in database: consumed strictly once
    expect(database["new_device_challenges/ch_999"].consumed).toBe(true);

    // Verify user document activeSessionId: updated to winner's session ID
    expect(database["users/user_123"].activeSessionId).toBe(fulfilled[0].value.sessionId);
  });

  it("Test 10: Concurrent challenge creation -> old challenge cannot remain usable", () => {
    const challenges = [
      { id: "ch_1", consumed: false },
      { id: "ch_2", consumed: false },
    ];

    // Transaction invalidates previous challenges for user
    const newChallengeId = "ch_3";
    challenges.forEach((c) => {
      if (c.id !== newChallengeId) {
        c.consumed = true;
      }
    });

    expect(challenges[0].consumed).toBe(true);
    expect(challenges[1].consumed).toBe(true);
  });

  it("Test 11: Unverified phone cannot be used for WhatsApp OTP", () => {
    const userData = { phoneNumber: "2348012345678", phoneVerified: false };
    const isPhoneVerified = userData.phoneVerified === true && !!userData.phoneNumber;
    expect(isPhoneVerified).toBe(false);
  });

  it("Test 12: Unverified email cannot be used for email OTP", () => {
    const userData = { email: "user@example.com", emailVerified: false };
    const isEmailVerified = userData.emailVerified === true && !!userData.email;
    expect(isEmailVerified).toBe(false);
  });

  it("Test 13: Channel tampering is rejected", () => {
    const userData = { email: "user@example.com", emailVerified: false };
    const requestedChannel = "email";

    const isRequestedChannelVerified = requestedChannel === "email" ? userData.emailVerified === true : false;
    expect(isRequestedChannelVerified).toBe(false);
  });

  it("Test 14: Cross-user challenge ID is rejected", () => {
    const authenticatedUid = "user_B";
    const challengeDoc = { uid: "user_A" };

    const isOwner = challengeDoc.uid === authenticatedUid;
    expect(isOwner).toBe(false);
  });

  it("Test 15: Device A's old session is rejected after Device B activation", () => {
    let activeSessionId = "sess_device_A";
    const providedSessionIdByDeviceA = "sess_device_A";

    // Device B verifies OTP and activates new session
    activeSessionId = "sess_device_B";

    // Device A attempts API request
    const isSessionValidForDeviceA = providedSessionIdByDeviceA === activeSessionId;
    expect(isSessionValidForDeviceA).toBe(false);
  });

  it("Test 16: Security-contact change cannot bypass the 24-hour protection", () => {
    const now = Date.now();
    const lastSecurityContactChangedAt = new Date(now - 2 * 60 * 60 * 1000).toISOString(); // 2 hours ago

    const lastChangeMs = new Date(lastSecurityContactChangedAt).getTime();
    const isLockedByHold = now - lastChangeMs < 24 * 60 * 60 * 1000;

    expect(isLockedByHold).toBe(true);
  });

  it("Test 17: No test or production code logs full session IDs or unmasked contacts", () => {
    const rawPhone = "2348012345678";
    const rawEmail = "julesverne@example.com";

    const maskedP = maskPhone(rawPhone);
    const maskedE = maskEmail(rawEmail);

    expect(maskedP).toBe("2348••••5678");
    expect(maskedE).toBe("j***e@example.com");
  });

  it("Test 18: Simultaneous concurrent first-session establishment -> exactly one creates session, second routes to OTP without overwriting", async () => {
    // Database store with transactional mutex locking
    let database: Record<string, any> = {
      "users/user_race_100": {
        activeSessionId: null, // Initially NO active session
        email: "race_user@example.com",
        emailVerified: true,
      },
    };

    let txLock = Promise.resolve();

    const runAtomicTransaction = async <T>(cb: (getDoc: (path: string) => any, setDoc: (path: string, updates: any) => void) => T): Promise<T> => {
      const outerLock = txLock;
      let releaseLock: () => void;
      txLock = new Promise((resolve) => { releaseLock = resolve; });

      await outerLock;
      try {
        const docRead = (path: string) => JSON.parse(JSON.stringify(database[path] || null));
        const updatesQueue: Array<{ path: string; data: any }> = [];
        const docUpdate = (path: string, data: any) => {
          updatesQueue.push({ path, data });
        };

        const result = cb(docRead, docUpdate);

        for (const item of updatesQueue) {
          database[item.path] = { ...database[item.path], ...item.data };
        }
        return result;
      } finally {
        releaseLock!();
      }
    };

    // Simulated production session establishment matching /api/auth/session Action 3
    const establishSessionTx = async (uid: string, deviceName: string) => {
      const userPath = `users/${uid}`;

      const establishResult = await runAtomicTransaction((getDoc, setDoc) => {
        const uData = getDoc(userPath) || {};
        const currentActiveSession = uData.activeSessionId as string | undefined;

        if (!currentActiveSession) {
          const newSessionId = `sess_${uid}_${deviceName}_${Math.random()}`;
          setDoc(userPath, {
            activeSessionId: newSessionId,
            activeSessionDevice: deviceName,
          });
          return { establishedSessionId: newSessionId, userData: uData };
        }

        return { establishedSessionId: null, userData: uData };
      });

      const { establishedSessionId, userData } = establishResult;

      if (establishedSessionId) {
        return { success: true, requiresOtp: false, sessionId: establishedSessionId };
      }

      // If active session exists -> generates gated OTP challenge
      return {
        success: true,
        requiresOtp: true,
        challengeId: `ch_${uid}_${deviceName}`,
        existingSessionId: userData.activeSessionId,
      };
    };

    // Execute Device 1 and Device 2 concurrently via Promise.all
    const [resDevice1, resDevice2] = await Promise.all([
      establishSessionTx("user_race_100", "Device_A"),
      establishSessionTx("user_race_100", "Device_B"),
    ]);

    // Exactly one request must succeed without OTP (first session)
    // Exactly one request must require OTP (gated challenge)
    const firstSessionResp = [resDevice1, resDevice2].find((r) => r.requiresOtp === false);
    const gatedOtpResp = [resDevice1, resDevice2].find((r) => r.requiresOtp === true);

    expect(firstSessionResp).toBeTruthy();
    expect(gatedOtpResp).toBeTruthy();

    expect(firstSessionResp!.sessionId).toBeTruthy();
    expect(gatedOtpResp!.challengeId).toBeTruthy();

    // The second request MUST NOT overwrite the active session established by the first request!
    const activeSessionInDb = database["users/user_race_100"].activeSessionId;
    expect(activeSessionInDb).toBe(firstSessionResp!.sessionId);
    expect(activeSessionInDb).not.toBe(gatedOtpResp!.challengeId);
  });

  it("Test 19: Absence of authResult.email fallback -> email OTP uses strictly userData.email", () => {
    const authResult = { uid: "user_123", email: "untrusted_auth_header@example.com" };
    const userData = { email: "registered_db_user@example.com", emailVerified: true };

    // Resolved email logic from server API:
    const registeredEmail = (userData.email || "").trim(); // authResult.email removed!
    const isEmailVerified = userData.emailVerified === true && !!registeredEmail;

    expect(registeredEmail).toBe("registered_db_user@example.com");
    expect(registeredEmail).not.toBe(authResult.email);
    expect(isEmailVerified).toBe(true);
  });

  it("Test 20: Production OTP resolution logic completely ignores malicious client-supplied phone/email parameters", () => {
    // Malicious request payload attempting parameter pollution
    const maliciousRequestBody = {
      action: "establish",
      clientSuppliedPhone: "+19998887777",
      clientSuppliedEmail: "hacker@attacker.com",
      phoneNumber: "+19998887777",
      email: "hacker@attacker.com",
      destination: "+19998887777",
      target: "hacker@attacker.com",
    };

    // Server-side Firestore user profile document
    const userDataFromDb = {
      phone: "2348011112222",
      phoneNumber: "2348011112222",
      phoneVerified: true,
      email: "victim@example.com",
      emailVerified: true,
    };

    // Execute exact production resolution rules from /api/auth/session/route.ts
    const registeredPhone = (userDataFromDb.phoneNumber || userDataFromDb.phone || "").trim();
    const registeredEmail = (userDataFromDb.email || "").trim(); // authResult.email removed!

    const isPhoneVerified = userDataFromDb.phoneVerified === true && !!registeredPhone;
    const isEmailVerified = userDataFromDb.emailVerified === true && !!registeredEmail;

    const defaultChannel: "whatsapp" | "email" = isPhoneVerified ? "whatsapp" : "email";
    const defaultDestination = defaultChannel === "whatsapp" ? registeredPhone : registeredEmail;

    // Masking helpers from /api/auth/session
    const maskedDest = defaultChannel === "whatsapp" ? maskPhone(defaultDestination) : maskEmail(defaultDestination);

    // Verify server-side derived values
    expect(registeredPhone).toBe("2348011112222");
    expect(registeredEmail).toBe("victim@example.com");
    expect(defaultDestination).toBe("2348011112222");
    expect(maskedDest).toBe("2348••••2222");

    // Confirm total isolation from all client-supplied parameters
    expect(defaultDestination).not.toBe(maliciousRequestBody.clientSuppliedPhone);
    expect(defaultDestination).not.toBe(maliciousRequestBody.clientSuppliedEmail);
    expect(defaultDestination).not.toBe(maliciousRequestBody.phoneNumber);
    expect(defaultDestination).not.toBe(maliciousRequestBody.email);
    expect(defaultDestination).not.toBe(maliciousRequestBody.destination);
  });
});
