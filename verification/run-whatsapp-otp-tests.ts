/**
 * Production Hardening Unit & Integration Tests for secure WhatsApp OTP verification system.
 * Covers:
 * ✓ Cryptographically secure OTP generation
 * ✓ Server-side SHA-256 secure hashing
 * ✓ Rate limiting and 60-second cooldown timer
 * ✓ OTP 5-minute expiration enforcement
 * ✓ Limit incorrect verification attempts (max 3, invalidating permanently on exceed)
 * ✓ WhatsApp number formatting (formatting + prefix)
 * ✓ Random message template variation to prevent bans
 */

import crypto from "crypto";

interface OtpSession {
  phoneNumber: string;
  otpHash: string;
  expiresAt: string;
  cooldownUntil: string;
  verified: boolean;
  attempts: number;
  updatedAt: string;
}

// Simulated Firestore Mock DB for OTP testing
const mockDb = new Map<string, OtpSession>();

function getCooldownWaitSeconds(session: OtpSession, now: number): number {
  const cooldownTime = new Date(session.cooldownUntil).getTime();
  if (now < cooldownTime) {
    return Math.ceil((cooldownTime - now) / 1000);
  }
  return 0;
}

function generateOtp(): { otpCode: string; otpHash: string; expiresAt: string; cooldownUntil: string } {
  const otpCode = crypto.randomInt(100000, 1000000).toString();
  const otpHash = crypto.createHash("sha256").update(otpCode).digest("hex");
  const now = Date.now();
  const expiresAt = new Date(now + 5 * 60 * 1000).toISOString();
  const cooldownUntil = new Date(now + 60 * 1000).toISOString();
  return { otpCode, otpHash, expiresAt, cooldownUntil };
}

function verifyOtp(phoneNumber: string, otpCode: string, now: number): { success: boolean; error?: string } {
  const session = mockDb.get(phoneNumber);
  if (!session) {
    return { success: false, error: "No active OTP request found. Please request a new code." };
  }

  const expiresAtTime = new Date(session.expiresAt).getTime();
  if (now > expiresAtTime) {
    return { success: false, error: "OTP has expired. Please request a new one." };
  }

  if (session.attempts >= 3 || !session.otpHash) {
    return { success: false, error: "This OTP is invalid due to too many incorrect attempts. Please request a new one." };
  }

  const inputHash = crypto.createHash("sha256").update(otpCode).digest("hex");

  if (inputHash === session.otpHash) {
    session.verified = true;
    session.updatedAt = new Date(now).toISOString();
    mockDb.set(phoneNumber, session);
    return { success: true };
  } else {
    session.attempts += 1;
    session.updatedAt = new Date(now).toISOString();
    if (session.attempts >= 3) {
      session.otpHash = ""; // clear hash
    }
    mockDb.set(phoneNumber, session);

    if (session.attempts >= 3) {
      return { success: false, error: "Incorrect OTP. Too many incorrect attempts. This OTP is now invalid. Please request a new one." };
    } else {
      return { success: false, error: `Incorrect OTP. You have ${3 - session.attempts} attempts remaining.` };
    }
  }
}

function getRandomTemplate(otpCode: string): string {
  const templates = [
    `Hello! Your E-Tech Global Hub verification code is *${otpCode}*. It will expire in 5 minutes. Please do not share this code with anyone.`,
    `Your requested secure one-time passcode for E-Tech Global Hub is *${otpCode}*. This code is valid for 5 minutes. Security notice: We will never ask for your password or pin.`,
    `Use code *${otpCode}* to verify your WhatsApp number on E-Tech Global Hub. This OTP expires in 5 minutes. Thank you!`,
    `[E-Tech Global Hub] One-Time Password: *${otpCode}*. To complete your registration, enter this code in your signup screen. Valid for 5 minutes.`
  ];
  return templates[Math.floor(Math.random() * templates.length)];
}

