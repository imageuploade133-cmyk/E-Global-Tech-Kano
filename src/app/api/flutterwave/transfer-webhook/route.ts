import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/lib/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";
import { isRateLimited } from "@/lib/rate-limiter";

export async function POST(req: Request) {
  const startTime = Date.now();
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "127.0.0.1";

  // Rate Limiting: 60 requests per minute max for webhook endpoints
  if (isRateLimited(ip, 60, 60 * 1000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  try {
    const rawBody = await req.text();
    const signature = req.headers.get("verif-hash") || req.headers.get("x-flutterwave-signature");

    console.log(`[Transfer Webhook] Webhook request detected. Signature: ${signature ? "Present" : "Missing"}, Payload Size: ${rawBody.length} bytes`);

    // 1. Verify Webhook Signature to avoid forgery
    const isValid = flutterwaveService.validateWebhookSignature(signature, rawBody);
    if (!isValid) {
      console.warn("[Transfer Webhook Error] Invalid cryptographic signature header.");
      return NextResponse.json({ error: "Invalid cryptographic signature." }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    const { event, data } = payload;

    console.log(`[Transfer Webhook] Event Type: ${event || payload["event.type"]}, Transfer Status: ${data?.status}`);

    const reference = data?.reference;
    if (!reference) {
      console.warn("[Transfer Webhook] Webhook received without a reference ID. Ignoring.");
      return NextResponse.json({ success: true, message: "Acknowledged but reference was missing." });
    }

    const flwStatus = data.status; // SUCCESSFUL or FAILED/REJECTED
    const isBulkItem = reference.startsWith("bulk-");

    if (event === "transfer.completed") {
      if (isBulkItem) {
        // --- PROCESS BULK TRANSFER ITEM WEBHOOK OUTCOME ---
        console.log(`[Transfer Webhook - Bulk Item] Processing bulk item: ${reference}, Status: ${flwStatus}`);
        const itemRef = adminDb.collection("bulk_transfer_items").doc(reference);

        if (flwStatus === "SUCCESSFUL") {
          await adminDb.runTransaction(async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) throw new Error(`Bulk item not found: ${reference}`);

            const itemData = itemDoc.data() || {};
            if (itemData.status !== "PROCESSING") return; // already resolved

            // Update item status to SUCCESS
            transaction.update(itemRef, {
              status: "SUCCESS",
              updatedAt: new Date().toISOString(),
            });

            // Reconcile and update parent bulk batch status dynamically
            const parentRef = adminDb.collection("bulk_transfers").doc(itemData.bulkTransferId);
            const parentDoc = await transaction.get(parentRef);
            if (parentDoc.exists) {
              // Check if all items in this batch are resolved
              const unresolvedSnap = await adminDb.collection("bulk_transfer_items")
                .where("bulkTransferId", "==", itemData.bulkTransferId)
                .where("status", "in", ["QUEUED", "PROCESSING"])
                .get();

              // If this is the last unresolved item (current snap count <= 1 as we are inside transaction block)
              if (unresolvedSnap.size <= 1) {
                // Check if any had failed
                const failedSnap = await adminDb.collection("bulk_transfer_items")
                  .where("bulkTransferId", "==", itemData.bulkTransferId)
                  .where("status", "in", ["FAILED", "REVERSED"])
                  .get();

                const finalStatus = failedSnap.size > 0 ? "PARTIAL_SUCCESS" : "SUCCESSFUL";
                transaction.update(parentRef, {
                  status: finalStatus,
                  updatedAt: new Date().toISOString(),
                });

                // Update original parent ledger record status as SUCCESS
                const ledgerRef = adminDb.collection("transactions").doc(`tx-${itemData.bulkTransferId}`);
                transaction.update(ledgerRef, {
                  status: "SUCCESS",
                  description: `TRANSFER_SUCCESS: Bulk batch settled as ${finalStatus}`,
                });
              }
            }
          });

          console.log(`[Transfer Webhook - Bulk Item] Successfully marked item ${reference} as SUCCESS.`);
        } else {
          // Webhook Failure / Rejection: Execute dynamic atomic refund for THIS failed recipient only!
          const failureReason = data.complete_message || "Transfer failed on gateway.";
          console.warn(`[Transfer Webhook - Bulk Item Failure] Item ${reference} failed: ${failureReason}. Refunding recipient...`);

          await adminDb.runTransaction(async (transaction) => {
            const itemDoc = await transaction.get(itemRef);
            if (!itemDoc.exists) throw new Error(`Bulk item not found: ${reference}`);

            const itemData = itemDoc.data() || {};
            if (itemData.status !== "PROCESSING") return; // already resolved/reversed

            const parentRef = adminDb.collection("bulk_transfers").doc(itemData.bulkTransferId);
            const parentDoc = await transaction.get(parentRef);

            if (parentDoc.exists) {
              const pData = parentDoc.data() || {};
              const userId = pData.userId || "anon";
              const refundAmount = Number(itemData.amount) + Number(itemData.fee || 10.00); // reverse principal + flat fee

              // 1. Credit refund back to user atomically via WalletService
              await WalletService.creditWallet(transaction, {
                userId,
                amount: refundAmount,
                currency: "NGN",
                reference: `${reference}-reversal`,
                docId: `tx-${reference}-reversal`,
                description: `TRANSFER_REVERSAL: Refund for failed bulk recipient: ${itemData.recipientName} (${failureReason})`,
                recipientName: "System Refund",
              });

              // 2. Mark item as REVERSED
              transaction.update(itemRef, {
                status: "REVERSED",
                failureReason,
                refunded: true,
                updatedAt: new Date().toISOString(),
              });

              // 3. Reconcile parent batch status dynamically
              const unresolvedSnap = await adminDb.collection("bulk_transfer_items")
                .where("bulkTransferId", "==", itemData.bulkTransferId)
                .where("status", "in", ["QUEUED", "PROCESSING"])
                .get();

              if (unresolvedSnap.size <= 1) {
                transaction.update(parentRef, {
                  status: "PARTIAL_SUCCESS",
                  updatedAt: new Date().toISOString(),
                });

                const ledgerRef = adminDb.collection("transactions").doc(`tx-${itemData.bulkTransferId}`);
                transaction.update(ledgerRef, {
                  status: "SUCCESS",
                  description: "TRANSFER_SUCCESS: Bulk batch settled as PARTIAL_SUCCESS",
                });
              }
            }
          });

          console.log(`[Transfer Webhook - Bulk Item] Successfully refunded and marked item ${reference} as REVERSED.`);
        }
      } else {
        // --- PROCESS SINGLE DIRECT OUTWARD TRANSFER WEBHOOK OUTCOME ---
        const trfRef = adminDb.collection("wallet_transfers").doc(reference);
        const ledgerRef = adminDb.collection("transactions").doc(`tx-${reference}`);

        if (flwStatus === "SUCCESSFUL") {
          console.log(`[Transfer Webhook Success] Transfer ${reference} settled successfully. Marking ledger status as SUCCESS.`);

          await adminDb.runTransaction(async (transaction) => {
            const trfDoc = await transaction.get(trfRef);
            if (!trfDoc.exists) throw new Error(`Outward transfer record not found in Firestore: ${reference}`);

            const trfData = trfDoc.data() || {};
            if (trfData.status !== "PROCESSING" && trfData.status !== "PROCESSING_DELAYED") {
              console.log(`[Transfer Webhook Info] Transfer ${reference} already resolved (Status: ${trfData.status}). Skipping.`);
              return;
            }

            transaction.update(trfRef, {
              status: "SUCCESS",
              completedAt: new Date().toISOString(),
            });

            transaction.update(ledgerRef, {
              status: "SUCCESS",
              description: `TRANSFER_SUCCESS: Outward transfer settled successfully.`,
            });
          });

          logPaymentEvent({
            category: "Transfer",
            userId: data.fullname || "User",
            tx_ref: reference,
            amount: data.amount,
            currency: "NGN",
            message: `Outward transfer webhook successfully marked transfer ${reference} as SUCCESS.`,
            processingTimeMs: Date.now() - startTime,
          });

        } else if (flwStatus === "FAILED" || flwStatus === "REJECTED") {
          const failureReason = data.complete_message || "Flutterwave outward transaction failed.";
          console.warn(`[Transfer Webhook Failure] Transfer ${reference} failed: ${failureReason}. Triggering atomic refund reversal...`);

          await adminDb.runTransaction(async (transaction) => {
            const trfDoc = await transaction.get(trfRef);
            if (!trfDoc.exists) throw new Error(`Outward transfer record not found in Firestore: ${reference}`);

            const trfData = trfDoc.data() || {};
            if (trfData.status !== "PROCESSING" && trfData.status !== "PROCESSING_DELAYED") {
              console.log(`[Transfer Webhook Reversal Info] Transfer ${reference} already resolved (Status: ${trfData.status}). Skipping.`);
              return;
            }

            const userId = trfData.userId;
            const totalDebit = Number(trfData.totalDebit || trfData.amount);

            // A. Refund the totalDebit atomically back into the user's wallet
            await WalletService.creditWallet(transaction, {
              userId,
              amount: totalDebit,
              currency: "NGN",
              reference: `${reference}-reversal`,
              docId: `tx-${reference}-reversal`,
              description: `TRANSFER_REVERSAL: Refund for failed outward transfer: ${failureReason}`,
              recipientName: "System Refund",
            });

            // B. Update transfer doc status to REVERSED with failureReason
            transaction.update(trfRef, {
              status: "REVERSED",
              failureReason,
              completedAt: new Date().toISOString(),
            });

            // C. Update the original ledger transaction status to FAILED
            transaction.update(ledgerRef, {
              status: "FAILED",
              description: `FAILED: ${failureReason}`,
            });
          });

          logPaymentEvent({
            category: "Errors",
            tx_ref: reference,
            amount: data.amount,
            currency: "NGN",
            message: `Outward transfer failed via webhook. Refunded ${data.amount} to user. Ref: ${reference}`,
            processingTimeMs: Date.now() - startTime,
          });
        }
      }
    }

    // Always acknowledge the webhook with HTTP 200
    return NextResponse.json({ success: true, message: "Webhook acknowledged." }, { status: 200 });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer Webhook Exception] Process failed:", error.message);
    return NextResponse.json({ error: "Webhook Processing Error" }, { status: 500 });
  }
}
