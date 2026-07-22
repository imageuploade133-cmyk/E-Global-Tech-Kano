import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export interface TransactionRecord {
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  flwId?: string;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "INVESTMENT" | "AIRTIME" | "DATA" | "BILLS";
  description: string;
  recipientName: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  date: string;
  time: string;
  fee: number;
  createdAt: string;
}

export class WalletService {
  /**
   * Validates a transaction amount.
   * Ensures it is a positive number, not NaN, and doesn't have more than 2 decimal places.
   */
  static validateAmount(amount: number): void {
    if (typeof amount !== "number" || isNaN(amount)) {
      throw new Error("Amount must be a valid number.");
    }
    if (amount <= 0) {
      throw new Error("Amount must be greater than zero.");
    }
    const amountStr = amount.toString();
    if (amountStr.includes(".")) {
      const decimals = amountStr.split(".")[1];
      if (decimals.length > 2) {
        throw new Error("Amount cannot have more than 2 decimal places.");
      }
    }
  }

  /**
   * Validates a currency code.
   */
  static validateCurrency(currency: string): void {
    if (currency !== "NGN" && currency !== "USD") {
      throw new Error(`Unsupported currency: ${currency}. Only NGN and USD are supported.`);
    }
  }

  /**
   * Validates target user document and extracts current balance.
   */
  static async getUserProfile(transaction: Transaction, userId: string) {
    if (!userId || typeof userId !== "string") {
      throw new Error("Invalid or empty User ID.");
    }
    const userDocRef = adminDb.collection("users").doc(userId);
    const userDoc = await transaction.get(userDocRef);

    if (!userDoc.exists) {
      throw new Error(`User profile not found for ID: ${userId}`);
    }

    const data = userDoc.data() || {};
    return {
      ref: userDocRef,
      data,
      balance: Number(data.balance) || 0,
    };
  }

  /**
   * Safely credits a user's wallet and records the ledger transaction inside a Firestore Transaction.
   */
  static async creditWallet(
    transaction: Transaction,
    params: {
      userId: string;
      amount: number;
      currency: string;
      reference: string;
      flwId?: string;
      docId?: string;
      description: string;
      recipientName: string;
      fee?: number;
      preLoadedUser?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
    }
  ): Promise<{ previousBalance: number; newBalance: number }> {
    const { userId, amount, currency, reference, flwId, docId, description, recipientName, fee = 0, preLoadedUser } = params;

    // Strict validation
    this.validateAmount(amount);
    this.validateCurrency(currency);

    // Retrieve user and current balance
    const user = preLoadedUser || (await this.getUserProfile(transaction, userId));
    const currentBalance = user.balance;
    const creditAmount = amount;
    const newBalance = currentBalance + creditAmount;

    // Update wallet balance atomically
    transaction.update(user.ref, {
      balance: FieldValue.increment(creditAmount),
    });

    // Record transaction in general ledger
    const ledgerDocId = docId || `tx-${reference}`;
    const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
    const ledgerRecord: TransactionRecord = {
      userId,
      amount: creditAmount,
      currency,
      reference,
      flwId,
      type: "DEPOSIT",
      description,
      recipientName,
      status: "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      createdAt: new Date().toISOString(),
    };

    transaction.set(ledgerRef, ledgerRecord);

    return {
      previousBalance: currentBalance,
      newBalance,
    };
  }

  /**
   * Safely debits a user's wallet and records the ledger transaction inside a Firestore Transaction.
   */
  static async debitWallet(
    transaction: Transaction,
    params: {
      userId: string;
      amount: number;
      currency: string;
      reference: string;
      docId?: string;
      type: "WITHDRAWAL" | "TRANSFER" | "INVESTMENT" | "AIRTIME" | "DATA" | "BILLS";
      description: string;
      recipientName: string;
      fee?: number;
      isPending?: boolean; // If true, sets status to PENDING instead of SUCCESS
      preLoadedUser?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
    }
  ): Promise<{ previousBalance: number; newBalance: number }> {
    const { userId, amount, currency, reference, docId, type, description, recipientName, fee = 0, isPending = false, preLoadedUser } = params;

    // Strict validation
    this.validateAmount(amount);
    this.validateCurrency(currency);

    // Retrieve user and current balance
    const user = preLoadedUser || (await this.getUserProfile(transaction, userId));
    const currentBalance = user.balance;

    const totalDeduction = amount; // Fee is handled separately or included in amount

    if (currentBalance < totalDeduction) {
      throw new Error(`Insufficient wallet funds to complete this ${type.toLowerCase()}. Required: ₦${totalDeduction}, Available: ₦${currentBalance}`);
    }

    const newBalance = currentBalance - totalDeduction;

    // Update wallet balance atomically
    transaction.update(user.ref, {
      balance: FieldValue.increment(-totalDeduction),
    });

    // Record transaction in general ledger
    const ledgerDocId = docId || `tx-${reference}`;
    const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
    const ledgerRecord: TransactionRecord = {
      userId,
      amount,
      currency,
      reference,
      type,
      description,
      recipientName,
      status: isPending ? "PENDING" : "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      createdAt: new Date().toISOString(),
    };

    transaction.set(ledgerRef, ledgerRecord);

    return {
      previousBalance: currentBalance,
      newBalance,
    };
  }
}
