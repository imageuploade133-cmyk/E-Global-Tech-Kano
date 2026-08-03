import { FraudDetectionService, MockKYCProvider, KYCService } from "../src/services/kyc-service";
import crypto from "crypto";

async function runKycTests() {
  console.log("==================================================");
  console.log("STARTING KYC VERIFICATION UNIT TESTS             ");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`[PASS] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL] ${message}`);
      failed++;
    }
  }

  // --- Test Case 1: Name Normalization ---
  try {
    const rawName = "  Abdulkadir, Shaba.  ";
    const cleaned = FraudDetectionService.normalizeName(rawName);
    assert(cleaned === "abdulkadir shaba", "normalizeName handles padding, casing, and punctuation correctly.");
  } catch (err: any) {
    console.error(err);
    failed++;
  }

  // --- Test Case 2: Name Matching Rules ---
  try {
    const registeredName = "Abdulkadir Shaba";
    const providerNameMatch1 = "Abdulkadir Shaba";
    const providerNameMatch2 = "Abdulkadir Yusuf Shaba";
    const providerNameMatch3 = "ABDULKADIR SHABA.";
    const providerMismatch = "John Doe";

    assert(FraudDetectionService.doesNameMatch(registeredName, providerNameMatch1), "Exact name match passes.");
    assert(FraudDetectionService.doesNameMatch(registeredName, providerNameMatch2), "Fuzzy overlapping match (with middle name) passes.");
    assert(FraudDetectionService.doesNameMatch(registeredName, providerNameMatch3), "Fuzzy match ignoring casing and punctuation passes.");
    assert(!FraudDetectionService.doesNameMatch(registeredName, providerMismatch), "Mismatching names are correctly rejected.");
  } catch (err: any) {
    console.error(err);
    failed++;
  }

  // --- Test Case 3: Cryptographic ID Hashing ---
  try {
    const id = "12345678901";
    const hash = FraudDetectionService.hashId(id);
    const expectedHash = crypto.createHash("sha256").update(id).digest("hex");
    assert(hash === expectedHash, "hashId produces secure, irreversible SHA-256 hashes.");
  } catch (err: any) {
    console.error(err);
    failed++;
  }

  // --- Test Case 4: Mock Provider Resolving ---
  try {
    const provider = new MockKYCProvider();

    // Normal resolve
    const res1 = await provider.resolveIdentity("11111111111", "bvn");
    assert(res1.success && res1.fullName === "Abdulkadir Shaba", "Mock provider successfully resolves sample BVN.");

    // Fraud resolve
    const res2 = await provider.resolveIdentity("22222222222", "bvn");
    assert(res2.success && res2.fullName === "John Fraudulent Doe", "Mock provider resolves fraudulent John Doe details.");

    // Inactive resolve
    const res3 = await provider.resolveIdentity("44444444444", "bvn");
    assert(!res3.success && !!res3.message?.includes("inactive"), "Mock provider correctly rejects inactive/invalid credentials.");
  } catch (err: any) {
    console.error(err);
    failed++;
  }

  console.log("==================================================");
  console.log(`KYC UNIT TESTS FINISHED: ${passed} PASSED, ${failed} FAILED.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runKycTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
