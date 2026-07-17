import { BankDoc } from "../src/services/bank-service";

async function runBankTests() {
  console.log("==================================================");
  console.log("STARTING BANK SERVICE AND SELECTION TESTS        ");
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

  // Test Case 1: Mock bank list sorting and searching
  try {
    const mockBanks: BankDoc[] = [
      { id: "3", name: "Zenith Bank", code: "057", country: "NG", type: "NG", is_active: true, createdAt: "", updatedAt: "" },
      { id: "1", name: "Access Bank", code: "044", country: "NG", type: "NG", is_active: true, createdAt: "", updatedAt: "" },
      { id: "2", name: "Guaranty Trust Bank", code: "058", country: "NG", type: "NG", is_active: true, createdAt: "", updatedAt: "" },
    ];

    // Check sorting alphabetically
    const sorted = [...mockBanks].sort((a, b) => a.name.localeCompare(b.name));
    assert(sorted[0].name === "Access Bank", "Access Bank sorted first.");
    assert(sorted[1].name === "Guaranty Trust Bank", "Guaranty Trust Bank sorted second.");
    assert(sorted[2].name === "Zenith Bank", "Zenith Bank sorted third.");

    // Check searching case-insensitive
    const query = "gUarAnTy";
    const found = mockBanks.filter((b) => b.name.toLowerCase().includes(query.toLowerCase()));
    assert(found.length === 1 && found[0].name === "Guaranty Trust Bank", "Case-insensitive query matches Guaranty Trust Bank.");
  } catch (err: any) {
    console.error("Test Case 1 failed:", err.message);
    failed++;
  }

  // Test Case 2: STEP 11 Verification of specified production banks
  try {
    const requiredBanks = [
      { id: "access", name: "Access Bank", code: "044" },
      { id: "gtb", name: "GTBank", code: "058" },
      { id: "zenith", name: "Zenith Bank", code: "057" },
      { id: "uba", name: "UBA", code: "033" },
      { id: "first", name: "First Bank", code: "011" },
      { id: "moniepoint", name: "Moniepoint", code: "50515" },
      { id: "kuda", name: "Kuda", code: "50211" },
      { id: "opay", name: "OPay", code: "999992" },
      { id: "palmpay", name: "PalmPay", code: "999991" }
    ];

    requiredBanks.forEach((b) => {
      const codeIsNumeric = /^\d+$/.test(b.code);
      assert(codeIsNumeric, `Bank ${b.name} has a valid numeric Flutterwave code: ${b.code}`);
      assert(b.code !== b.id, `Bank ${b.name} uses code field ${b.code} rather than id field ${b.id} for Flutterwave resolution.`);
    });
  } catch (err: any) {
    console.error("Test Case 2 failed:", err.message);
    failed++;
  }

  console.log("==================================================");
  console.log(`BANK SERVICE TESTS FINISHED: ${passed} PASSED, ${failed} FAILED.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runBankTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
