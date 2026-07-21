// Unit tests for Smart Auto Bank Detection and NUBAN check digit validation

const calculateNubanCheckDigit = (serialNumber9: string, bankCode3: string): number => {
  const b = bankCode3.padStart(3, "0");
  const s = serialNumber9.padStart(9, "0");

  const bankSum = (parseInt(b[0]) * 3) + (parseInt(b[1]) * 7) + (parseInt(b[2]) * 3);
  const serialSum = (parseInt(s[0]) * 3) + (parseInt(s[1]) * 7) + (parseInt(s[2]) * 3) +
                    (parseInt(s[3]) * 3) + (parseInt(s[4]) * 7) + (parseInt(s[5]) * 3) +
                    (parseInt(s[6]) * 3) + (parseInt(s[7]) * 7) + (parseInt(s[8]) * 3);

  const totalSum = bankSum + serialSum;
  const modulo = totalSum % 10;
  return (10 - modulo) % 10;
};

async function runSmartTests() {
  console.log("==================================================");
  console.log("STARTING SMART AUTO DETECTION UNIT TESTS         ");
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

  // Test Case 1: Standard Access Bank NUBAN matching check digit calculation
  try {
    const checkDigit = calculateNubanCheckDigit("069000003", "044");
    assert(checkDigit === 2, `NUBAN check digit for Access Bank (044) with serial 069000003 is 2. Calculated: ${checkDigit}`);
  } catch (err: any) {
    console.error("Test Case 1 failed:", err.message);
    failed++;
  }

  // Test Case 2: Candidate bank filtering using NUBAN algorithm
  try {
    const accountNumber = "0690000032";
    const serialNumber9 = accountNumber.slice(0, 9);
    const lastDigit = parseInt(accountNumber[9]);

    const mockBanksList = [
      { id: "1", name: "Access Bank", code: "044" },
      { id: "2", name: "GTBank", code: "058" },
      { id: "3", name: "Zenith Bank", code: "057" },
    ];

    const candidates = mockBanksList.filter(bank => {
      if (!bank.code) return false;
      const computed = calculateNubanCheckDigit(serialNumber9, bank.code);
      return computed === lastDigit;
    });

    assert(candidates.length === 1 && candidates[0].name === "Access Bank", "Access Bank correctly filtered as the matching candidate.");
  } catch (err: any) {
    console.error("Test Case 2 failed:", err.message);
    failed++;
  }

  // Test Case 3: Sorting candidates by popularity
  try {
    const mockBanksList = [
      { id: "1", name: "Non-Popular Bank", code: "111" },
      { id: "2", name: "GTBank", code: "058" },
      { id: "3", name: "Access Bank", code: "044" },
    ];

    const POPULAR_BANK_CODES = ["044", "058", "057", "033", "011"];
    const sorted = [...mockBanksList].sort((a, b) => {
      const indexA = POPULAR_BANK_CODES.indexOf(a.code || "");
      const indexB = POPULAR_BANK_CODES.indexOf(b.code || "");
      const priorityA = indexA !== -1 ? indexA : 999;
      const priorityB = indexB !== -1 ? indexB : 999;
      return priorityA - priorityB;
    });

    assert(sorted[0].name === "Access Bank", "Access Bank sorted first due to popularity.");
    assert(sorted[1].name === "GTBank", "GTBank sorted second due to popularity.");
    assert(sorted[2].name === "Non-Popular Bank", "Non-popular bank sorted last.");
  } catch (err: any) {
    console.error("Test Case 3 failed:", err.message);
    failed++;
  }

  console.log("==================================================");
  console.log(`SMART AUTO DETECTION TESTS FINISHED: ${passed} PASSED, ${failed} FAILED.`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runSmartTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
