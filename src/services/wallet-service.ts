import { adminDb } from "@/lib/firebase-admin";
import { FieldValue, Transaction } from "firebase-admin/firestore";

export interface TransactionRecord {
  id?: string;
  userId: string;
  amount: number;
  currency: string;
  reference: string;
  flwId?: string | null;
  type: "DEPOSIT" | "WITHDRAWAL" | "TRANSFER" | "INVESTMENT" | "AIRTIME" | "DATA" | "BILLS" | "SWAP_DEBIT" | "SWAP_CREDIT" | "CASHOUT" | "CARD_FUND" | "STORE_PURCHASE" | "REFUND" | "VIRTUAL_ACCOUNT_DEPOSIT" | "GLOBAL_DEDUCTION" | "DEBT_RECOVERY" | string;
  category?: string;
  direction?: "CREDIT" | "DEBIT";
  description: string;
  narration?: string;
  recipientName?: string;
  status: "SUCCESS" | "FAILED" | "PENDING" | "REFUND" | string;
  date: string;
  time: string;
  fee: number;
  vat?: number;
  markup?: number;
  totalDebited?: number;
  totalCredited?: number;
  provider?: string;
  providerReference?: string;
  providerTransactionId?: string;
  sessionId?: string;
  createdAt: string;
  completedAt?: string;
  walletType?: "MAIN" | "BONUS";

  // Bank transfer
  beneficiaryName?: string;
  beneficiaryAccountNumber?: string;
  beneficiaryBankName?: string;
  beneficiaryBankCode?: string;

  // Deposit
  fundingMethod?: string;
  virtualAccountNumber?: string;
  virtualAccountBankName?: string;
  senderName?: string;
  senderAccountNumber?: string;
  senderBankName?: string;

  // Airtime / Data
  network?: string;
  phoneNumber?: string;
  itemCode?: string;
  itemName?: string;
  planName?: string;

  // Bills
  billerCode?: string;
  billerName?: string;
  billerType?: string;
  customerId?: string;
  customerName?: string;

  // Electricity
  meterNumber?: string;
  meterType?: string;
  token?: string;

  // Cable
  smartcardNumber?: string;
  packageName?: string;

  // Swap
  sourceCurrency?: string;
  sourceAmount?: number;
  destinationCurrency?: string;
  destinationAmount?: number;
  exchangeRate?: number;

  // Metadata
  metadata?: Record<string, unknown>;
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
      category?: string;
      direction?: "CREDIT" | "DEBIT";
      narration?: string;
      vat?: number;
      markup?: number;
      totalDebited?: number;
      totalCredited?: number;
      provider?: string;
      providerReference?: string;
      providerTransactionId?: string;
      sessionId?: string;
      completedAt?: string;
      beneficiaryName?: string;
      beneficiaryAccountNumber?: string;
      beneficiaryBankName?: string;
      beneficiaryBankCode?: string;
      fundingMethod?: string;
      virtualAccountNumber?: string;
      virtualAccountBankName?: string;
      senderName?: string;
      senderAccountNumber?: string;
      senderBankName?: string;
      network?: string;
      phoneNumber?: string;
      itemCode?: string;
      itemName?: string;
      planName?: string;
      billerCode?: string;
      billerName?: string;
      billerType?: string;
      customerId?: string;
      customerName?: string;
      meterNumber?: string;
      meterType?: string;
      token?: string;
      smartcardNumber?: string;
      packageName?: string;
      sourceCurrency?: string;
      sourceAmount?: number;
      destinationCurrency?: string;
      destinationAmount?: number;
      exchangeRate?: number;
      metadata?: Record<string, unknown>;
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

    // AUTOMATIC DEBT RECOVERY & DAILY DEPOSIT LIMIT TRACKING (FOR NGN MAIN WALLET DEPOSITS/CREDITS)
    let debtRecovered = 0;
    let netBalanceIncrement = 0;

