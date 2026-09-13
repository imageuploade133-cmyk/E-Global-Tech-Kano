import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { FieldValue } from "firebase-admin/firestore";

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

    const parsedAmount = Math.round((Number(amount) || 0) * 100) / 100;
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Deduction amount must be a positive number greater than 0." }, { status: 400 });
    }

    // Deterministic immutable deduction ID for idempotency (e.g. DED-20260913-0001 or client provided)
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const deductionId = clientDeductionId || `DED-${todayStr}-${Date.now().toString().slice(-4)}`;

    const deductionRef = adminDb.collection("global_deductions").doc(deductionId);

    // Check if this deduction master record already exists (idempotency check)
    const existingDoc = await deductionRef.get();
    if (existingDoc.exists && existingDoc.data()?.status === "COMPLETED") {
      return NextResponse.json({
        success: true,
        message: "This global deduction has already been executed to completion.",
        deduction: { id: deductionRef.id, ...existingDoc.data() },
      });
    }

    const nowIso = new Date().toISOString();

    // Create or update master deduction record in PROCESSING state
    await deductionRef.set({
      deductionId,
      name: (name || "Maintenance Fee").trim(),
      description: (description || "").trim(),
      amount: parsedAmount,
      currency: "NGN",
      target: "All Active Users",
      status: "PROCESSING",
      createdBy: adminEmail,
      createdByUid: adminUid,
      createdAt: existingDoc.exists ? existingDoc.data()?.createdAt : nowIso,
      updatedAt: nowIso,
    }, { merge: true });

    // Fetch all users to process in retry-safe batch chunks
    const usersSnap = await adminDb.collection("users").get();

    let processedUsersCount = 0;
    let totalAssessedAmount = 0;
    let totalRecoveredAmount = 0;
    let totalOutstandingAmount = 0;
    let indebtedUsersCount = 0;

    // Process users in batch chunks of 50 users at a time using Firestore transactions
    const userDocs = usersSnap.docs;

    for (let i = 0; i < userDocs.length; i += 25) {
      const chunk = userDocs.slice(i, i + 25);

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
                // Already processed for this user
                const dData = userDedSnap.data() || {};
                processedUsersCount++;
                totalAssessedAmount += Number(dData.amountAssessed) || 0;
                totalRecoveredAmount += Number(dData.amountRecovered) || 0;
                totalOutstandingAmount += Number(dData.amountOutstanding) || 0;
                if ((Number(dData.amountOutstanding) || 0) > 0) indebtedUsersCount++;
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

              // Skip frozen/suspended users
              if (uData.isFrozen || uData.status === "FROZEN" || uData.status === "SUSPENDED") {
                return;
              }

              const currentWalletBalance = walletSnap.exists ? (Number(walletSnap.data()?.balance) || 0) : 0;
              const currentDebt = Math.max(0, Number(uData.outstandingDebt) || 0);

              // Calculate deduction accounting
              let recoveredImmediately = 0;
              let addedDebt = 0;
              let newBalance = currentWalletBalance;

              if (currentWalletBalance >= parsedAmount) {
                recoveredImmediately = parsedAmount;
                newBalance = currentWalletBalance - parsedAmount;
                addedDebt = 0;
              } else {
                recoveredImmediately = currentWalletBalance;
                newBalance = 0;
                addedDebt = parsedAmount - currentWalletBalance;
              }

              const newDebt = currentDebt + addedDebt;

              // Write updates to wallet
              transaction.set(walletRef, {
                userId,
                currency: "NGN",
                balance: newBalance,
                updatedAt: nowIso,
              }, { merge: true });

              // Write updates to user document
              const userUpdates: Record<string, any> = {
                balance: newBalance,
              };
              if (addedDebt > 0) {
                userUpdates.outstandingDebt = FieldValue.increment(addedDebt);
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
                amountAssessed: parsedAmount,
                amountRecovered: recoveredImmediately,
                amountOutstanding: addedDebt,
                walletBalanceBefore: currentWalletBalance,
                walletBalanceAfter: newBalance,
                outstandingDebtBefore: currentDebt,
                outstandingDebtAfter: newDebt,
                status: "APPLIED",
                createdAt: nowIso,
                updatedAt: nowIso,
              });

              // Write transaction ledger entry for user history
              const txRef = `deduction-${deductionId}-${userId}`;
              const txDocRef = adminDb.collection("transactions").doc(`tx-${txRef}`);
              transaction.set(txDocRef, {
                userId,
                amount: parsedAmount,
                currency: "NGN",
                reference: txRef,
                type: "GLOBAL_DEDUCTION",
                category: "DEDUCTION",
                direction: "DEBIT",
                description: `${name} (${description || "Wallet Fee"})`,
                recipientName: "Service Charge",
                status: "SUCCESS",
                date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                fee: 0,
                totalDebited: parsedAmount,
                totalCredited: 0,
                createdAt: nowIso,
                completedAt: nowIso,
                metadata: {
                  deductionId,
                  amountAssessed: parsedAmount,
                  recoveredImmediately,
                  addedDebt,
                  newDebtPosition: newDebt,
                },
              });

              processedUsersCount++;
              totalAssessedAmount += parsedAmount;
              totalRecoveredAmount += recoveredImmediately;
              totalOutstandingAmount += addedDebt;
              if (addedDebt > 0) indebtedUsersCount++;
            });
          } catch (txErr: any) {
            console.error(`[Global Deduction Transaction Error for User ${userId}]:`, txErr.message);
          }
        })
      );
    }

    // Finalize master global_deduction record
    const summaryData = {
      status: "COMPLETED",
      eligibleUsersCount: processedUsersCount,
      indebtedUsersCount,
      totalAssessedAmount,
      totalRecoveredAmount,
      totalOutstandingAmount,
      completedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await deductionRef.set(summaryData, { merge: true });

    // Write audit log
    try {
      await adminDb.collection("admin_audit_logs").add({
        action: "global_wallet_deduction_executed",
        adminEmail,
        adminUid,
        deductionId,
        details: {
          name,
          amount: parsedAmount,
          processedUsersCount,
          totalAssessedAmount,
          totalRecoveredAmount,
          totalOutstandingAmount,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {}

    return NextResponse.json({
      success: true,
      message: `Global deduction "${name}" executed successfully across ${processedUsersCount} users!`,
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
