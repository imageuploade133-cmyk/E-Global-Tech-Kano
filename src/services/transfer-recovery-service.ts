import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";

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

export interface BulkTransferItemRecord {
  id: string;
  bulkTransferId: string;
  reference: string;
  flutterwaveTransferId?: string | null;
  recipientName: string;
  accountNumber: string;
  bankCode: string;
  amount: number;
  fee: number;
  status: "QUEUED" | "PROCESSING" | "SUCCESS" | "FAILED" | "REVERSED";
  failureReason?: string | null;
  refunded: boolean;
  createdAt: string;
  updatedAt: string;
}

export class TransferRecoveryService {
  /**
   * Scans and resolves stuck outward transfers and bulk transfer items dynamically.
   * Performs real-time status verifications with Flutterwave and executes safe atomic refunds on failure.
   */
  static async recoverProcessingTransfers(): Promise<{
    processedSingleCount: number;
    processedBulkItemsCount: number;
    successCount: number;
    reversedCount: number;
    delayedCount: number;
  }> {
    let processedSingleCount = 0;
    let processedBulkItemsCount = 0;
    let successCount = 0;
    let reversedCount = 0;
    let delayedCount = 0;

    console.log("[Transfer Recovery Service] Starting automated transfer reconciliation scan...");

    try {
      // 1. QUERY AND RESOLVE SINGLE TRANSFERS
      const processingSnap = await adminDb.collection("wallet_transfers")
        .where("status", "in", ["PROCESSING", "PROCESSING_DELAYED"])
        .get();

      console.log(`[Transfer Recovery] Found ${processingSnap.size} processing single transfers.`);

      for (const doc of processingSnap.docs) {
        processedSingleCount++;
        const transfer = doc.data() as OutwardTransferRecord;
        const refId = transfer.reference;
        const userId = transfer.userId;
        const totalDebit = transfer.totalDebit;

        try {
          const flwRes = await fetch(`${FLW_BASE_URL}/transfers?reference=${refId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${FLW_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          });

          const resData = await flwRes.json();

          if (!flwRes.ok || resData.status !== "success" || !Array.isArray(resData.data) || resData.data.length === 0) {
            const createdAtMs = new Date(transfer.createdAt).getTime();
            const ageMinutes = (Date.now() - createdAtMs) / (60 * 1000);

            if (ageMinutes > 30 && transfer.status !== "PROCESSING_DELAYED") {
              await adminDb.collection("wallet_transfers").doc(refId).update({
                status: "PROCESSING_DELAYED",
                updatedAt: new Date().toISOString(),
              });
              delayedCount++;
              console.log(`[Transfer Recovery] Flagged single transfer ${refId} as PROCESSING_DELAYED (> 30 mins).`);
            }
            continue;
          }

          const flwTransfer = resData.data[0];
          const flwStatus = flwTransfer.status;

          if (flwStatus === "SUCCESSFUL") {
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

          } else if (flwStatus === "FAILED" || flwStatus === "REVERSED") {
            const reason = flwTransfer.complete_message || "Flutterwave transaction failed.";

            await adminDb.runTransaction(async (transaction) => {
              const trfRef = adminDb.collection("wallet_transfers").doc(refId);
              const ledgerRef = adminDb.collection("transactions").doc(`tx-${refId}`);

              const trfSnap = await transaction.get(trfRef);
              if (trfSnap.exists && trfSnap.data()?.status === "REVERSED") return;

              await WalletService.creditWallet(transaction, {
                userId,
                amount: totalDebit,
                currency: "NGN",
                reference: `${refId}-reversal`,
                docId: `tx-${refId}-reversal`,
                description: `TRANSFER_REVERSAL: Refund for failed outward transfer: ${reason}`,
                recipientName: "System Refund",
              });

              transaction.update(trfRef, {
                status: "REVERSED",
                failureReason: reason,
                completedAt: new Date().toISOString(),
              });

              transaction.update(ledgerRef, {
                status: "FAILED",
                description: `FAILED: ${reason}`,
              });
            });

            reversedCount++;
            console.log(`[Transfer Recovery] Reference ${refId} successfully refunded and marked as REVERSED.`);
          }

        } catch (innerErr: unknown) {
          console.error(`[Transfer Recovery] Failed to reconcile transfer ${refId}:`, (innerErr as Error).message);
        }
      }

      // 2. QUERY AND RESOLVE STUCK BULK TRANSFER ITEMS
      const processingBulkItemsSnap = await adminDb.collection("bulk_transfer_items")
        .where("status", "==", "PROCESSING")
        .get();

      console.log(`[Transfer Recovery] Found ${processingBulkItemsSnap.size} processing bulk transfer items.`);

      for (const doc of processingBulkItemsSnap.docs) {
        processedBulkItemsCount++;
        const item = doc.data() as BulkTransferItemRecord;
        const refId = item.reference;
        const bId = item.bulkTransferId;

        try {
          const flwRes = await fetch(`${FLW_BASE_URL}/transfers?reference=${refId}`, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${FLW_SECRET_KEY}`,
              "Content-Type": "application/json",
            },
          });

          const resData = await flwRes.json();

          if (!flwRes.ok || resData.status !== "success" || !Array.isArray(resData.data) || resData.data.length === 0) {
            continue;
          }

          const flwTransfer = resData.data[0];
          const flwStatus = flwTransfer.status;

          const itemRef = adminDb.collection("bulk_transfer_items").doc(refId);

          if (flwStatus === "SUCCESSFUL") {
            await adminDb.runTransaction(async (transaction) => {
              const itemSnap = await transaction.get(itemRef);
              if (!itemSnap.exists || itemSnap.data()?.status !== "PROCESSING") return;

              transaction.update(itemRef, {
                status: "SUCCESS",
                updatedAt: new Date().toISOString(),
              });

              // Check if this was the last unresolved item in parent batch to set status
              const parentRef = adminDb.collection("bulk_transfers").doc(bId);
              const unresolvedSnap = await adminDb.collection("bulk_transfer_items")
                .where("bulkTransferId", "==", bId)
                .where("status", "in", ["QUEUED", "PROCESSING"])
                .get();

              if (unresolvedSnap.size <= 1) {
                const failedSnap = await adminDb.collection("bulk_transfer_items")
                  .where("bulkTransferId", "==", bId)
                  .where("status", "in", ["FAILED", "REVERSED"])
                  .get();

                const finalStatus = failedSnap.size > 0 ? "PARTIAL_SUCCESS" : "SUCCESSFUL";
                transaction.update(parentRef, {
                  status: finalStatus,
                  updatedAt: new Date().toISOString(),
                });

                const ledgerRef = adminDb.collection("transactions").doc(`tx-${bId}`);
                transaction.update(ledgerRef, {
                  status: "SUCCESS",
                  description: `TRANSFER_SUCCESS: Bulk batch settled as ${finalStatus}`,
                });
              }
            });

            successCount++;
            console.log(`[Transfer Recovery - Bulk Item] Marked item ${refId} as SUCCESS.`);

          } else if (flwStatus === "FAILED" || flwStatus === "REVERSED") {
            const reason = flwTransfer.complete_message || "Transfer failed on gateway.";

            await adminDb.runTransaction(async (transaction) => {
              const itemSnap = await transaction.get(itemRef);
              if (!itemSnap.exists || itemSnap.data()?.status !== "PROCESSING") return;

              const parentRef = adminDb.collection("bulk_transfers").doc(bId);
              const parentDoc = await transaction.get(parentRef);

              if (parentDoc.exists) {
                const pData = parentDoc.data() || {};
                const userId = pData.userId;
                const refundAmount = Number(item.amount) + Number(item.fee || 10.00);

                await WalletService.creditWallet(transaction, {
                  userId,
                  amount: refundAmount,
                  currency: "NGN",
                  reference: `${refId}-reversal`,
                  docId: `tx-${refId}-reversal`,
                  description: `TRANSFER_REVERSAL: Refund for failed bulk recipient: ${item.recipientName} (${reason})`,
                  recipientName: "System Refund",
                });

                transaction.update(itemRef, {
                  status: "REVERSED",
                  failureReason: reason,
                  refunded: true,
                  updatedAt: new Date().toISOString(),
                });

                const unresolvedSnap = await adminDb.collection("bulk_transfer_items")
                  .where("bulkTransferId", "==", bId)
                  .where("status", "in", ["QUEUED", "PROCESSING"])
                  .get();

                if (unresolvedSnap.size <= 1) {
                  transaction.update(parentRef, {
                    status: "PARTIAL_SUCCESS",
                    updatedAt: new Date().toISOString(),
                  });

                  const ledgerRef = adminDb.collection("transactions").doc(`tx-${bId}`);
                  transaction.update(ledgerRef, {
                    status: "SUCCESS",
                    description: "TRANSFER_SUCCESS: Bulk batch settled as PARTIAL_SUCCESS",
                  });
                }
              }
            });

            reversedCount++;
            console.log(`[Transfer Recovery - Bulk Item Reversal] Item ${refId} refunded and marked as REVERSED.`);
          }

        } catch (innerErr: unknown) {
          console.error(`[Transfer Recovery - Bulk Item Error] Failed resolving item ${refId}:`, (innerErr as Error).message);
        }
      }

    } catch (err: unknown) {
      const error = err as Error;
      console.error("[Transfer Recovery Exception] General reconciliation scan failed:", error.message);
    }

    return {
      processedSingleCount,
      processedBulkItemsCount,
      successCount,
      reversedCount,
      delayedCount,
    };
  }
}