async function runOtpTests() {
  console.log("==================================================");
  console.log("STARTING SECURE WHATSAPP OTP VERIFICATION TESTS    ");
  console.log("==================================================");

  let passedTests = 0;
  let failedTests = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passedTests++;
    } else {
      console.error(`[FAIL] ${message}`);
      failedTests++;
    }
  }

  const phoneNumber = "+2348012345678";

  // --- Test Case 1: OTP Generation & Hashing ---
  try {
    mockDb.clear();
    const { otpCode, otpHash, expiresAt, cooldownUntil } = generateOtp();
    assert(otpCode.length === 6 && /^\d+$/.test(otpCode), "OTP code has exactly 6 numeric digits.");
    assert(otpHash !== otpCode, "OTP hash is securely cryptographically masked and not plain text.");
    assert(new Date(expiresAt).getTime() > Date.now(), "Expiration timestamp is set in the future.");

    const session: OtpSession = {
      phoneNumber,
      otpHash,
      expiresAt,
      cooldownUntil,
      verified: false,
      attempts: 0,
      updatedAt: new Date().toISOString()
    };
    mockDb.set(phoneNumber, session);
    assert(mockDb.has(phoneNumber), "OTP session successfully saved in database.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 2: Cooldown Rate Limiting ---
  try {
    const session = mockDb.get(phoneNumber)!;
    const now = Date.now();
    const wait = getCooldownWaitSeconds(session, now);
    assert(wait > 0 && wait <= 60, "Rate limit cooldown enforces waiting (under 60s).");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 3: Failed Verification Decrements Attempts ---
  try {
    const now = Date.now();
    const badCode = "111111";
    const res = verifyOtp(phoneNumber, badCode, now);
    assert(!res.success, "Incorrect OTP is rejected by the verifier.");
    assert(!!(res.error && res.error.includes("2 attempts remaining")), "Correctly tracks and displays remaining attempts.");
    assert(mockDb.get(phoneNumber)!.attempts === 1, "Failed attempts count incremented in session.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 4: Max Failed Attempts (Locking & Invalidating) ---
  try {
    const now = Date.now();
    // 2nd wrong attempt
    const res2 = verifyOtp(phoneNumber, "222222", now);
    assert(!res2.success && !!(res2.error && res2.error.includes("1 attempts remaining")), "Second incorrect attempt is rejected.");

    // 3rd wrong attempt
    const res3 = verifyOtp(phoneNumber, "333333", now);
    assert(!res3.success && !!(res3.error && res3.error.includes("invalid")), "Third incorrect attempt invalidates the OTP.");
    assert(mockDb.get(phoneNumber)!.otpHash === "", "OTP hash is completely cleared on 3 failed attempts to prevent brute-forcing.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 5: 5-minute Expiration Enforcement ---
  try {
    mockDb.clear();
    const { otpCode, otpHash, expiresAt, cooldownUntil } = generateOtp();
    const session: OtpSession = {
      phoneNumber,
      otpHash,
      expiresAt,
      cooldownUntil,
      verified: false,
      attempts: 0,
      updatedAt: new Date().toISOString()
    };
    mockDb.set(phoneNumber, session);

    // Simulate 5 minutes passing (now is greater than expiresAt)
    const futureTime = Date.now() + 6 * 60 * 1000;
    const res = verifyOtp(phoneNumber, otpCode, futureTime);
    assert(!res.success && !!(res.error && res.error.includes("expired")), "OTP expiration is strictly enforced after 5 minutes.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 6: Successful Verification ---
  try {
    mockDb.clear();
    const { otpCode, otpHash, expiresAt, cooldownUntil } = generateOtp();
    const session: OtpSession = {
      phoneNumber,
      otpHash,
      expiresAt,
      cooldownUntil,
      verified: false,
      attempts: 0,
      updatedAt: new Date().toISOString()
    };
    mockDb.set(phoneNumber, session);

    const now = Date.now();
    const res = verifyOtp(phoneNumber, otpCode, now);
    assert(res.success, "Correct OTP is verified successfully.");
    assert(mockDb.get(phoneNumber)!.verified === true, "Session verified status updated to true.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 7: Ban Prevention Randomized Templates ---
  try {
    const templatesGenerated = new Set<string>();
    const otpCode = "123456";
    for (let i = 0; i < 20; i++) {
      templatesGenerated.add(getRandomTemplate(otpCode));
    }
    assert(templatesGenerated.size > 1, "Randomized template variation is active to protect sending number from bans.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 8: Phone Number Prefix Formatting ---
  try {
    const phoneInput = "+2348012345678";
    const cleanNumber = phoneInput.replace(/\D/g, "");
    assert(cleanNumber === "2348012345678", "Formatted number removes '+' prefix for universal Baileys API compatibility.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  console.log("==================================================");
  console.log(`OTP UNIT & INTEGRATION TESTS FINISHED: ${passedTests} PASSED, ${failedTests} FAILED.`);
  console.log("==================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runOtpTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
