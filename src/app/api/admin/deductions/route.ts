import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallet.deductions.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    const { searchParams } = new URL(req.url);
    const deductionId = searchParams.get("deductionId");

    // If specific deduction ID requested, return user-level deduction audit records
    if (deductionId) {
      const userDeductionsSnap = await adminDb
        .collection("user_deductions")
        .where("deductionId", "==", deductionId)
        .limit(100)
        .get();

      const userRecords: any[] = [];
      userDeductionsSnap.forEach((doc) => {
        userRecords.push({ id: doc.id, ...doc.data() });
      });

      return NextResponse.json({
        success: true,
        userRecords,
      });
    }

    // Fetch all global deduction records
    const deductionsSnap = await adminDb
      .collection("global_deductions")
      .orderBy("createdAt", "desc")
      .limit(50)
      .get();

    const deductions: any[] = [];
    deductionsSnap.forEach((doc) => {
      deductions.push({ id: doc.id, ...doc.data() });
    });

    // Summary metrics
    const totalDeductions = deductions.length;
    const totalAssessed = deductions.reduce((sum, d) => sum + (Number(d.totalAssessedAmount) || 0), 0);
    const totalRecovered = deductions.reduce((sum, d) => sum + (Number(d.totalRecoveredAmount) || 0), 0);
    const totalOutstanding = deductions.reduce((sum, d) => sum + (Number(d.totalOutstandingAmount) || 0), 0);

    return NextResponse.json({
      success: true,
      deductions,
      metrics: {
        totalDeductions,
        totalAssessed,
        totalRecovered,
        totalOutstanding,
      },
    });
  } catch (err: any) {
    console.error("[Admin Deductions GET Error]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to fetch deductions history" }, { status: 500 });
  }
}
