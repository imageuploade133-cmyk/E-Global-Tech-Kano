import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export interface BulkTransferRecipientInput {
  accountNumber: string;
  bankCode: string;
  recipientName: string;
  amount: number;
}

export class BulkTransferService {
  /**
   * Validates recipients list and queues a bulk transfer idempotently.
   * Debits the total sum and fees atomically inside a single Firestore Transaction.
   */
  static async queueBulkTransfer(
    userId: string,
    title: string,
    recipients: BulkTransferRecipientInput[]
  ): Promise<{ success: boolean; bulkTransferId: string; newBalance: number }> {
    if (!userId) throw new Error("Unauthenticated request context.");
    if (!Array.isArray(recipients) || recipients.length === 0) {
      throw new Error("Bulk transfer requires at least one recipient.");
    }
    if (recipients.length > 200) {
      throw new Error("Bulk transfer cannot exceed 200 recipients per batch.");
    }

    // 1. Validate recipients, check duplicate accounts/references, and calculate totals
    const uniqueAccounts = new Set<string>();
    let totalAmount = 0;
    const flatFeePerRecipient = 10.00; // standard flat transfer fee

    for (const recipient of recipients) {
      const { accountNumber, bankCode, amount, recipientName } = recipient;

      if (!accountNumber || accountNumber.length !== 10 || isNaN(Number(accountNumber))) {
        throw new Error(`Invalid account number: ${accountNumber}. Must be exactly 10 digits.`);
      }
      if (!bankCode) {
        throw new Error(`Missing bank code for account ${accountNumber}.`);
      }
      if (!recipientName) {
        throw new Error(`Recipient account ${accountNumber} must be verified before transfer.`);
      }
      if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
        throw new Error(`Invalid transfer amount ₦${amount} for account ${accountNumber}. Must be positive.`);
      }

      // Check fractional money exploits
      const amtStr = amount.toString();
      if (amtStr.includes(".") && amtStr.split(".")[1].length > 2) {
        throw new Error(`Transfer amount ₦${amount} has more than 2 decimal places.`);
      }

      // Prevent duplicate recipients in the same batch
      const uniqueKey = `${bankCode}-${accountNumber}`;
      if (uniqueAccounts.has(uniqueKey)) {
        throw new Error(`Duplicate recipient account found in same batch: Acc ${accountNumber} (Bank ${bankCode}).`);
      }
      uniqueAccounts.add(uniqueKey);

      totalAmount += amount;
    }

    const totalFee = recipients.length * flatFeePerRecipient;
    const totalDeduction = totalAmount + totalFee;

    // Enforce business batch limits
    if (totalDeduction > 5000000) {
      throw new Error("Bulk transfer total batch limit cannot exceed ₦5,000,000.00 per queue.");
    }

    const timestamp = Date.now();
    const batchReference = `bulk-${timestamp}-${userId}`;
    const bulkTransferId = batchReference;

    console.log(`[Bulk Transfer] Queuing Batch: ${bulkTransferId}, Count: ${recipients.length}, Total Deduction: ₦${totalDeduction}`);

    const bulkRef = adminDb.collection("bulk_transfers").doc(bulkTransferId);

    // 2. Perform safe, idempotent atomic balance debiting inside a Firestore transaction
    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      // Check idempotency of batch reference
      const existingDoc = await transaction.get(bulkRef);
      if (existingDoc.exists) {
        throw new Error(`Bulk transfer batch ${bulkTransferId} already exists.`);
      }

      // Debit totalDeduction atomically from wallet balance (also creates ledger TRANSFER record)
      const debitRes = await WalletService.debitWallet(transaction, {
        userId,
        amount: totalDeduction,
        currency: "NGN",
        reference: bulkTransferId,
        docId: `tx-${bulkTransferId}`,
        type: "TRANSFER",
        description: `Bulk Transfer Batch: ${title || "December Salary"}`,
        recipientName: `Batch (${recipients.length} Recs)`,
        fee: totalFee,
        isPending: true, // starts pending until all items are settled or reversed
      });

