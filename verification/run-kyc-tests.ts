// KYC Validation and Endpoint Verification Tests

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

  // Helper function to mock request validation rules
  function validateKycBody(body: any): string[] {
    const { idNumber, type } = body;
    const errors: string[] = [];

    if (!idNumber) {
      errors.push("Identity number (idNumber) is missing.");
    } else if (typeof idNumber !== "string") {
      errors.push("Identity number must be a string.");
    } else if (!/^\d{11}$/.test(idNumber.trim())) {
      errors.push(`Identity number '${idNumber}' is invalid. It must be exactly 11 digits.`);
    }

    if (!type) {
      errors.push("Identity type (type) is missing.");
    } else if (type !== "bvn" && type !== "nin") {
      errors.push(`Identity type '${type}' is invalid. It must be either 'bvn' or 'nin'.`);
    }

    return errors;
  }

  // Test Case 1: Valid BVN 11-digit
  try {
    const errors = validateKycBody({ idNumber: "22222222222", type: "bvn" });
    assert(errors.length === 0, "Valid BVN returns no validation errors.");
  } catch (err: any) {
    console.error("Test Case 1 failed:", err.message);
    failed++;
  }

  // Test Case 2: Missing idNumber
  try {
    const errors = validateKycBody({ type: "bvn" });
    assert(errors.includes("Identity number (idNumber) is missing."), "Missing idNumber is correctly identified.");
  } catch (err: any) {
    console.error("Test Case 2 failed:", err.message);
    failed++;
  }

  // Test Case 3: Invalid digit length
  try {
    const errors = validateKycBody({ idNumber: "12345", type: "nin" });
    assert(errors.some(e => e.includes("is invalid. It must be exactly 11 digits.")), "Short ID numbers are rejected with descriptive message.");
  } catch (err: any) {
    console.error("Test Case 3 failed:", err.message);
    failed++;
  }

  // Test Case 4: Invalid type
  try {
    const errors = validateKycBody({ idNumber: "12345678901", type: "passport" });
    assert(errors.some(e => e.includes("is invalid. It must be either 'bvn' or 'nin'.")), "Unsupported types are rejected with descriptive message.");
  } catch (err: any) {
    console.error("Test Case 4 failed:", err.message);
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
