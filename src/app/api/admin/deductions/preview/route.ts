import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallet.deductions.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }

    const body = await req.json();
    const { name, description, amount } = body;

    const parsedAmount = Math.round((Number(amount) || 0) * 100) / 100;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Deduction amount must be a positive number greater than 0." }, { status: 400 });
    }

    if (parsedAmount > 100000) {
      return NextResponse.json({ error: "Maximum single global deduction amount cannot exceed ₦100,000." }, { status: 400 });
    }

    // 1. Fetch user counts and inspect balances
    const usersSnap = await adminDb.collection("users").get();
    const totalUsers = usersSnap.size;

    let eligibleUsersCount = 0;
    let sufficientFundsCount = 0;
    let expectedIndebtedCount = 0;

    usersSnap.forEach((doc) => {
      const uData = doc.data() || {};
      // Filter out frozen/suspended or inactive users if needed, count all active users
      if (uData.isFrozen || uData.status === "FROZEN" || uData.status === "SUSPENDED") {
        return;
      }

      eligibleUsersCount++;
      const currentNetBalance = (Number(uData.balance) || 0) - (Number(uData.outstandingDebt) || 0);

      if (currentNetBalance >= parsedAmount) {
        sufficientFundsCount++;
      } else {
        expectedIndebtedCount++;
      }
    });

    const maxTotalCharge = Math.round(eligibleUsersCount * parsedAmount * 100) / 100;

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
        expectedIndebtedCount,
        maxTotalCharge,
      },
    });
  } catch (err: any) {
    console.error("[Admin Deductions Preview Error]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to generate deduction preview" }, { status: 500 });
  }
}