    const feeNum = Number(fee) || 0;
    const vatNum = Number(params.vat) || 0;
    const creditAmount = params.totalCredited !== undefined && params.totalCredited !== null && Number(params.totalCredited) > 0
      ? Number(params.totalCredited)
      : (amount + feeNum + vatNum);

    if (ucCurrency === "NGN" && !isBonus && user) {
      const currentDebt = Math.max(0, Number(user.data.outstandingDebt) || 0);
      if (currentDebt > 0 && creditAmount > 0) {
        debtRecovered = Math.min(creditAmount, currentDebt);
        netBalanceIncrement = creditAmount - debtRecovered;
      } else {
        netBalanceIncrement = creditAmount;
      }
    } else {
      netBalanceIncrement = creditAmount;
    }

    const newBalance = currentBalance + netBalanceIncrement;

    // Daily Deposit Limit Evaluation & Lock Triggers
    let updatedDepositTotal = 0;
    let isDepositLimitExceeded = false;

    if (ucCurrency === "NGN" && !isBonus && user && type === "DEPOSIT" || type === "VIRTUAL_ACCOUNT_DEPOSIT" || type === "WALLET_FUNDING") {
      const todayIsoDate = new Date().toISOString().split("T")[0];
      const lastDepositDate = user.data.lastDepositDate || "";
      const currentTodayDepositTotal = lastDepositDate === todayIsoDate ? (Number(user.data.todayDepositTotal) || 0) : 0;
      updatedDepositTotal = currentTodayDepositTotal + creditAmount;

      const dailyDepositLimit = user.data.dailyDepositLimit !== undefined ? Number(user.data.dailyDepositLimit) : 1000000;
      const unlimitedDeposits = !!user.data.unlimitedDeposits;

      if (!unlimitedDeposits && dailyDepositLimit > 0 && updatedDepositTotal > dailyDepositLimit) {
        isDepositLimitExceeded = true;
      }
    }