      // Write 'bulk_transfers' document
      transaction.set(bulkRef, {
        id: bulkTransferId,
        userId,
        reference: batchReference,
        title: title || "Bulk Wallet Funding",
        totalAmount,
        totalFee,
        recipientCount: recipients.length,
        status: "QUEUED", // Initial Queue state
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      // Write individual 'bulk_transfer_items' documents securely
      recipients.forEach((recipient, index) => {
        const itemIndex = (index + 1).toString().padStart(3, "0");
        const itemRefId = `${batchReference}-${itemIndex}`; // unique per-recipient reference

        const itemDocRef = adminDb.collection("bulk_transfer_items").doc(itemRefId);
        transaction.set(itemDocRef, {
          id: itemRefId,
          bulkTransferId,
          reference: itemRefId,
          flutterwaveTransferId: null,
          recipientName: recipient.recipientName,
          accountNumber: recipient.accountNumber,
          bankCode: recipient.bankCode,
          amount: recipient.amount,
          fee: flatFeePerRecipient,
          status: "QUEUED",
          failureReason: null,
          refunded: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
      });

      return {
        newBalance: debitRes.newBalance,
      };
    });

    console.log(`[Bulk Transfer Queued] Wallet balance debited atomically. Remaining: ₦${transactionResult.newBalance}`);

    logPaymentEvent({
      category: "Transfer",
      userId,
      tx_ref: batchReference,
      amount: totalAmount,
      currency: "NGN",
      message: `Successfully queued bulk transfer batch ${bulkTransferId} with ${recipients.length} recipients.`,
    });

    return {
      success: true,
      bulkTransferId,
      newBalance: transactionResult.newBalance,
    };
  }

  /**
   * Processes a queued batch by dispatching it to Flutterwave's Bulk Transfer API in the background.
   */
  static async processQueuedBatch(bulkTransferId: string): Promise<void> {
    console.log(`[Bulk Transfer Worker] Processing queued batch: ${bulkTransferId}...`);

    try {
      const bulkDocRef = adminDb.collection("bulk_transfers").doc(bulkTransferId);
      const bulkDoc = await bulkDocRef.get();

      if (!bulkDoc.exists) {
        console.error(`[Bulk Transfer Worker] Batch ${bulkTransferId} was not found in Firestore.`);
        return;
      }

      const bulkData = bulkDoc.data() || {};
      if (bulkData.status !== "QUEUED") {
        console.log(`[Bulk Transfer Worker] Batch ${bulkTransferId} is already in state: ${bulkData.status}. Skipping.`);
        return;
      }

      // Mark batch status as PROCESSING
      await bulkDocRef.update({
        status: "PROCESSING",
        updatedAt: new Date().toISOString(),
      });

      // Load all individual items in this batch
      const itemsSnap = await adminDb.collection("bulk_transfer_items")
        .where("bulkTransferId", "==", bulkTransferId)
        .where("status", "==", "QUEUED")
        .get();

      if (itemsSnap.empty) {
        console.log(`[Bulk Transfer Worker] No queued items found for batch ${bulkTransferId}.`);
        return;
      }

      const bulkDataPayload = itemsSnap.docs.map((doc) => {
        const item = doc.data();
        return {
          bank_code: item.bankCode,
          account_number: item.accountNumber,
          amount: item.amount,
          narration: `Bulk Settlement: ${bulkData.title}`,
          currency: "NGN",
          reference: item.reference,
        };
      });

      console.log(`[Bulk Transfer Worker] Dispatching bulk_data payload of ${bulkDataPayload.length} items to Flutterwave...`);

      // Call Flutterwave bulk transfer API
      const response = await fetch(`${FLW_BASE_URL}/bulk-transfers`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${FLW_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: bulkData.title || "Bulk Settlement",
          bulk_data: bulkDataPayload,
        }),
      });

      const resData = await response.json();
      console.log(`[Bulk Transfer Worker Response] Status: ${response.status}, Body: ${JSON.stringify(resData)}`);

      if (response.ok && resData.status === "success" && resData.data) {
        const flwBulkId = resData.data.id.toString();

        // Batch accepted: Update all items to status "PROCESSING" and attach FLW batch ID
        const batch = adminDb.batch();
        itemsSnap.docs.forEach((doc) => {
          batch.update(doc.ref, {
            status: "PROCESSING",
            flutterwaveTransferId: flwBulkId,
            updatedAt: new Date().toISOString(),
          });
        });

        // Set parent bulk doc details
        batch.update(bulkDocRef, {
          flutterwaveTransferId: flwBulkId,
          updatedAt: new Date().toISOString(),
        });

        await batch.commit();
        console.log(`[Bulk Transfer Worker Success] Successfully dispatched batch ${bulkTransferId} to Flutterwave.`);

      } else {
        // Flutterwave explicitly rejected the entire batch! Trigger safe full refund reversal
        const rejectReason = resData.message || "Failed to register bulk transfer with Flutterwave API.";
        console.warn(`[Bulk Transfer Rejection] Entire batch rejected: ${rejectReason}. Executing full refund reversal...`);

        await this.reverseFullBatch(bulkTransferId, bulkData.userId, bulkData.totalAmount + bulkData.totalFee, rejectReason);
      }

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`[Bulk Transfer Worker Exception] Failed to process batch ${bulkTransferId}:`, error.message);

