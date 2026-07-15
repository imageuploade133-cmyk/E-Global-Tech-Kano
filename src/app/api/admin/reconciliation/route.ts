import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAdminAuth } from "@/lib/admin-auth";

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

    // Map general ledger records by transactionId (ledger documents have document IDs in format `tx-${transactionId}` or a random key,
    // but they store the flwId or reference).
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
    // We sum up successful ledger entries (DEPOSIT as positive, TRANSFER/withdrawals as negative) and check if it tallies with users.balance
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

      // Report high variance discrepancies (e.g. if the discrepancy doesn't resolve to 0, which could be due to manual credits or admin mutations)
      if (Math.abs(calculatedBalance - currentBalance) > 10.0) {
        inconsistencies.push({
          type: "USER_BALANCE_ANOMALY",
          id: userId,
          details: `User balance check variance. Firestore balance states: ₦${currentBalance}, but calculated general ledger tally says: ₦${calculatedBalance} (Variance: ₦${(calculatedBalance - currentBalance).toFixed(2)})`,
        });
      }
    });

    console.log(`[Reconciliation Scan Complete] Detected ${inconsistencies.length} discrepancies.`);

    return NextResponse.json({
      success: true,
      status: inconsistencies.length === 0 ? "BALANCED" : "DISCREPANCY_FOUND",
      timestamp: new Date().toISOString(),
      summary: {
        totalFlutterwaveLogs: flwDocs.length,
        totalGeneralLedgerLogs: ledgerDocs.length,
        totalUsersChecked: users.length,
        inconsistenciesFound: inconsistencies.length,
      },
      inconsistencies,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Reconciliation Exception] Tool execution crashed:", error.message);
    return NextResponse.json({ error: "Reconciliation tool failed", details: error.message }, { status: 500 });
  }
}
