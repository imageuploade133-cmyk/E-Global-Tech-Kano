import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export interface OutwardTransferRecord {
  id: string;
  userId: string;
  reference: string;
  flutterwaveTransferId?: string | null;
  amount: number;
  fee: number;
  totalDebit: number;
  recipientName: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  currency: string;
  status: "PROCESSING" | "SUCCESS" | "FAILED" | "REVERSED" | "PROCESSING_DELAYED";
  createdAt: string;
  completedAt?: string | null;
  failureReason?: string | null;
}

export class TransferRecoveryService {
  /**
   * Scans and resolves stuck outward transfers currently in `"PROCESSING"` or `"PROCESSING_DELAYED"` states.
   * Performs real-time status verifications with Flutterwave and executes safe atomic refunds on failure.
   */
  static async recoverProcessingTransfers(): Promise<{
    processedCount: number;
    successCount: number;
    reversedCount: number;
    delayedCount: number;
  }> {
    let processedCount = 0;
    let successCount = 0;
    let reversedCount = 0;
    let delayedCount = 0;

    console.log("[Transfer Recovery Service] Starting automated outward transfer reconciliation scan...");

    try {
      // 1. Query for outward transfers that are still processing
      const processingSnap = await adminDb.collection("wallet_transfers")
        .where("status", "in", ["PROCESSING", "PROCESSING_DELAYED"])
        .get();

      if (processingSnap.empty) {
        console.log("[Transfer Recovery Service] No processing or delayed transfers found. Reconciliation complete.");
        return { processedCount, successCount, reversedCount, delayedCount };
      }

      console.log(`[Transfer Recovery Service] Found ${processingSnap.size} transfers in PROCESSING state. Resolving...`);

      for (const doc of processingSnap.docs) {
        processedCount++;
        const transfer = doc.data() as OutwardTransferRecord;
        const refId = transfer.reference;
        const userId = transfer.userId;
        const totalDebit = transfer.totalDebit;

        try {
          // 2. Query Flutterwave for the latest status of this transfer by reference
          const flwRes = await fetch(`${FLW_BASE_URL}/transfers?reference=${refId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${FLW_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          });

          const resData = await flwRes.json();

          if (!flwRes.ok || resData.status !== "success" || !Array.isArray(resData.data) || resData.data.length === 0) {
            console.warn(`[Transfer Recovery] Reference ${refId} not found or query failed on Flutterwave API. Checking age...`);

            // Check if processing for > 30 minutes to flag as delayed
            const createdAtMs = new Date(transfer.createdAt).getTime();
            const ageMinutes = (Date.now() - createdAtMs) / (60 * 1000);

            if (ageMinutes > 30 && transfer.status !== "PROCESSING_DELAYED") {
              await adminDb.collection("wallet_transfers").doc(refId).update({
                status: "PROCESSING_DELAYED",
                updatedAt: new Date().toISOString(),
              });
              delayedCount++;
              console.log(`[Transfer Recovery] Flagged transfer ${refId} as PROCESSING_DELAYED (> 30 mins).`);
            }
            continue;
          }

          const flwTransfer = resData.data[0];
          const flwStatus = flwTransfer.status; // SUCCESSFUL, FAILED, REVERSED, PENDING, NEW, etc.

          console.log(`[Transfer Recovery] Resolved reference ${refId} status on Flutterwave: ${flwStatus}`);

          if (flwStatus === "SUCCESSFUL") {
            // SUCCESS: Update database to SUCCESS and finalize
            await adminDb.runTransaction(async (transaction) => {
              const trfRef = adminDb.collection("wallet_transfers").doc(refId);
              const ledgerRef = adminDb.collection("transactions").doc(`tx-${refId}`);

              transaction.update(trfRef, {
                status: "SUCCESS",
                completedAt: new Date().toISOString(),
              });

              transaction.update(ledgerRef, {
                status: "SUCCESS",
                description: "TRANSFER_SUCCESS: Outward transfer settled successfully.",
              });
            });

            successCount++;
            console.log(`[Transfer Recovery] Reference ${refId} successfully updated to SUCCESS.`);

            logPaymentEvent({
              category: "Transfer",
              userId,
              tx_ref: refId,
              amount: transfer.amount,
              currency: "NGN",
              message: `Reconciliation success: marked transfer ${refId} as SUCCESS.`,
            });

          } else if (flwStatus === "FAILED" || flwStatus === "REVERSED") {
            const reason = flwTransfer.complete_message || "Flutterwave transaction failed.";
            console.warn(`[Transfer Recovery] Reference ${refId} failed on Flutterwave. Executing safe atomic refund reversal...`);

            // FAILURE: Credit user balance atomically and mark doc as REVERSED
            await adminDb.runTransaction(async (transaction) => {
              const trfRef = adminDb.collection("wallet_transfers").doc(refId);
              const ledgerRef = adminDb.collection("transactions").doc(`tx-${refId}`);

              // Double refund prevention check
              const trfSnap = await transaction.get(trfRef);
              if (trfSnap.exists && trfSnap.data()?.status === "REVERSED") {
                console.log(`[Transfer Recovery Reversal Bypass] Reference ${refId} already reversed. Skipping.`);
                return;
              }

              // A. Credit totalDebit back to wallet balance
              await WalletService.creditWallet(transaction, {
                userId,
                amount: totalDebit,
                currency: "NGN",
                reference: `${refId}-reversal`,
                docId: `tx-${refId}-reversal`,
                description: `TRANSFER_REVERSAL: Refund for failed outward transfer: ${reason}`,
                recipientName: "System Refund",
              });

              // B. Update transfer doc status to REVERSED with failureReason
              transaction.update(trfRef, {
                status: "REVERSED",
                failureReason: reason,
                completedAt: new Date().toISOString(),
              });

              // C. Update original ledger transaction status to FAILED
              transaction.update(ledgerRef, {
                status: "FAILED",
                description: `FAILED: ${reason}`,
              });
            });

            reversedCount++;
            console.log(`[Transfer Recovery] Reference ${refId} successfully refunded and marked as REVERSED.`);

            logPaymentEvent({
              category: "Errors",
              userId,
              tx_ref: refId,
              amount: transfer.amount,
              currency: "NGN",
              message: `Reconciliation reversal: outward transfer failed on gateway. Refunded ${totalDebit} to user wallet.`,
            });

          } else {
            // Still PENDING or NEW: Do NOT refund. Just check if processing for > 30 minutes to flag as delayed
            const createdAtMs = new Date(transfer.createdAt).getTime();
            const ageMinutes = (Date.now() - createdAtMs) / (60 * 1000);

            if (ageMinutes > 30 && transfer.status !== "PROCESSING_DELAYED") {
              await adminDb.collection("wallet_transfers").doc(refId).update({
                status: "PROCESSING_DELAYED",
                updatedAt: new Date().toISOString(),
              });
              delayedCount++;
              console.log(`[Transfer Recovery] Flagged pending transfer ${refId} as PROCESSING_DELAYED (> 30 mins).`);
            }
          }

        } catch (innerErr: unknown) {
          const error = innerErr as Error;
          console.error(`[Transfer Recovery Error] Failed to reconcile transfer ${refId}:`, error.message);
        }
      }

    } catch (err: unknown) {
      const error = err as Error;
      console.error("[Transfer Recovery Exception] General reconciliation scan failed:", error.message);
    }

    return { processedCount, successCount, reversedCount, delayedCount };
  }
}
