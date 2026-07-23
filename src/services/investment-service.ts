import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "./wallet-service";

export interface InvestmentSettings {
  minInvestment: number;
  maxInvestment: number;
  penaltyRate: number; // e.g. 0.10 for 10% early withdrawal penalty on interest or principal
  savingsRate: number; // e.g. 0.08 for 8%
  updatedAt: string;
}

export interface InterestRateProduct {
  id: string;
  name: string;
  type: "SAVINGS" | "FIXED_DEPOSIT";
  apr: number; // e.g. 0.085 for 8.5%
  durationDays: number; // e.g. 30, 60, 90, 180, 365
  interestType: "SIMPLE" | "COMPOUND";
  status: "ACTIVE" | "INACTIVE";
}

export interface InvestmentRecord {
  id: string;
  userId: string;
  type: "SAVINGS" | "FIXED_DEPOSIT";
  amount: number;
  currency: string;
  startDate: string;
  maturityDate: string;
  interestRate: number;
  interestType: "SIMPLE" | "COMPOUND";
  accumulatedInterest: number;
  totalValue: number;
  status: "ACTIVE" | "MATURED" | "CLAIMED" | "CANCELLED";
  optionId: string;
  optionName: string;
  createdAt: string;
  updatedAt: string;
}

export class InvestmentService {
  /**
   * Safe and self-healing DB seeder for settings and rates.
   */
  static async seedDatabaseIfNeeded(): Promise<void> {
    const settingsRef = adminDb.collection("investmentSettings").doc("global");
    const doc = await settingsRef.get();

    if (!doc.exists) {
      console.log("[InvestmentService] Seeding investment settings and rates...");

      const defaultSettings: InvestmentSettings = {
        minInvestment: 1000,
        maxInvestment: 10000000,
        penaltyRate: 0.10, // 10% penalty on early withdrawal of principal/interest
        savingsRate: 0.08,
        updatedAt: new Date().toISOString(),
      };
      await settingsRef.set(defaultSettings);

      const defaultProducts: InterestRateProduct[] = [
        {
          id: "vault-flex",
          name: "Flexi Wealth Vault",
          type: "SAVINGS",
          apr: 0.085, // 8.5%
          durationDays: 30,
          interestType: "SIMPLE",
          status: "ACTIVE",
        },
        {
          id: "vault-pro",
          name: "Pro Yield Vault",
          type: "FIXED_DEPOSIT",
          apr: 0.125, // 12.5%
          durationDays: 90,
          interestType: "SIMPLE",
          status: "ACTIVE",
        },
        {
          id: "vault-elite",
          name: "Elite Compounder",
          type: "FIXED_DEPOSIT",
          apr: 0.18, // 18.0%
          durationDays: 365,
          interestType: "COMPOUND",
          status: "ACTIVE",
        },
      ];

      for (const prod of defaultProducts) {
        await adminDb.collection("interestRates").doc(prod.id).set(prod);
      }
      console.log("[InvestmentService] Seeding completed successfully!");
    }
  }

  /**
   * Retrieves global investment configurations.
   */
  static async getSettings(): Promise<InvestmentSettings> {
    await this.seedDatabaseIfNeeded();
    const doc = await adminDb.collection("investmentSettings").doc("global").get();
    return doc.data() as InvestmentSettings;
  }

  /**
   * Retrieves all active investment interest rate products.
   */
  static async getInterestRates(): Promise<InterestRateProduct[]> {
    await this.seedDatabaseIfNeeded();
    const snapshot = await adminDb.collection("interestRates").where("status", "==", "ACTIVE").get();
    const products: InterestRateProduct[] = [];
    snapshot.forEach((doc) => {
      products.push(doc.data() as InterestRateProduct);
    });
    return products;
  }

  /**
   * Calculates dynamic server-side interest accrued for a given amount, duration and rate.
   */
  static calculateInterest(amount: number, apr: number, elapsedDays: number, interestType: "SIMPLE" | "COMPOUND"): number {
    if (elapsedDays <= 0) return 0;

    if (interestType === "SIMPLE") {
      // Simple Interest: P * R * (t / 365)
      const interest = amount * apr * (elapsedDays / 365);
      return Number(interest.toFixed(2));
    } else {
      // Daily Compounding Interest: P * ((1 + R/365)^t - 1)
      const interest = amount * (Math.pow(1 + apr / 365, elapsedDays) - 1);
      return Number(interest.toFixed(2));
    }
  }

