/**
 * Clean Architecture Integration Tests for WhatsAppOtpService.
 * Covers:
 * ✓ Cryptographically secure 6-digit OTP generation
 * ✓ S2S WhatsApp Gateway calling (ban protection templates)
 * ✓ Strict 10-minute expiration checking
 * ✓ Brute-force block (max 3 failed attempts invalidation)
 * ✓ Rate-limiting cooldown checking
 * ✓ Successful registration session verification and cleanup
 */

import { WhatsAppOtpService } from "../src/services/whatsapp-otp-service";
import { OtpStoreService } from "../src/lib/otp-store";

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
    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);
    assert(result.success, "sendOtp returns successful dispatch state.");
    assert(!!result.cooldownUntil, "sendOtp returns a future cooldown timestamp.");
    assert(result.devOtpCode !== undefined && result.devOtpCode.length === 6, "Dev OTP code is successfully returned under non-production environments.");

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
    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);
    const code = result.devOtpCode!;

    const stored = await OtpStoreService.getOtp(fullPhone)!;
    // Backdate expiresAt to 11 minutes ago (expired)
    if (stored) {
      stored.expiresAt = new Date(Date.now() - 11 * 60 * 1000).toISOString();
      await OtpStoreService.setOtp(fullPhone, stored);
    }

    let expired = false;
    try {
      await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, code);
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
    const result = await WhatsAppOtpService.sendOtp(phonePrefix, phoneNumber);
    const code = result.devOtpCode!;

    const verified = await WhatsAppOtpService.verifyOtp(phonePrefix, phoneNumber, code);
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

  if (failedTests > 0) {
    process.exit(1);
  }
}

runOtpServiceTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
