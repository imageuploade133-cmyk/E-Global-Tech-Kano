import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { FieldValue } from "firebase-admin/firestore";

interface FlwTxRecord {
  id: string;
  userId?: string;
  amount?: number;
  currency?: string;
}

interface LedgerTxRecord {
  id: string;
  userId?: string;
  amount?: number;
  currency?: string;
  type?: string;
  flwId?: string;
  status?: string;
  fee?: number;
}

interface UserRecord {
  id: string;
  balance?: number;
  role?: string;
}

export async function POST(req: Request) {
  try {
    // 1. Verify admin privilege securely
    await verifyAdminAuth(req);

    console.log("[Reconciliation Tool] Starting production database ledger reconciliation scan...");

    // 2. Fetch critical billing ledgers from Firestore
    const flwTxSnap = await adminDb.collection("flutterwave_transactions").get();
    const ledgerTxSnap = await adminDb.collection("transactions").get();
    const usersSnap = await adminDb.collection("users").get();

    const flwDocs = flwTxSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as FlwTxRecord[];
    const ledgerDocs = ledgerTxSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as LedgerTxRecord[];
    const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })) as UserRecord[];

    const inconsistencies: Array<{
      type: "MISSING_LEDGER" | "MISSING_FLW_LOG" | "AMOUNT_MISMATCH" | "USER_BALANCE_ANOMALY";
      id: string;
      details: string;
    }> = [];

    // Map general ledger records by transactionId
    const flwTxMap = new Map<string, FlwTxRecord>();
    flwDocs.forEach((doc) => {
      flwTxMap.set(doc.id, doc);
    });

    const ledgerTxMap = new Map<string, LedgerTxRecord>();
    ledgerDocs.forEach((doc) => {
      if (doc.flwId) {
        ledgerTxMap.set(doc.flwId, doc);
      }
    });

    // A. Check that every successful Flutterwave settlement has a general ledger record
    flwDocs.forEach((flwTx) => {
      const ledgerTx = ledgerTxMap.get(flwTx.id);
      if (!ledgerTx) {
        inconsistencies.push({
          type: "MISSING_LEDGER",
          id: flwTx.id,
          details: `Flutterwave transaction ${flwTx.id} was processed but is missing a corresponding ledger transaction entry in 'transactions' collection.`,
        });
      } else if (Math.abs(Number(flwTx.amount) - Number(ledgerTx.amount)) > 0.01) {
        inconsistencies.push({
          type: "AMOUNT_MISMATCH",
          id: flwTx.id,
          details: `Amount mismatch inside transaction logs. Idempotency tracker has: ${flwTx.amount}, general ledger has: ${ledgerTx.amount}`,
        });
      }
    });

    // B. Check if there are any deposit general ledger records missing Flutterwave settlement keys
    ledgerDocs.forEach((ledgerTx) => {
      if (ledgerTx.type === "DEPOSIT" && ledgerTx.flwId) {
        const flwTx = flwTxMap.get(ledgerTx.flwId);
        if (!flwTx) {
          inconsistencies.push({
            type: "MISSING_FLW_LOG",
            id: ledgerTx.id,
            details: `General ledger has a successful DEPOSIT record ${ledgerTx.id} linked to Flutterwave ID ${ledgerTx.flwId}, but no matching idempotency log is present in 'flutterwave_transactions' collection.`,
          });
        }
      }
    });

    // C. Check user-level balance consistency
    users.forEach((user) => {
      const userId = user.id;
      const currentBalance = Number(user.balance) || 0;

      // Filter ledger entries for this user
      const userLedgerEntries = ledgerDocs.filter((tx) => tx.userId === userId && tx.status === "SUCCESS");
      let calculatedBalance = 0;

      userLedgerEntries.forEach((tx) => {
        if (tx.type === "DEPOSIT") {
          calculatedBalance += Number(tx.amount) || 0;
        } else if (tx.type === "TRANSFER") {
          calculatedBalance -= (Number(tx.amount) || 0) + (Number(tx.fee) || 0);
        }
      });

      // Report high variance discrepancies
      if (Math.abs(calculatedBalance - currentBalance) > 10.0) {
        inconsistencies.push({
          type: "USER_BALANCE_ANOMALY",
          id: userId,
          details: `User balance check variance. Firestore balance states: ₦${currentBalance}, but calculated general ledger tally says: ₦${calculatedBalance} (Variance: ₦${(calculatedBalance - currentBalance).toFixed(2)})`,
        });
      }
    });

    // 3. Pending Transfers Reconciliation Job (Requirement 10)
    console.log("[Reconciliation Tool] Querying pending transfers for reconciliation...");
    const pendingTransfersSnap = await adminDb.collection("transfers").where("status", "==", "PENDING").get();

    let reconciledCount = 0;
    let refundCount = 0;
    const authHeader = req.headers.get("Authorization") || "";
    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

    for (const doc of pendingTransfersSnap.docs) {
      const transferData = doc.data();
      const reference = doc.id;
      const createdAt = transferData.createdAt;

      if (!createdAt) continue;

      const createdTime = new Date(createdAt).getTime();
      const ageMinutes = (Date.now() - createdTime) / (60 * 1000);

      // Check if older than 10 minutes
      if (ageMinutes >= 10) {
        console.log(`[Reconciliation Tool] Transfer ${reference} is pending for ${ageMinutes.toFixed(1)} minutes. Fetching latest status from Gateway...`);
        try {
          const statusRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer/status/${reference}`, {
            headers: {
              "Authorization": authHeader,
              "Content-Type": "application/json"
            }
          });

          if (statusRes.ok) {
            const statusData = await statusRes.json();
            const latestStatus = statusData.status; // "SUCCESS", "FAILED", "PENDING"

            console.log(`[Reconciliation Tool] Gateway status response for ${reference}: ${latestStatus}`);

            if (latestStatus === "SUCCESS") {
              await adminDb.collection("transfers").doc(reference).update({
                status: "SUCCESS",
                updatedAt: new Date().toISOString()
              });
              reconciledCount++;
            } else if (latestStatus === "FAILED" || latestStatus === "REVERSED") {
              // Run atomic refund transaction
              const userRef = adminDb.collection("users").doc(transferData.userId);
              const transferRef = adminDb.collection("transfers").doc(reference);

              await adminDb.runTransaction(async (transaction) => {
                const trDoc = await transaction.get(transferRef);
                const trData = trDoc.data() || {};

                if (trData.status !== "PENDING" || trData.refunded) {
                  return; // Already refunded or terminal status
                }

                const totalRefund = (Number(trData.amount) || 0) + (Number(trData.fee) || 0);
                const userId = trData.userId;

                if (userId && userId !== "N/A") {
                  const uDoc = await transaction.get(userRef);
                  if (uDoc.exists) {
                    transaction.update(userRef, {
                      balance: FieldValue.increment(totalRefund)
                    });

                    // Ledger transaction record
                    const ledgerRef = adminDb.collection("transactions").doc(`tx-REFUND-${reference}`);
                    transaction.set(ledgerRef, {
                      userId,
                      amount: totalRefund,
                      currency: "NGN",
                      reference: `REFUND-${reference}`,
                      type: "DEPOSIT",
                      description: `Reconciliation Refund for failed transfer: ${trData.description || `Transfer to ${trData.recipientName}`}`,
                      recipientName: trData.recipientName || "Self",
                      status: "SUCCESS",
                      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
                      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
                      fee: 0,
                      createdAt: new Date().toISOString(),
                    });

                    transaction.update(transferRef, {
                      status: "FAILED",
                      refunded: true,
                      refundedAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    });

                    refundCount++;
                  }
                }
              });
              reconciledCount++;
            }
          }
        } catch (fetchErr: unknown) {
          const err = fetchErr as Error;
          console.error(`[Reconciliation Tool] Failed to reconcile transfer ${reference}:`, err.message);
        }
      }
    }

    console.log(`[Reconciliation Scan Complete] Detected ${inconsistencies.length} general ledger discrepancies. Reconciled ${reconciledCount} pending transfers, executed ${refundCount} refunds.`);

    return NextResponse.json({
      success: true,
      status: inconsistencies.length === 0 ? "BALANCED" : "DISCREPANCY_FOUND",
      timestamp: new Date().toISOString(),
      summary: {
        totalFlutterwaveLogs: flwDocs.length,
        totalGeneralLedgerLogs: ledgerDocs.length,
        totalUsersChecked: users.length,
        inconsistenciesFound: inconsistencies.length,
        pendingTransfersReconciled: reconciledCount,
        refundsExecuted: refundCount,
      },
      inconsistencies,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Reconciliation Exception] Tool execution crashed:", error.message);
    return NextResponse.json({ error: "Reconciliation tool failed", details: error.message }, { status: 500 });
  }
}
