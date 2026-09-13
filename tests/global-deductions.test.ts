import { describe, test, expect } from "bun:test";

describe("Global Wallet Deductions & Automatic Debt Recovery Architecture Suite", () => {
  // Scenario 1: User with sufficient balance (e.g. ₦1,000 balance, ₦500 deduction)
  test("Scenario 1: Global deduction on user with sufficient balance recovers 100% immediately and creates zero debt", () => {
    const balanceBefore = 1000;
    const currentDebt = 0;
    const deductionAmount = 500;

    let recoveredImmediately = 0;
    let addedDebt = 0;
    let balanceAfter = balanceBefore;

    if (balanceBefore >= deductionAmount) {
      recoveredImmediately = deductionAmount;
      balanceAfter = balanceBefore - deductionAmount;
      addedDebt = 0;
    } else {
      recoveredImmediately = balanceBefore;
      balanceAfter = 0;
      addedDebt = deductionAmount - balanceBefore;
    }

    const newDebt = currentDebt + addedDebt;

    expect(recoveredImmediately).toBe(500);
    expect(balanceAfter).toBe(500);
    expect(addedDebt).toBe(0);
    expect(newDebt).toBe(0);
  });

  // Scenario 2: User with insufficient balance (e.g. ₦200 balance, ₦500 deduction)
  test("Scenario 2: Global deduction on user with insufficient balance recovers available balance and creates outstanding debt", () => {
    const balanceBefore = 200;
    const currentDebt = 0;
    const deductionAmount = 500;

    let recoveredImmediately = 0;
    let addedDebt = 0;
    let balanceAfter = balanceBefore;

    if (balanceBefore >= deductionAmount) {
      recoveredImmediately = deductionAmount;
      balanceAfter = balanceBefore - deductionAmount;
      addedDebt = 0;
    } else {
      recoveredImmediately = balanceBefore;
      balanceAfter = 0;
      addedDebt = deductionAmount - balanceBefore;
    }

    const newDebt = currentDebt + addedDebt;

    expect(recoveredImmediately).toBe(200);
    expect(balanceAfter).toBe(0);
    expect(addedDebt).toBe(300);
    expect(newDebt).toBe(300);
  });

  // Scenario 3: Spendable balance check for indebted user
  test("Scenario 3: Spendable balance calculation restricts indebted users from spending funds committed to debt", () => {
    const balance = 1000;
    const outstandingDebt = 400;

    const spendableBalance = Math.max(0, balance - outstandingDebt);

    expect(spendableBalance).toBe(600);

    // Attempting a ₦700 transfer should fail against spendable balance ₦600 even though total balance is ₦1,000
    const transferAmount = 700;
    const isAllowed = spendableBalance >= transferAmount;
    expect(isAllowed).toBe(false);
  });

  // Scenario 4: Automatic debt recovery on wallet credit (Credit > Debt)
  test("Scenario 4: Incoming wallet credit greater than outstanding debt recovers 100% debt and credits remaining net balance", () => {
    const initialBalance = 0;
    const initialDebt = 300;
    const creditAmount = 1000;

    let debtRecovered = 0;
    let netBalanceIncrement = 0;
    let debtAfter = initialDebt;

    if (initialDebt > 0) {
      debtRecovered = Math.min(creditAmount, initialDebt);
      netBalanceIncrement = creditAmount - debtRecovered;
      debtAfter = initialDebt - debtRecovered;
    } else {
      netBalanceIncrement = creditAmount;
    }

    const finalBalance = initialBalance + netBalanceIncrement;

    expect(debtRecovered).toBe(300);
    expect(netBalanceIncrement).toBe(700);
    expect(debtAfter).toBe(0);
    expect(finalBalance).toBe(700);
  });

  // Scenario 5: Automatic debt recovery on wallet credit (Credit < Debt)
  test("Scenario 5: Incoming wallet credit smaller than outstanding debt recovers partial debt and leaves zero net balance increment", () => {
    const initialBalance = 0;
    const initialDebt = 500;
    const creditAmount = 200;

    let debtRecovered = 0;
    let netBalanceIncrement = 0;
    let debtAfter = initialDebt;

    if (initialDebt > 0) {
      debtRecovered = Math.min(creditAmount, initialDebt);
      netBalanceIncrement = creditAmount - debtRecovered;
      debtAfter = initialDebt - debtRecovered;
    } else {
      netBalanceIncrement = creditAmount;
    }

    const finalBalance = initialBalance + netBalanceIncrement;

    expect(debtRecovered).toBe(200);
    expect(netBalanceIncrement).toBe(0);
    expect(debtAfter).toBe(300);
    expect(finalBalance).toBe(0);
  });
});