      // Do NOT refund on timeout/network crashes. Keep status as PROCESSING and let recovery service handle it.
      await adminDb.collection("bulk_transfers").doc(bulkTransferId).update({
        status: "PROCESSING",
        failureReason: `Network Connection Failure: ${error.message}`,
        updatedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * Atomically refunds the entire batch deduction and updates status to FAILED.
   */
  private static async reverseFullBatch(
    bulkTransferId: string,
    userId: string,
    totalDeduction: number,
    reason: string
  ): Promise<void> {
    try {
      const bulkRef = adminDb.collection("bulk_transfers").doc(bulkTransferId);
      const ledgerRef = adminDb.collection("transactions").doc(`tx-${bulkTransferId}`);

      await adminDb.runTransaction(async (transaction) => {
        // Check if already reversed
        const bulkSnap = await transaction.get(bulkRef);
        if (bulkSnap.exists && bulkSnap.data()?.status === "FAILED") {
          return;
        }

        // 1. Refund the total sum (amount + fees) atomically using WalletService
        await WalletService.creditWallet(transaction, {
          userId,
          amount: totalDeduction,
          currency: "NGN",
          reference: `${bulkTransferId}-reversal`,
          docId: `tx-${bulkTransferId}-reversal`,
          description: `TRANSFER_REVERSAL: Refund for failed bulk transfer batch: ${reason}`,
          recipientName: "System Refund",
        });

        // 2. Set parent status as FAILED
        transaction.update(bulkRef, {
          status: "FAILED",
          failureReason: reason,
          updatedAt: new Date().toISOString(),
        });

        // 3. Mark ledger transaction status as FAILED
        transaction.update(ledgerRef, {
          status: "FAILED",
          description: `FAILED: Bulk transfer batch rejected: ${reason}`,
        });

        // 4. Mark all individual items as FAILED / REVERSED
        const itemsSnap = await adminDb.collection("bulk_transfer_items")
          .where("bulkTransferId", "==", bulkTransferId)
          .get();

        itemsSnap.docs.forEach((doc) => {
          transaction.update(doc.ref, {
            status: "REVERSED",
            failureReason: "Entire batch rejected by gateway",
            refunded: true,
            updatedAt: new Date().toISOString(),
          });
        });
      });

      console.log(`[Bulk Transfer Reversal Success] Refunded ₦${totalDeduction} to user ${userId} for batch ${bulkTransferId}.`);

    } catch (err: unknown) {
      const error = err as Error;
      console.error(`[CRITICAL] FAILED TO EXECUTE BULK TRANSFER REVERSAL FOR BATCH ${bulkTransferId}:`, error.message);
    }
  }
}
