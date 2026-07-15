import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

// A robust parser that extracts the userId correctly from tx_ref for backup checks
function extractUserIdFromTxRef(txRef: string): string | null {
  if (!txRef || !txRef.startsWith("flw-tx-")) return null;
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
  console.log(`[Wallet Funding Library] Initiating verifyAndCreditWallet for Transaction ID: ${transactionId}`);

  // 1. Verify with Flutterwave's Verify API first before crediting any wallet
  const flwRes = await flutterwaveService.verifyTransaction(transactionId);

  // Validate payment status
  if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
    console.warn(`[verification failed] Flutterwave status check was negative:`, flwRes);
    return {
      success: false,
      message: "Transaction was not successfully settled on Flutterwave rail.",
    };
  }

  const { amount, currency, tx_ref, customer } = flwRes.data;

  // Validate payment amount before crediting
  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
    return { success: false, message: "Invalid payment amount. Validation failed." };
  }

  // Validate currency before crediting
  if (currency !== "NGN" && currency !== "USD") {
    return { success: false, message: `Unsupported transaction currency: ${currency}` };
  }

  // Validate transaction reference format
  if (!tx_ref || !tx_ref.startsWith("flw-tx-")) {
    return { success: false, message: "Invalid transaction reference prefix." };
  }

  // Retrieve userId: first choice is metadata, fallback to safe tx_ref parser
  let userId = flwRes.data.meta?.userId || flwRes.data.metadata?.userId;

  if (!userId) {
    console.log(`[Verification] Metadata is missing. Falling back to parsing tx_ref: ${tx_ref}`);
    userId = extractUserIdFromTxRef(tx_ref);
  }

  if (!userId) {
    return {
      success: false,
      message: "Verification Failed: User ID context not resolved from transaction reference or metadata.",
    };
  }

  // Ensure client-side Firebase Auth UID matches the transaction reference owner if expectedAuthUid is supplied
  if (expectedAuthUid && expectedAuthUid !== userId) {
    console.warn(`[Verification Blocked] Access denied: Authenticated user (${expectedAuthUid}) does not match reference owner (${userId})`);
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

  let currentOperation = "";
  let currentDocPath = "";

  // 2. Perform safe, atomic database transaction to update balances and log records using Firebase Admin SDK
  const result = await adminDb.runTransaction(async (transaction) => {
    try {
      // A. Check if duplicate already processed inside flutterwave_transactions collection
      const duplicateDocRef = adminDb.collection("flutterwave_transactions").doc(transactionId);

      currentOperation = "Checking duplicate";
      currentDocPath = `flutterwave_transactions/${transactionId}`;
      console.log("Checking duplicate:", transactionId);
      const duplicateDoc = await transaction.get(duplicateDocRef);
      console.log("Duplicate document exists:", duplicateDoc.exists);

      if (duplicateDoc.exists) {
        return {
          duplicate: true,
          message: "Transaction already processed.",
        };
      }

      // B. Read and validate the pending payment request
      const pendingPayRef = adminDb.collection("pending_payments").doc(tx_ref);

      currentOperation = "Reading pending payment request";
      currentDocPath = `pending_payments/${tx_ref}`;
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

      const expectedAmount = Number(pendingData.amount);
      const actualAmount = Number(amount);
      if (Math.abs(expectedAmount - actualAmount) > 0.01) {
        throw new Error(`Pending payment amount mismatch. Expected: ₦${expectedAmount}, Actual: ₦${actualAmount}`);
      }

      if (pendingData.currency !== currency) {
        throw new Error(`Pending payment currency mismatch. Expected: ${pendingData.currency}, Actual: ${currency}`);
      }

      // C. Verify target user profile exists
      const userDocRef = adminDb.collection("users").doc(userId);

      currentOperation = "Reading user";
      currentDocPath = `users/${userId}`;
      console.log("Reading user...");
      const userDoc = await transaction.get(userDocRef);

      if (!userDoc.exists) {
        throw new Error("Target user profile was not found in Firestore.");
      }

      const userData = userDoc.data();
      const currentBalance = Number(userData?.balance) || 0;
      const fundedAmount = Number(amount);
      const newBalance = currentBalance + fundedAmount;

      // D. Increment atomic balance using FieldValue.increment
      currentOperation = "Updating wallet";
      currentDocPath = `users/${userId}`;
      console.log("Updating wallet...");
      transaction.update(userDocRef, { balance: FieldValue.increment(fundedAmount) });
      console.log(`[Wallet credited] USER ID: ${userId}, PREVIOUS BALANCE: ₦${currentBalance}, FUNDING AMOUNT: ₦${fundedAmount}, NEW ESTIMATED BALANCE: ₦${newBalance}`);
      console.log(`[Verification debug] wallet balance before funding: ₦${currentBalance}`);
      console.log(`[Verification debug] wallet balance after funding (estimated): ₦${newBalance}`);

      // E. Delete the completed pending payment request document
      currentOperation = "Deleting pending payment";
      currentDocPath = `pending_payments/${tx_ref}`;
      console.log("Deleting pending payment...");
      transaction.delete(pendingPayRef);

      // F. Create document in flutterwave_transactions to prevent duplicates
      currentOperation = "Creating duplicate record";
      currentDocPath = `flutterwave_transactions/${transactionId}`;
      console.log("Creating duplicate record:", transactionId);
      transaction.set(duplicateDocRef, {
        userId,
        amount: fundedAmount,
        currency,
        reference: tx_ref,
        flwId: transactionId,
        status: "SUCCESSFUL",
        processedAt: new Date().toISOString(),
      });

      // G. Save transaction record inside transactions collection for general ledger logging
      const ledgerRef = adminDb.collection("transactions").doc(`tx-${transactionId}`);
      currentOperation = "Creating ledger entry";
      currentDocPath = `transactions/tx-${transactionId}`;
      console.log("Creating ledger entry...");
      const txRecord = {
        userId,
        amount: fundedAmount,
        currency: currency || "NGN",
        reference: tx_ref,
        flwId: transactionId,
        type: "DEPOSIT",
        description: `Flutterwave Funding Ref: ${tx_ref}`,
        recipientName: customer?.name || "Wallet Credit",
        status: "SUCCESS",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        fee: 0.00,
        createdAt: new Date().toISOString(),
      };
      transaction.set(ledgerRef, txRecord);
      console.log(`[Transaction recorded] Ledger history entry recorded successfully.`);

      // Log committing message before transaction completes/commits
      currentOperation = "Committing transaction";
      currentDocPath = "N/A";
      console.log("Committing transaction...");

      return {
        duplicate: false,
        newBalance,
        fundedAmount,
      };
    } catch (innerError: unknown) {
      const error = innerError as Error & { code?: string };
      console.error(`[Firestore Operation Error] Failed during operation: "${currentOperation}" on document: "${currentDocPath}"`);
      console.error(`Error Code: ${error.code || "N/A"}`);
      console.error(`Error Stack:`, error.stack);
      throw innerError; // rethrow to abort the transaction
    }
  });

  if (result.duplicate) {
    console.log(`[Duplicate prevented] Reference already credited or pending payment already completed: ${transactionId}`);
    return {
      success: true,
      duplicate: true,
      message: "Transaction already processed.",
    };
  }

  console.log("Wallet credit committed.");
  console.log(`[Transaction committed] Firestore atomic updates successfully committed.`);
  console.log(`[Verification complete] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

  return {
    success: true,
    message: "Transaction verified and wallet funded successfully!",
    fundedAmount: result.fundedAmount,
    newBalance: result.newBalance,
  };
}
