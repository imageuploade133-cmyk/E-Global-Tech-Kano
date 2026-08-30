import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export interface TransactionRecord {
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  flwId?: string | null;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "INVESTMENT" | "AIRTIME" | "DATA" | "BILLS" | "SWAP_DEBIT" | "SWAP_CREDIT";
  description: string;
  recipientName: string;
  status: "SUCCESS" | "FAILED" | "PENDING";
  date: string;
  time: string;
  fee: number;
  createdAt: string;
  walletType?: "MAIN" | "BONUS";
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
    const uc = (currency || "").toUpperCase();
    const allowed = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "XOF", "XAF", "CAD", "ZAR", "TZS", "UGX", "RWF", "ZMW"];
    if (!allowed.includes(uc)) {
      throw new Error(`Unsupported currency: ${currency}. Supported currencies include: ${allowed.join(", ")}.`);
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
      type?: TransactionRecord["type"];
      walletType?: "MAIN" | "BONUS";
      preLoadedUser?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
      preLoadedWallet?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
    }
  ): Promise<{ previousBalance: number; newBalance: number }> {
    const { userId, amount, currency, reference, flwId, docId, description, recipientName, fee = 0, type = "DEPOSIT", walletType = "MAIN", preLoadedUser, preLoadedWallet } = params;

    const ucCurrency = (currency || "NGN").toUpperCase();

    // Strict validation
    this.validateAmount(amount);
    this.validateCurrency(ucCurrency);

    const isBonus = walletType === "BONUS";

    // 1. ALL READS: Must be executed before any writes
    const walletRef = adminDb.collection("wallets").doc(`${userId}_${ucCurrency}`);
    let currentBalance = 0;
    if (preLoadedWallet) {
      currentBalance = isBonus
        ? (preLoadedWallet.data?.bonusBalance !== undefined ? Number(preLoadedWallet.data.bonusBalance) : 0.00)
        : preLoadedWallet.balance;
    } else {
      const walletDoc = await transaction.get(walletRef);
      const wData = walletDoc.data() || {};
      currentBalance = walletDoc.exists
        ? (isBonus ? (wData.bonusBalance !== undefined ? Number(wData.bonusBalance) : 0.00) : (Number(wData.balance) || 0))
        : (isBonus ? 0.00 : 0);
    }

    // Load user profile before executing any writes if currency is NGN
    let user = null;
    if (ucCurrency === "NGN") {
      user = preLoadedUser || (await this.getUserProfile(transaction, userId));
    }

    // 2. ALL WRITES: Execute all updates, sets, and creations sequentially at the end
    const creditAmount = amount;
    const newBalance = currentBalance + creditAmount;

    // Update specific wallet balance atomically
    if (isBonus) {
      transaction.set(walletRef, {
        userId,
        currency: ucCurrency,
        bonusBalance: FieldValue.increment(creditAmount),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (ucCurrency === "NGN" && user) {
        transaction.update(user.ref, {
          bonusBalance: FieldValue.increment(creditAmount),
        });
      }
    } else {
      transaction.set(walletRef, {
        userId,
        currency: ucCurrency,
        balance: FieldValue.increment(creditAmount),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (ucCurrency === "NGN" && user) {
        transaction.update(user.ref, {
          balance: FieldValue.increment(creditAmount),
        });
      }
    }

    // Record transaction in general ledger
    const ledgerDocId = docId || `tx-${reference}`;
    const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
    const ledgerRecord: TransactionRecord = {
      userId,
      amount: creditAmount,
      currency: ucCurrency,
      reference,
      flwId: flwId || null,
      type,
      description,
      recipientName,
      status: "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      createdAt: new Date().toISOString(),
      walletType,
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
      type: TransactionRecord["type"];
      description: string;
      recipientName: string;
      fee?: number;
      isPending?: boolean; // If true, sets status to PENDING instead of SUCCESS
      walletType?: "MAIN" | "BONUS";
      preLoadedUser?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
      preLoadedWallet?: {
        ref: FirebaseFirestore.DocumentReference<FirebaseFirestore.DocumentData>;
        data: FirebaseFirestore.DocumentData;
        balance: number;
      };
    }
  ): Promise<{ previousBalance: number; newBalance: number }> {
    const { userId, amount, currency, reference, docId, type, description, recipientName, fee = 0, isPending = false, walletType = "MAIN", preLoadedUser, preLoadedWallet } = params;

    const ucCurrency = (currency || "NGN").toUpperCase();

    // Strict validation
    this.validateAmount(amount);
    this.validateCurrency(ucCurrency);

    const isBonus = walletType === "BONUS";

    // 1. ALL READS: Must be executed before any writes
    const walletRef = adminDb.collection("wallets").doc(`${userId}_${ucCurrency}`);
    let currentBalance = 0;
    if (preLoadedWallet) {
      currentBalance = isBonus
        ? (preLoadedWallet.data?.bonusBalance !== undefined ? Number(preLoadedWallet.data.bonusBalance) : 0.00)
        : preLoadedWallet.balance;
    } else {
      const walletDoc = await transaction.get(walletRef);
      const wData = walletDoc.data() || {};
      currentBalance = walletDoc.exists
        ? (isBonus ? (wData.bonusBalance !== undefined ? Number(wData.bonusBalance) : 0.00) : (Number(wData.balance) || 0))
        : (isBonus ? 0.00 : 0);
    }

    // Load user profile before executing any writes if currency is NGN
    let user = null;
    if (ucCurrency === "NGN") {
      user = preLoadedUser || (await this.getUserProfile(transaction, userId));
    }

    // 2. ALL WRITES: Execute all updates, sets, and creations sequentially at the end
    const totalDeduction = amount; // Fee is handled separately or included in amount

    if (currentBalance < totalDeduction) {
      throw new Error(`Insufficient ${isBonus ? "bonus reward" : "wallet"} funds to complete this ${type.toLowerCase()}. Required: ${ucCurrency === "NGN" ? "₦" : "$"}${totalDeduction}, Available: ${ucCurrency === "NGN" ? "₦" : "$"}${currentBalance}`);
    }

    const newBalance = currentBalance - totalDeduction;

    // Update specific wallet balance atomically
    if (isBonus) {
      transaction.set(walletRef, {
        userId,
        currency: ucCurrency,
        bonusBalance: FieldValue.increment(-totalDeduction),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (ucCurrency === "NGN" && user) {
        transaction.update(user.ref, {
          bonusBalance: FieldValue.increment(-totalDeduction),
        });
      }
    } else {
      transaction.set(walletRef, {
        userId,
        currency: ucCurrency,
        balance: FieldValue.increment(-totalDeduction),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (ucCurrency === "NGN" && user) {
        transaction.update(user.ref, {
          balance: FieldValue.increment(-totalDeduction),
        });
      }
    }

    // Record transaction in general ledger
    const ledgerDocId = docId || `tx-${reference}`;
    const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
    const ledgerRecord: TransactionRecord = {
      userId,
      amount,
      currency: ucCurrency,
      reference,
      type,
      description,
      recipientName,
      status: isPending ? "PENDING" : "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      createdAt: new Date().toISOString(),
      walletType,
    };

    transaction.set(ledgerRef, ledgerRecord);

    return {
      previousBalance: currentBalance,
      newBalance,
    };
  }
}
