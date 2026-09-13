import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { FieldValue } from "firebase-admin/firestore";
import { toMinorUnits, toMajorUnits, calculateUserDeduction } from "@/lib/monetary-util";
import { isActiveUser } from "@/lib/monetary-util";

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallet.deductions.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }

    const adminEmail = perm.auth.email || "System Administrator";
    const adminUid = perm.auth.uid;

    const body = await req.json();
    const { name, description, amount, deductionId: clientDeductionId } = body;

    const parsedAmount = toMajorUnits(toMinorUnits(amount));
    if (parsedAmount <= 0) {
      return NextResponse.json({ error: "Deduction amount must be a positive number greater than 0." }, { status: 400 });
    }

    if (parsedAmount > 100000) {
      return NextResponse.json({ error: "Maximum single global deduction amount cannot exceed ₦100,000." }, { status: 400 });
    }

    // Deterministic immutable deduction ID for idempotency
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const deductionId = clientDeductionId || `DED-${todayStr}-${Date.now().toString().slice(-4)}`;

    const deductionRef = adminDb.collection("global_deductions").doc(deductionId);

    // Atomic State Transition & Concurrency Lock Check inside transaction
    const lockResult = await adminDb.runTransaction(async (transaction) => {
      const docSnap = await transaction.get(deductionRef);
      if (docSnap.exists) {
        const d = docSnap.data() || {};
        if (d.status === "COMPLETED") {
          return { status: "ALREADY_COMPLETED", data: d };
        }
        if (d.status === "PROCESSING") {
          return { status: "ALREADY_PROCESSING", data: d };
        }
        // Immutable parameters check
        if (d.amount !== undefined && toMinorUnits(d.amount) !== toMinorUnits(parsedAmount)) {
          throw new Error("Cannot alter original immutable deduction amount once created.");
        }
      }

      const nowIso = new Date().toISOString();
      const initialData = {
        deductionId,
        name: (name || "Maintenance Fee").trim(),
        description: (description || "").trim(),
        amount: parsedAmount,
        currency: "NGN",
        target: "All Active Users",
        status: "PROCESSING",
        createdBy: adminEmail,
        createdByUid: adminUid,
        createdAt: docSnap.exists ? docSnap.data()?.createdAt : nowIso,
        updatedAt: nowIso,
      };

      transaction.set(deductionRef, initialData, { merge: true });
      return { status: "PROCEED", data: initialData };
    });

    if (lockResult.status === "ALREADY_COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "This global deduction has already been executed to completion.",
        deduction: { id: deductionRef.id, ...lockResult.data },
      });
    }

    if (lockResult.status === "ALREADY_PROCESSING") {
      return NextResponse.json({
        error: "This global deduction is currently being processed by another administrator request.",
      }, { status: 409 });
    }

    // Fetch all active users
    const usersSnap = await adminDb.collection("users").get();
    const activeUserDocs = usersSnap.docs.filter((doc) => isActiveUser(doc.data() || {}));
    const totalEligibleCount = activeUserDocs.length;

    let processedUsersCount = 0;
    let failedUsersCount = 0;

    let totalAssessedMinor = 0;
    let totalRecoveredMinor = 0;
    let totalOutstandingMinor = 0;
    let indebtedUsersCount = 0;

    const nowIso = new Date().toISOString();

    // Process users in batch chunks of 25 users
    for (let i = 0; i < activeUserDocs.length; i += 25) {
      const chunk = activeUserDocs.slice(i, i + 25);

      await Promise.all(
        chunk.map(async (uDoc) => {
          const userId = uDoc.id;
          const userDeductionDocId = `ded_${deductionId}_${userId}`;
          const userDeductionRef = adminDb.collection("user_deductions").doc(userDeductionDocId);

          try {
            await adminDb.runTransaction(async (transaction) => {
              // 1. Idempotency Check: Read user_deductions record first inside transaction
              const userDedSnap = await transaction.get(userDeductionRef);
              if (userDedSnap.exists && userDedSnap.data()?.status === "APPLIED") {
                const dData = userDedSnap.data() || {};
                processedUsersCount++;
                totalAssessedMinor += toMinorUnits(dData.amountAssessed);
                totalRecoveredMinor += toMinorUnits(dData.amountRecovered);
                totalOutstandingMinor += toMinorUnits(dData.amountOutstanding);
                if (toMinorUnits(dData.amountOutstanding) > 0) indebtedUsersCount++;
                return;
              }

              // Read user profile and wallet
              const userRef = adminDb.collection("users").doc(userId);
              const walletRef = adminDb.collection("wallets").doc(`${userId}_NGN`);

              const [userSnap, walletSnap] = await Promise.all([
                transaction.get(userRef),
                transaction.get(walletRef),
              ]);

              if (!userSnap.exists) return;
              const uData = userSnap.data() || {};

              if (!isActiveUser(uData)) return;

              const currentWalletBalance = walletSnap.exists ? (Number(walletSnap.data()?.balance) || 0) : 0;
              const currentDebt = Math.max(0, Number(uData.outstandingDebt) || 0);

              // Integer minor units calculation
              const calc = calculateUserDeduction(currentWalletBalance, currentDebt, parsedAmount);

              // Write updates to wallet
              transaction.set(walletRef, {
                userId,
                currency: "NGN",
                balance: calc.newBalance,
                updatedAt: nowIso,
              }, { merge: true });

              // Write updates to user document
              const userUpdates: Record<string, any> = {
                balance: calc.newBalance,
              };
              if (calc.amountOutstanding > 0) {
                userUpdates.outstandingDebt = FieldValue.increment(calc.amountOutstanding);
              }
              transaction.update(userRef, userUpdates);

              // Create per-user audit record in user_deductions collection
              transaction.set(userDeductionRef, {
                deductionId,
                deductionName: name,
                userId,
                userName: uData.name || uData.displayName || "Customer",
                userEmail: uData.email || "",
                userPhone: uData.phoneNumber || "",
                amountAssessed: calc.amountAssessed,
                amountRecovered: calc.amountRecovered,
                amountOutstanding: calc.amountOutstanding,
                walletBalanceBefore: currentWalletBalance,
                walletBalanceAfter: calc.newBalance,
                outstandingDebtBefore: currentDebt,
                outstandingDebtAfter: calc.newDebt,
                status: "APPLIED",
                createdAt: nowIso,
                updatedAt: nowIso,
              });

              // Write transaction ledger entry for user history
              const txRef = `deduction-${deductionId}-${userId}`;
              const txDocRef = adminDb.collection("transactions").doc(`tx-${txRef}`);
              transaction.set(txDocRef, {
                userId,
                amount: calc.amountAssessed,
                currency: "NGN",
                reference: txRef,
                type: "GLOBAL_DEDUCTION",
                category: "DEDUCTION",
                direction: "DEBIT",
                description: `${name} (Amount Assessed: ₦${calc.amountAssessed.toLocaleString()}, Recovered: ₦${calc.amountRecovered.toLocaleString()}, Debt: ₦${calc.amountOutstanding.toLocaleString()})`,
                recipientName: "Service Charge",
                status: "SUCCESS",
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                fee: 0,
                totalDebited: calc.amountRecovered,
                totalCredited: 0,
                createdAt: nowIso,
                completedAt: nowIso,
                metadata: {
                  deductionId,
                  amountAssessed: calc.amountAssessed,
                  amountRecovered: calc.amountRecovered,
                  amountOutstanding: calc.amountOutstanding,
                  newDebtPosition: calc.newDebt,
                  netPositionAfter: calc.netBalanceAfter,
                },
              });

              processedUsersCount++;
              totalAssessedMinor += toMinorUnits(calc.amountAssessed);
              totalRecoveredMinor += toMinorUnits(calc.amountRecovered);
              totalOutstandingMinor += toMinorUnits(calc.amountOutstanding);
              if (calc.amountOutstanding > 0) indebtedUsersCount++;
            });
          } catch (txErr: any) {
            console.error(`[Global Deduction Transaction Error for User ${userId}]:`, txErr.message);
            failedUsersCount++;
          }
        })
      );
    }

    const finalStatus = (failedUsersCount === 0 && processedUsersCount >= totalEligibleCount)
      ? "COMPLETED"
      : "PARTIAL";

    const totalAssessedAmount = toMajorUnits(totalAssessedMinor);
    const totalRecoveredAmount = toMajorUnits(totalRecoveredMinor);
    const totalOutstandingAmount = toMajorUnits(totalOutstandingMinor);

    const summaryData = {
      status: finalStatus,
      eligibleUsersCount: totalEligibleCount,
      processedUsersCount,
      failedUsersCount,
      indebtedUsersCount,
      totalAssessedAmount,
      totalRecoveredAmount,
      totalOutstandingAmount,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await deductionRef.set(summaryData, { merge: true });

    // Non-silent Audit Log
    try {
      await adminDb.collection("admin_audit_logs").add({
        action: "global_wallet_deduction_executed",
        adminEmail,
        adminUid,
        deductionId,
        details: {
          name,
          amount: parsedAmount,
          status: finalStatus,
          eligibleUsersCount: totalEligibleCount,
          processedUsersCount,
          failedUsersCount,
          totalAssessedAmount,
          totalRecoveredAmount,
          totalOutstandingAmount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (auditErr: any) {
      console.error("[Audit Logging Error]: Failed to record admin audit log:", auditErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Global deduction "${name}" processed! Status: ${finalStatus}. Processed: ${processedUsersCount}, Failed: ${failedUsersCount}`,
      deduction: {
        id: deductionId,
        deductionId,
        name,
        amount: parsedAmount,
        ...summaryData,
      },
    });
  } catch (err: any) {
    console.error("[Admin Deductions Execute Error]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to execute global deduction" }, { status: 500 });
  }
}