  /**
   * Atomic lock creation of Savings / Fixed Deposits inside a transaction.
   */
  static async createInvestment(
    userId: string,
    params: {
      amount: number;
      currency: string;
      productId: string;
      type: "SAVINGS" | "FIXED_DEPOSIT";
    }
  ): Promise<InvestmentRecord> {
    const { amount, currency, productId, type } = params;

    await this.seedDatabaseIfNeeded();

    // 1. Load active settings and rate specs from Firestore
    const settings = await this.getSettings();
    const productDoc = await adminDb.collection("interestRates").doc(productId).get();
    if (!productDoc.exists) {
      throw new Error(`The selected product model was not found: ${productId}`);
    }
    const product = productDoc.data() as InterestRateProduct;

    // Validate global settings bounds
    if (amount < settings.minInvestment) {
      throw new Error(`Investment amount is too low. Minimum required: ₦${settings.minInvestment.toLocaleString()}`);
    }
    if (amount > settings.maxInvestment) {
      throw new Error(`Investment amount exceeds the limit. Maximum allowed: ₦${settings.maxInvestment.toLocaleString()}`);
    }

    const refId = `inv-${userId}-${Date.now()}`;
    const startDate = new Date();
    const maturityDate = new Date();
    maturityDate.setDate(startDate.getDate() + product.durationDays);

    // 2. Perform Atomic Write via Firestore Transaction
    const record = await adminDb.runTransaction(async (transaction) => {
      // Verify wallet balance and debit wallet atomically
      await WalletService.debitWallet(transaction, {
        userId,
        amount,
        currency,
        reference: refId,
        type: "INVESTMENT",
        description: `Created Locked ${type === "SAVINGS" ? "Savings" : "Fixed Deposit"}: ${product.name} (${product.durationDays} Days)`,
        recipientName: product.name,
        fee: 0,
      });

      const investRef = adminDb.collection("investments").doc(refId);
      const investRecord: InvestmentRecord = {
        id: refId,
        userId,
        type,
        amount,
        currency,
        startDate: startDate.toISOString(),
        maturityDate: maturityDate.toISOString(),
        interestRate: product.apr,
        interestType: product.interestType,
        accumulatedInterest: 0,
        totalValue: amount,
        status: "ACTIVE",
        optionId: product.id,
        optionName: product.name,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      transaction.set(investRef, investRecord);

      // Write specialized Investment transaction log
      const logRef = adminDb.collection("investmentTransactions").doc(`tx-invest-${refId}`);
      transaction.set(logRef, {
        id: `tx-invest-${refId}`,
        userId,
        investmentId: refId,
        amount,
        type: "DEPOSIT",
        status: "SUCCESS",
        description: `Locked capital of ₦${amount.toLocaleString()} into ${product.name}`,
        createdAt: new Date().toISOString(),
      });

      // Write audit log document
      const auditRef = adminDb.collection("auditLogs").doc(`audit-invest-${refId}`);
      transaction.set(auditRef, {
        id: `audit-invest-${refId}`,
        userId,
        action: "INVESTMENT_CREATED",
        metadata: {
          productId,
          amount,
          type,
          refId,
        },
        version: "1.0",
        createdAt: new Date().toISOString(),
      });

      return investRecord;
    });

    return record;
  }

  /**
   * Securely claim / redeem matured savings locks inside a Transaction.
   */
  static async claimInvestment(userId: string, investmentId: string): Promise<{ record: InvestmentRecord; creditedAmount: number }> {
    const investRef = adminDb.collection("investments").doc(investmentId);

    const result = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(investRef);
      if (!doc.exists) {
        throw new Error("The specified investment was not found.");
      }

      const record = doc.data() as InvestmentRecord;
      if (record.userId !== userId) {
        throw new Error("Forbidden: You do not own this investment lock.");
      }
      if (record.status === "CLAIMED") {
        throw new Error("This investment has already been claimed.");
      }
      if (record.status === "CANCELLED") {
        throw new Error("This investment has already been cancelled.");
      }

      const now = new Date();
      const isMatured = now >= new Date(record.maturityDate);
      if (!isMatured) {
        throw new Error("This investment is still locked and has not reached its maturity date.");
      }

      // Calculate accrued interest server-side
      const elapsedMs = now.getTime() - new Date(record.startDate).getTime();
      const elapsedDays = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

      const earnedInterest = this.calculateInterest(
        record.amount,
        record.interestRate,
        elapsedDays,
        record.interestType
      );

      const payoutAmount = record.amount + earnedInterest;

      // Credit user's wallet atomically
      await WalletService.creditWallet(transaction, {
        userId,
        amount: payoutAmount,
        currency: record.currency,
        reference: `claim-${investmentId}`,
        description: `Matured Payout for ${record.optionName} (Principal: ₦${record.amount}, Interest: ₦${earnedInterest})`,
        recipientName: "Self",
        fee: 0,
      });

      // Update investment record
      const updatedRecord: Partial<InvestmentRecord> = {
        status: "CLAIMED",
        accumulatedInterest: earnedInterest,
        totalValue: payoutAmount,
        updatedAt: now.toISOString(),
      };

      transaction.update(investRef, updatedRecord);

      // Save transaction log in investments subledger
      const logRef = adminDb.collection("investmentTransactions").doc(`tx-claim-${investmentId}`);
      transaction.set(logRef, {
        id: `tx-claim-${investmentId}`,
        userId,
        investmentId,
        amount: payoutAmount,
        type: "CLAIM",
        status: "SUCCESS",
        description: `Claimed matured earnings from ${record.optionName}. Total Credited: ₦${payoutAmount.toLocaleString()}`,
        createdAt: now.toISOString(),
      });

      // Write audit log document
      const auditRef = adminDb.collection("auditLogs").doc(`audit-claim-${investmentId}`);
      transaction.set(auditRef, {
        id: `audit-claim-${investmentId}`,
        userId,
        action: "INVESTMENT_CLAIMED",
        metadata: {
          investmentId,
          earnedInterest,
          payoutAmount,
        },
        version: "1.0",
        createdAt: now.toISOString(),
      });

      return {
        record: { ...record, ...updatedRecord } as InvestmentRecord,
        creditedAmount: payoutAmount,
      };
    });