    // 2. ALL WRITES: Execute all updates, sets, and creations sequentially at the end
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
        balance: FieldValue.increment(netBalanceIncrement),
        updatedAt: new Date().toISOString(),
      }, { merge: true });

      if (ucCurrency === "NGN" && user) {
        const todayIsoDate = new Date().toISOString().split("T")[0];
        const userUpdates: Record<string, any> = {
          balance: FieldValue.increment(netBalanceIncrement),
        };
        if (debtRecovered > 0) {
          userUpdates.outstandingDebt = FieldValue.increment(-debtRecovered);
        }
        if (updatedDepositTotal > 0) {
          userUpdates.lastDepositDate = todayIsoDate;
          userUpdates.todayDepositTotal = updatedDepositTotal;
        }
        if (isDepositLimitExceeded) {
          userUpdates.depositLimitExceeded = true;
          userUpdates.depositLimitExceededAt = new Date().toISOString();
        }
        transaction.update(user.ref, userUpdates);
      }
    }

    // Record debt recovery ledger transaction if debt was recovered
    if (debtRecovered > 0) {
      const debtTxRef = `recovery-${reference}`;
      const debtTxDocRef = adminDb.collection("transactions").doc(`tx-${debtTxRef}`);
      transaction.set(debtTxDocRef, {
        userId,
        amount: debtRecovered,
        currency: ucCurrency,
        reference: debtTxRef,
        type: "DEBT_RECOVERY",
        category: "DEDUCTION",
        direction: "DEBIT",
        description: `Automatic Recovery for Outstanding Debt (₦${debtRecovered.toLocaleString()})`,
        recipientName: "System Recovery",
        status: "SUCCESS",
        date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
        time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        fee: 0,
        totalDebited: debtRecovered,
        totalCredited: 0,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        metadata: {
          fundingReference: reference,
          recoveredAmount: debtRecovered,
          originalAmount: creditAmount,
        },
      });
    }

    // Record transaction in general ledger
    const ledgerDocId = docId || `tx-${reference}`;
    const ledgerRef = adminDb.collection("transactions").doc(ledgerDocId);
    const ledgerRecord: TransactionRecord = {
      userId,
      amount, // Preserve principal transfer amount (e.g. 5000)
      currency: ucCurrency,
      reference,
      flwId: flwId || null,
      type,
      category: params.category,
      direction: params.direction || "CREDIT",
      description,
      narration: params.narration,
      recipientName,
      status: "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      vat: params.vat,
      markup: params.markup,
      totalDebited: params.totalDebited,
      totalCredited: creditAmount, // Record full credited total (e.g. 5030)
      provider: params.provider,
      providerReference: params.providerReference || flwId || undefined,
      providerTransactionId: params.providerTransactionId,
      sessionId: params.sessionId,
      createdAt: new Date().toISOString(),
      completedAt: params.completedAt || new Date().toISOString(),
      walletType,

      beneficiaryName: params.beneficiaryName,
      beneficiaryAccountNumber: params.beneficiaryAccountNumber,
      beneficiaryBankName: params.beneficiaryBankName,
      beneficiaryBankCode: params.beneficiaryBankCode,

      fundingMethod: params.fundingMethod,
      virtualAccountNumber: params.virtualAccountNumber,
      virtualAccountBankName: params.virtualAccountBankName,
      senderName: params.senderName,
      senderAccountNumber: params.senderAccountNumber,
      senderBankName: params.senderBankName,

      network: params.network,
      phoneNumber: params.phoneNumber,
      itemCode: params.itemCode,
      itemName: params.itemName,
      planName: params.planName,

      billerCode: params.billerCode,
      billerName: params.billerName,
      billerType: params.billerType,
      customerId: params.customerId,
      customerName: params.customerName,

      meterNumber: params.meterNumber,
      meterType: params.meterType,
      token: params.token,

      smartcardNumber: params.smartcardNumber,
      packageName: params.packageName,

      sourceCurrency: params.sourceCurrency,
      sourceAmount: params.sourceAmount,
      destinationCurrency: params.destinationCurrency,
      destinationAmount: params.destinationAmount,
      exchangeRate: params.exchangeRate,

      metadata: params.metadata,
    };

    // Filter out undefined keys before writing to Firestore
    Object.keys(ledgerRecord).forEach(
      (key) => (ledgerRecord as any)[key] === undefined && delete (ledgerRecord as any)[key]
    );

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
      category?: string;
      direction?: "CREDIT" | "DEBIT";
      narration?: string;
      vat?: number;
      markup?: number;
      totalDebited?: number;
      totalCredited?: number;
      provider?: string;
      providerReference?: string;
      providerTransactionId?: string;
      sessionId?: string;
      completedAt?: string;
      beneficiaryName?: string;
      beneficiaryAccountNumber?: string;
      beneficiaryBankName?: string;
      beneficiaryBankCode?: string;
      fundingMethod?: string;
      virtualAccountNumber?: string;
      virtualAccountBankName?: string;
      senderName?: string;
      senderAccountNumber?: string;
      senderBankName?: string;
      network?: string;
      phoneNumber?: string;
      itemCode?: string;
      itemName?: string;
      planName?: string;
      billerCode?: string;
      billerName?: string;
      billerType?: string;
      customerId?: string;
      customerName?: string;
      meterNumber?: string;
      meterType?: string;
      token?: string;
      smartcardNumber?: string;
      packageName?: string;
      sourceCurrency?: string;
      sourceAmount?: number;
      destinationCurrency?: string;
      destinationAmount?: number;
      exchangeRate?: number;
      metadata?: Record<string, unknown>;
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
    const feeNum = Number(fee) || 0;
    const vatNum = Number(params.vat) || 0;
    const totalDeduction = amount + feeNum + vatNum;

    // Enforce Deposit Limit Exceeded & Outstanding Debt locks for NGN main wallet debits
    if (ucCurrency === "NGN" && !isBonus && user) {
      const todayIsoDate = new Date().toISOString().split("T")[0];
      const lastDepositDate = user.data.lastDepositDate || "";
      const todayDepositTotal = lastDepositDate === todayIsoDate ? (Number(user.data.todayDepositTotal) || 0) : 0;
      const dailyDepositLimit = user.data.dailyDepositLimit !== undefined ? Number(user.data.dailyDepositLimit) : 1000000;
      const unlimitedDeposits = !!user.data.unlimitedDeposits;

      const isExceeded = user.data.depositLimitExceeded === true || (!unlimitedDeposits && dailyDepositLimit > 0 && todayDepositTotal > dailyDepositLimit);

      if (isExceeded) {
        throw new Error(
          "Your account is pending because your daily deposit limit has been exceeded. You cannot spend or transfer funds. Please contact support or submit a limit upgrade request."
        );
      }
    }

    // Enforce outstanding debt check for NGN main wallet debits so indebted users cannot spend or transfer funds
    const outstandingDebt = (ucCurrency === "NGN" && !isBonus && user)
      ? Math.max(0, Number(user.data.outstandingDebt) || 0)
      : 0;

    const spendableBalance = Math.max(0, currentBalance - outstandingDebt);

    if (spendableBalance < totalDeduction) {
      throw new Error(
        outstandingDebt > 0
          ? `Insufficient spendable balance due to an outstanding debt obligation of ₦${outstandingDebt.toLocaleString()}. Spendable Balance: ₦${spendableBalance.toLocaleString()}, Required: ₦${totalDeduction.toLocaleString()}`
          : `Insufficient ${isBonus ? "bonus reward" : "wallet"} funds to complete this ${type.toLowerCase()}. Required: ${ucCurrency === "NGN" ? "₦" : "$"}${totalDeduction}, Available: ${ucCurrency === "NGN" ? "₦" : "$"}${currentBalance}`
      );
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
      category: params.category,
      direction: params.direction || "DEBIT",
      description,
      narration: params.narration,
      recipientName,
      status: isPending ? "PENDING" : "SUCCESS",
      date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
      fee,
      vat: params.vat,
      markup: params.markup,
      totalDebited: params.totalDebited ?? totalDeduction,
      totalCredited: params.totalCredited,
      provider: params.provider,
      providerReference: params.providerReference,
      providerTransactionId: params.providerTransactionId,
      sessionId: params.sessionId,
      createdAt: new Date().toISOString(),
      completedAt: isPending ? undefined : (params.completedAt || new Date().toISOString()),
      walletType,

      beneficiaryName: params.beneficiaryName,
      beneficiaryAccountNumber: params.beneficiaryAccountNumber,
      beneficiaryBankName: params.beneficiaryBankName,
      beneficiaryBankCode: params.beneficiaryBankCode,

      fundingMethod: params.fundingMethod,
      virtualAccountNumber: params.virtualAccountNumber,
      virtualAccountBankName: params.virtualAccountBankName,
      senderName: params.senderName,
      senderAccountNumber: params.senderAccountNumber,
      senderBankName: params.senderBankName,

      network: params.network,
      phoneNumber: params.phoneNumber,
      itemCode: params.itemCode,
      itemName: params.itemName,
      planName: params.planName,

      billerCode: params.billerCode,
      billerName: params.billerName,
      billerType: params.billerType,
      customerId: params.customerId,
      customerName: params.customerName,

      meterNumber: params.meterNumber,
      meterType: params.meterType,
      token: params.token,

      smartcardNumber: params.smartcardNumber,
      packageName: params.packageName,

      sourceCurrency: params.sourceCurrency,
      sourceAmount: params.sourceAmount,
      destinationCurrency: params.destinationCurrency,
      destinationAmount: params.destinationAmount,
      exchangeRate: params.exchangeRate,

      metadata: params.metadata,
    };

    // Filter out undefined keys before writing to Firestore
    Object.keys(ledgerRecord).forEach(
      (key) => (ledgerRecord as any)[key] === undefined && delete (ledgerRecord as any)[key]
    );

    transaction.set(ledgerRef, ledgerRecord);

    return {
      previousBalance: currentBalance,
      newBalance,
    };
  }
}
