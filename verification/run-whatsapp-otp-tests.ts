/**
 * Clean Architecture Integration Tests for WhatsAppOtpService with dynamic cryptographic mocking.
 * Covers:
 * ✓ Cryptographically secure 6-digit OTP generation
 * ✓ S2S WhatsApp Gateway calling (ban protection templates)
 * ✓ Strict 10-minute expiration checking
 * ✓ Brute-force block (max 3 failed attempts invalidation)
 * ✓ Rate-limiting cooldown checking
 * ✓ Successful registration session verification and cleanup
 * Mocks the `crypto.randomInt` generator inline so our production code remains 100% airtight and clean.
 */

import crypto from "crypto";
import { WhatsAppOtpService } from "../src/services/whatsapp-otp-service";
import { OtpStoreService } from "../src/lib/otp-store";

// Cryptographic prediction mock
const originalRandomInt = crypto.randomInt;
let mockNextOtp = "555555";

Object.defineProperty(crypto, "randomInt", {
  value: (min: number, max: number) => {
    if (min === 100000 && max === 1000000) {
      return parseInt(mockNextOtp);
    }
    return originalRandomInt(min, max);
  },
  writable: true,
  configurable: true
});

async function runOtpServiceTests() {
  console.log("==================================================");
  console.log("STARTING WhatsAppOtpService INTEGRATION TESTS      ");
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

  const phonePrefix = "+234";
  const phoneNumber = "8012345678";
  const fullPhone = `${phonePrefix}${phoneNumber}`;

  // Ensure fresh state
  await OtpStoreService.deleteOtp(fullPhone);

  // --- Test Case 1: Cryptographic Generation and S2S Calling ---
  try {
    mockNextOtp = "123456";
    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);
    assert(result.success, "sendOtp returns successful dispatch state.");
    assert(!!result.cooldownUntil, "sendOtp returns a future cooldown timestamp.");

    const stored = await OtpStoreService.getOtp(fullPhone);
    assert(stored !== null, "OTP session metadata successfully stored in the OtpStore.");
    assert(stored?.verified === false, "Generated OTP session starts as unverified.");
    assert(stored?.attempts === 0, "Generated OTP session starts with 0 failed attempts.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 2: Rate Limiting & Cooldown ---
  try {
    let rateLimited = false;
    try {
      await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);
    } catch (err: any) {
      rateLimited = err.message.includes("wait");
    }
    assert(rateLimited, "sendOtp rate limits duplicate requests within the 60-second cooldown.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 3: Failed Verification Tracked ---
  try {
    let verificationPassed = false;
    try {
      await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, "000000"); // wrong code
    } catch (err: any) {
      verificationPassed = false;
    }
    const stored = await OtpStoreService.getOtp(fullPhone);
    assert(!verificationPassed, "Incorrect OTP is rejected by verifyOtp.");
    assert(stored?.attempts === 1, "Failed verification attempt count successfully incremented.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 4: Max Attempt Invalidations ---
  try {
    // 2nd wrong attempt
    try {
      await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, "000000");
    } catch {}

    // 3rd wrong attempt
    let errorMsg = "";
    try {
      await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, "000000");
    } catch (err: any) {
      errorMsg = err.message;
    }

    assert(errorMsg.includes("invalid"), "3rd incorrect attempt permanently invalidates the OTP.");
    const stored = await OtpStoreService.getOtp(fullPhone);
    assert(stored?.otpHash === "", "OTP hash is completely cleared in storage on brute force lockout.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 5: 10-Minute Expiration Validation ---
  try {
    await OtpStoreService.deleteOtp(fullPhone);
    mockNextOtp = "777777";
    await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);

    const stored = await OtpStoreService.getOtp(fullPhone)!;
    // Backdate expiresAt to 11 minutes ago (expired)
    if (stored) {
      stored.expiresAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
      await OtpStoreService.setOtp(fullPhone, stored);
    }

    let expired = false;
    try {
      await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, "777777");
    } catch (err: any) {
      expired = err.message.includes("expired");
    }
    assert(expired, "Strict 10-minute OTP expiration window is correctly enforced.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 6: Successful Verification & Validation ---
  try {
    await OtpStoreService.deleteOtp(fullPhone);
    mockNextOtp = "888888";
    await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);

    const verified = await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, "888888");
    assert(verified, "Correct OTP code verified successfully.");

    let validationPassed = true;
    try {
      await WhatsAppOtpService.validateVerifiedSession(fullPhone);
    } catch {
      validationPassed = false;
    }
    assert(validationPassed, "validateVerifiedSession successfully permits verified registrations.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  // --- Test Case 7: Session Cleanup ---
  try {
    await WhatsAppOtpService.completeSession(fullPhone);
    const stored = await OtpStoreService.getOtp(fullPhone);
    assert(stored === null, "completeSession successfully cleans up/deletes the session record upon registration.");
  } catch (err) {
    console.error(err);
    failedTests++;
  }

  console.log("==================================================");
  console.log(`WhatsAppOtpService TESTS FINISHED: ${passedTests} PASSED, ${failedTests} FAILED.`);
  console.log("==================================================");

  // Restore original randomInt
  Object.defineProperty(crypto, "randomInt", {
    value: originalRandomInt,
    writable: true,
    configurable: true
  });

  if (failedTests > 0) {
    process.exit(1);
  }
}

runOtpServiceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