    return result;
  }

  /**
   * Cancel an active savings lock early with a configurable penalty.
   */
  static async cancelInvestment(userId: string, investmentId: string): Promise<{ record: InvestmentRecord; refundAmount: number; penaltyDeducted: number }> {
    const investRef = adminDb.collection("investments").doc(investmentId);
    const settings = await this.getSettings();

    const result = await adminDb.runTransaction(async (transaction) => {
      const doc = await transaction.get(investRef);
      if (!doc.exists) {
        throw new Error("The specified investment was not found.");
      }

      const record = doc.data() as InvestmentRecord;
      if (record.userId !== userId) {
        throw new Error("Forbidden: You do not own this investment lock.");
      }
      if (record.status === "CLAIMED") {
        throw new Error("Cannot cancel an investment that has already been claimed.");
      }
      if (record.status === "CANCELLED") {
        throw new Error("This investment has already been cancelled.");
      }

      const now = new Date();

      // Calculate accrued interest up to cancellation time
      const elapsedMs = now.getTime() - new Date(record.startDate).getTime();
      const elapsedDays = Math.max(1, Math.floor(elapsedMs / (1000 * 60 * 60 * 24)));

      const earnedInterest = this.calculateInterest(
        record.amount,
        record.interestRate,
        elapsedDays,
        record.interestType
      );

      // Apply penalty rate to principal or earned interest
      const penaltyDeducted = Number((record.amount * settings.penaltyRate).toFixed(2));
      const grossAmount = record.amount + earnedInterest;
      const refundAmount = Math.max(0, Number((grossAmount - penaltyDeducted).toFixed(2)));

      // Credit user's wallet with the remaining refund amount
      await WalletService.creditWallet(transaction, {
        userId,
        amount: refundAmount,
        currency: record.currency,
        reference: `cancel-${investmentId}`,
        description: `Early Liquidation for ${record.optionName} (Refund: ₦${refundAmount}, Penalty: ₦${penaltyDeducted})`,
        recipientName: "Self",
        fee: 0,
      });

      // Update investment record
      const updatedRecord: Partial<InvestmentRecord> = {
        status: "CANCELLED",
        accumulatedInterest: earnedInterest,
        totalValue: refundAmount,
        updatedAt: now.toISOString(),
      };

      transaction.update(investRef, updatedRecord);

      // Save transaction log in investments subledger
      const logRef = adminDb.collection("investmentTransactions").doc(`tx-cancel-${investmentId}`);
      transaction.set(logRef, {
        id: `tx-cancel-${investmentId}`,
        userId,
        investmentId,
        amount: refundAmount,
        type: "LIQUIDATE_EARLY",
        status: "SUCCESS",
        description: `Liquidated early. Penalty of ₦${penaltyDeducted.toLocaleString()} applied. Refunded: ₦${refundAmount.toLocaleString()}`,
        createdAt: now.toISOString(),
      });

      // Write audit log document
      const auditRef = adminDb.collection("auditLogs").doc(`audit-cancel-${investmentId}`);
      transaction.set(auditRef, {
        id: `audit-cancel-${investmentId}`,
        userId,
        action: "INVESTMENT_CANCELLED",
        metadata: {
          investmentId,
          earnedInterest,
          penaltyDeducted,
          refundAmount,
        },
        version: "1.0",
        createdAt: now.toISOString(),
      });

      return {
        record: { ...record, ...updatedRecord } as InvestmentRecord,
        refundAmount,
        penaltyDeducted,
      };
    });

    return result;
  }
}
