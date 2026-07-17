import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/lib/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";

// A robust parser that extracts the userId correctly from tx_ref for backup checks
function extractUserIdFromTxRef(txRef: string): string | null {
  if (!txRef) return null;
  if (txRef.startsWith("user-wallet-")) {
    return txRef.substring("user-wallet-".length);
  }
  if (!txRef.startsWith("flw-tx-")) return null;
  const remaining = txRef.substring("flw-tx-".length);
  const parts = remaining.split("-");
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      parts.pop();
    }
    return parts.join("-");
  }
  return null;
}

export interface WalletFundingResult {
  success: boolean;
  duplicate?: boolean;
  message: string;
  fundedAmount?: number;
  newBalance?: number;
}

/**
 * Reusable payment verification and atomic wallet crediting function.
 * Shared by both the browser-redirect (/api/flutterwave/verify) and the server webhook (/api/flutterwave/webhook).
 *
 * @param transactionId - The Flutterwave transaction ID to verify.
 * @param expectedAuthUid - Optional client-side authenticated UID to enforce user-to-payment ownership (used on redirects).
 */
export async function verifyAndCreditWallet(
  transactionId: string,
  expectedAuthUid?: string
): Promise<WalletFundingResult> {
  const startTime = Date.now();
  console.log(`[Wallet Funding Library] Initiating verifyAndCreditWallet for Transaction ID: ${transactionId}`);

  try {
    // 1. Verify with Flutterwave's Verify API first before crediting any wallet
    const flwRes = await flutterwaveService.verifyTransaction(transactionId);

    // Validate payment status
    if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
      console.warn(`[verification failed] Flutterwave status check was negative:`, flwRes);
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        message: "Transaction status checked negative on Flutterwave",
        processingTimeMs: Date.now() - startTime,
      });
      return {
        success: false,
        message: "Transaction was not successfully settled on Flutterwave rail.",
      };
    }

    const { amount, currency, tx_ref, customer } = flwRes.data;
    const numericAmount = Number(amount);

    // Validate payment amount before crediting
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        tx_ref,
        amount: numericAmount,
        currency,
        message: "Invalid payment amount validation failed.",
        processingTimeMs: Date.now() - startTime,
      });
      return { success: false, message: "Invalid payment amount. Validation failed." };
    }

    // Validate currency before crediting
    if (currency !== "NGN" && currency !== "USD") {
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        tx_ref,
        amount: numericAmount,
        currency,
        message: `Unsupported transaction currency: ${currency}`,
        processingTimeMs: Date.now() - startTime,
      });
      return { success: false, message: `Unsupported transaction currency: ${currency}` };
    }

    // Validate transaction reference format (Allow flw-tx- or user-wallet- prefixes)
    if (!tx_ref || (!tx_ref.startsWith("flw-tx-") && !tx_ref.startsWith("user-wallet-"))) {
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        tx_ref,
        amount: numericAmount,
        currency,
        message: "Invalid transaction reference prefix.",
        processingTimeMs: Date.now() - startTime,
      });
      return { success: false, message: "Invalid transaction reference prefix." };
    }

    // Retrieve userId: first choice is metadata, fallback to safe tx_ref parser
    let userId = flwRes.data.meta?.userId || flwRes.data.metadata?.userId;

    if (!userId) {
      console.log(`[Verification] Metadata is missing. Falling back to parsing tx_ref: ${tx_ref}`);
      userId = extractUserIdFromTxRef(tx_ref);
    }

    if (!userId) {
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        tx_ref,
        amount: numericAmount,
        currency,
        message: "User ID context not resolved from reference or metadata.",
        processingTimeMs: Date.now() - startTime,
      });
      return {
        success: false,
        message: "Verification Failed: User ID context not resolved from transaction reference or metadata.",
      };
    }

    // Ensure client-side Firebase Auth UID matches the transaction reference owner if expectedAuthUid is supplied
    if (expectedAuthUid && expectedAuthUid !== userId) {
      console.warn(`[Verification Blocked] Access denied: Authenticated user (${expectedAuthUid}) does not match reference owner (${userId})`);
      logPaymentEvent({
        category: "Verification Failed",
        transactionId,
        tx_ref,
        userId,
        amount: numericAmount,
        currency,
        message: `Auth mismatch: authenticated UID ${expectedAuthUid} does not match reference owner ${userId}`,
        processingTimeMs: Date.now() - startTime,
      });
      return {
        success: false,
        message: "Unauthorized: Authenticated user does not match the payment request owner.",
      };
    }

    console.log(`[Firestore transaction started] Running atomic transaction to check duplicates, validate pending payments, and credit balance.`);

    // Log extra debugging details
    console.log(`[Verification debug] tx_ref: ${tx_ref}`);
    console.log(`[Verification debug] Flutterwave transaction ID: ${transactionId}`);
    console.log(`[Verification debug] pending payment document ID: ${tx_ref}`);

    // 2. Perform safe, atomic database transaction to update balances and log records using Firebase Admin SDK
    const result = await adminDb.runTransaction(async (transaction) => {
      try {
        // A. Check if duplicate already processed inside flutterwave_transactions collection
        const duplicateDocRef = adminDb.collection("flutterwave_transactions").doc(transactionId);

        console.log("Checking duplicate:", transactionId);
        const duplicateDoc = await transaction.get(duplicateDocRef);
        console.log("Duplicate document exists:", duplicateDoc.exists);

        if (duplicateDoc.exists) {
          return {
            duplicate: true,
            message: "Transaction already processed.",
          };
        }

        const isPermanentAccount = tx_ref.startsWith("user-wallet-");
        let expectedAmount = numericAmount;
        let expectedCurrency = currency;

        // B. Read and validate the pending payment request (only for dynamic checkouts)
        if (!isPermanentAccount) {
          const pendingPayRef = adminDb.collection("pending_payments").doc(tx_ref);

          console.log("Reading pending payment request...");
          const pendingPayDoc = await transaction.get(pendingPayRef);

          if (!pendingPayDoc.exists) {
            throw new Error(`Pending payment record not found: ${tx_ref}`);
          }

          const pendingData = pendingPayDoc.data() || {};

          if (pendingData.status === "completed") {
            return {
              duplicate: true,
              message: "Transaction already processed.",
            };
          }

          if (pendingData.status !== "pending") {
            throw new Error(`Pending payment record has an invalid status: ${pendingData.status}`);
          }

          // Ensure UID, expected amount, currency, and tx_ref match the pending payment record
          if (pendingData.userId !== userId) {
            throw new Error(`Pending payment owner mismatch. Expected: ${pendingData.userId}, Actual: ${userId}`);
          }

          expectedAmount = Number(pendingData.amount);
          expectedCurrency = pendingData.currency;

          if (Math.abs(expectedAmount - numericAmount) > 0.01) {
            throw new Error(`Pending payment amount mismatch. Expected: ₦${expectedAmount}, Actual: ₦${numericAmount}`);
          }

          if (expectedCurrency !== currency) {
            throw new Error(`Pending payment currency mismatch. Expected: ${expectedCurrency}, Actual: ${currency}`);
          }
        }

        // C. Credit balance using centralized WalletService (also logs transaction in general ledger)
        console.log("Updating wallet balance via WalletService...");
        const creditRes = await WalletService.creditWallet(transaction, {
          userId,
          amount: numericAmount,
          currency,
          reference: tx_ref,
          flwId: transactionId,
          docId: `tx-${transactionId}`, // Keep identical doc ID format to prevent ledger duplication
          description: isPermanentAccount ? "Funded via Permanent Virtual Account" : `Flutterwave Funding Ref: ${tx_ref}`,
          recipientName: customer?.name || "Wallet Credit",
        });

        // Delete the completed pending payment request document (WRITES after READs)
        if (!isPermanentAccount) {
          console.log("Deleting pending payment...");
          const pendingPayRef = adminDb.collection("pending_payments").doc(tx_ref);
          transaction.delete(pendingPayRef);
        }

        // D. Create document in flutterwave_transactions to prevent duplicates
        console.log("Creating duplicate record:", transactionId);
        transaction.set(duplicateDocRef, {
          userId,
          amount: numericAmount,
          currency,
          reference: tx_ref,
          flwId: transactionId,
          status: "SUCCESSFUL",
          processedAt: new Date().toISOString(),
        });

        // Log committing message before transaction completes/commits
        console.log("Committing transaction...");

        return {
          duplicate: false,
          newBalance: creditRes.newBalance,
          fundedAmount: numericAmount,
          currentBalance: creditRes.previousBalance,
        };
      } catch (innerError: unknown) {
        const error = innerError as Error & { code?: string };
        console.error(`[Firestore Operation Error] Failed during atomic transaction execution:`, error.message);
        console.error(`Error Code: ${error.code || "N/A"}`);
        console.error(`Error Stack:`, error.stack);
        throw innerError; // rethrow to abort the transaction
      }
    });

    if (result.duplicate) {
      console.log(`[Duplicate prevented] Reference already credited or pending payment already completed: ${transactionId}`);
      logPaymentEvent({
        category: "Duplicate Transaction",
        transactionId,
        tx_ref,
        userId,
        amount: numericAmount,
        currency,
        message: "Duplicate request blocked by idempotency ledger check.",
        processingTimeMs: Date.now() - startTime,
      });
      return {
        success: true,
        duplicate: true,
        message: "Transaction already processed.",
      };
    }

    console.log("Wallet credit committed.");
    console.log(`[Transaction committed] Firestore atomic updates successfully committed.`);
    console.log(`[Verification complete] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

    // Structured Log: Wallet Credited
    logPaymentEvent({
      category: "Wallet Credited",
      transactionId,
      tx_ref,
      userId,
      amount: numericAmount,
      currency,
      processingTimeMs: Date.now() - startTime,
      message: `Successfully credited wallet balance. Previous: ₦${result.currentBalance}, New: ₦${result.newBalance}`,
    });

    // Structured Log: Pending Payment Deleted (only for dynamic checkouts)
    if (!tx_ref.startsWith("user-wallet-")) {
      logPaymentEvent({
        category: "Pending Payment Deleted",
        transactionId,
        tx_ref,
        userId,
        amount: numericAmount,
        currency,
        processingTimeMs: Date.now() - startTime,
        message: `Pending payment document pending_payments/${tx_ref} deleted on success.`,
      });
    }

    return {
      success: true,
      message: "Transaction verified and wallet funded successfully!",
      fundedAmount: result.fundedAmount,
      newBalance: result.newBalance,
    };
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Verification Error Failed] ID: ${transactionId || "N/A"} Error Details:`, error.message, error.stack);

    logPaymentEvent({
      category: "Internal Error",
      transactionId,
      message: `Exception during wallet funding transaction: ${error.message}`,
      processingTimeMs: Date.now() - startTime,
    });

    return {
      success: false,
      message: "Internal Server Verification Error",
    };
  }
}
