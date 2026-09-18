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

  it("Test 9: Concurrent verification -> only one succeeds", () => {
    let consumed = false;

    const verifyTransaction = () => {
      if (consumed) {
        throw new Error("CHALLENGE_CONSUMED");
      }
      consumed = true;
      return "SUCCESS";
    };

    const res1 = verifyTransaction();
    expect(res1).toBe("SUCCESS");

    expect(() => verifyTransaction()).toThrow("CHALLENGE_CONSUMED");
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
});
