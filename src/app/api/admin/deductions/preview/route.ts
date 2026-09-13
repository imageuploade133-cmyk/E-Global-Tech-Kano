import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { toMinorUnits, toMajorUnits, calculateNetBalance, isActiveUser } from "@/lib/monetary-util";

export { isActiveUser };

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallet.deductions.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }

    const body = await req.json();
    const { name, description, amount } = body;

    const parsedAmount = toMajorUnits(toMinorUnits(amount));
    if (parsedAmount <= 0) {
      return NextResponse.json({ error: "Deduction amount must be a positive number greater than 0." }, { status: 400 });
    }

    if (parsedAmount > 100000) {
      return NextResponse.json({ error: "Maximum single global deduction amount cannot exceed ₦100,000." }, { status: 400 });
    }

    // Fetch user counts and inspect balances using the exact same active user filter and minor units math
    const usersSnap = await adminDb.collection("users").get();
    const totalUsers = usersSnap.size;

    let eligibleUsersCount = 0;
    let sufficientFundsCount = 0;
    let expectedIndebtedCount = 0;
    let totalImmediateRecoveryMinor = 0;
    let totalNewOutstandingDebtMinor = 0;

    const dedMinor = toMinorUnits(parsedAmount);

    usersSnap.forEach((doc) => {
      const uData = doc.data() || {};
      if (!isActiveUser(uData)) return;

      eligibleUsersCount++;

      const walletBal = Number(uData.balance) || 0;
      const debt = Math.max(0, Number(uData.outstandingDebt) || 0);

      const balMinor = toMinorUnits(walletBal);
      const debtMinor = toMinorUnits(debt);

      const recoverMinor = Math.min(balMinor, dedMinor);
      const newDebtCreatedMinor = dedMinor - recoverMinor;

      totalImmediateRecoveryMinor += recoverMinor;
      totalNewOutstandingDebtMinor += newDebtCreatedMinor;

      const netBal = calculateNetBalance(walletBal, debt);
      if (netBal >= parsedAmount) {
        sufficientFundsCount++;
      } else {
        expectedIndebtedCount++;
      }
    });

    const totalAssessedAmount = toMajorUnits(eligibleUsersCount * dedMinor);
    const totalImmediateRecovery = toMajorUnits(totalImmediateRecoveryMinor);
    const totalNewOutstandingDebt = toMajorUnits(totalNewOutstandingDebtMinor);

    return NextResponse.json({
      success: true,
      preview: {
        name: (name || "Maintenance Fee").trim(),
        description: (description || "").trim(),
        amount: parsedAmount,
        currency: "NGN",
        target: "All Active Users",
        totalUsers,
        eligibleUsersCount,
        sufficientFundsCount,
        indebtedCount: expectedIndebtedCount,
        totalAssessedAmount,
        totalImmediateRecovery,
        totalNewOutstandingDebt,
      },
    });
  } catch (err: any) {
    console.error("[Admin Deductions Preview Error]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to generate deduction preview" }, { status: 500 });
  }
}
