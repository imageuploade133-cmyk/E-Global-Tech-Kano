import { describe, it, expect } from "bun:test";
import { getTransactionLedgerStatus, isCreditTransaction, getTransactionDisplayAmount } from "@/lib/transaction-status-normalizer";

describe("Transaction History Real-Time Status Updates & Cache Consistency", () => {
  it("1. PENDING -> SUCCESS status transition maps correctly to Credited ledger status", () => {
    const pendingTx = {
      id: "tx-deposit-100",
      reference: "trf-fund-100",
      type: "WALLET_FUNDING",
      amount: 15000,
      currency: "NGN",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    const initialLedgerStatus = getTransactionLedgerStatus(pendingTx);
    expect(initialLedgerStatus.code).toBe("PENDING");
    expect(initialLedgerStatus.label).toBe("Pending");

    // Delayed reconciliation update after 24-48 hours
    const updatedSuccessTx = {
      ...pendingTx,
      status: "SUCCESS",
      totalCredited: 15000,
    };

    const updatedLedgerStatus = getTransactionLedgerStatus(updatedSuccessTx);
    expect(updatedLedgerStatus.code).toBe("CREDITED");
    expect(updatedLedgerStatus.label).toBe("Credited");
    expect(isCreditTransaction(updatedSuccessTx)).toBe(true);
    expect(getTransactionDisplayAmount(updatedSuccessTx)).toBe(15000);
  });

  it("2. PENDING -> FAILED status transition maps correctly to Failed ledger status", () => {
    const pendingTx = {
      id: "tx-deposit-200",
      reference: "trf-fund-200",
      type: "WALLET_FUNDING",
      amount: 25000,
      currency: "NGN",
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };

    expect(getTransactionLedgerStatus(pendingTx).code).toBe("PENDING");

    // Reconciliation marks transaction FAILED
    const updatedFailedTx = {
      ...pendingTx,
      status: "FAILED",
    };

    const failedLedgerStatus = getTransactionLedgerStatus(updatedFailedTx);
    expect(failedLedgerStatus.code).toBe("FAILED");
    expect(failedLedgerStatus.label).toBe("Failed");
    expect(isCreditTransaction(updatedFailedTx)).toBe(false);
  });

  it("3. Deduplication map merges snapshot updates into history array without duplicate entries", () => {
    const existingHistory = [
      { id: "tx-1", reference: "ref-1", status: "PENDING", createdAt: "2026-10-12T10:00:00Z" },
      { id: "tx-2", reference: "ref-2", status: "SUCCESS", createdAt: "2026-10-12T09:00:00Z" },
    ];

    const snapshotUpdate = [
      { id: "tx-1", reference: "ref-1", status: "SUCCESS", createdAt: "2026-10-12T10:00:00Z" }, // Status changed PENDING -> SUCCESS
    ];

    // Merge strategy used by ActivityLogContainer onSnapshot
    const txMap = new Map<string, any>();
    snapshotUpdate.forEach((tx) => txMap.set(tx.id, tx));
    existingHistory.forEach((tx) => {
      if (!txMap.has(tx.id)) {
        txMap.set(tx.id, tx);
      }
    });

    const mergedList = Array.from(txMap.values());
    expect(mergedList.length).toBe(2);
    expect(mergedList.find((t) => t.id === "tx-1")?.status).toBe("SUCCESS");
  });

  it("4. Session cache serialization format preserves updated transactions", () => {
    const list = [
      { id: "tx-3", reference: "ref-3", status: "SUCCESS", amount: 50000, totalCredited: 50000 },
    ];

    const cachePayload = JSON.stringify({
      data: list,
      hasMore: false,
      timestamp: Date.now(),
    });

    const deserialized = JSON.parse(cachePayload);
    expect(deserialized.data.length).toBe(1);
    expect(deserialized.data[0].status).toBe("SUCCESS");
    expect(deserialized.data[0].amount).toBe(50000);
  });
});
