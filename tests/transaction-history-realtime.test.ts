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

  it("4. Target pending listener updates older pagination page items (index > 15) in-place without row duplication", () => {
    // Generate 20 history items (older items loaded via handleLoadMore on page 2)
    const page1And2History = Array.from({ length: 20 }, (_, i) => ({
      id: `tx-page-${i + 1}`,
      reference: `ref-page-${i + 1}`,
      type: "DEPOSIT",
      amount: 20000,
      currency: "NGN",
      status: i === 18 ? "PENDING" : "SUCCESS", // tx-page-19 is pending on page 2
      createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    }));

    // When tx-page-19 transitions from PENDING -> SUCCESS in Firestore, it exits qPending query.
    // Simulating pendingSnap.docChanges() type === "removed" payload
    const removedDocChanges = [
      {
        type: "removed",
        doc: {
          id: "tx-page-19",
          reference: "ref-page-19",
          type: "DEPOSIT",
          amount: 20000,
          currency: "NGN",
          status: "SUCCESS",
          totalCredited: 20000,
          createdAt: new Date(Date.now() - 19 * 3600000).toISOString(),
        },
      },
    ];

    const removedDocIds = new Set<string>();
    const removedTxMap = new Map<string, any>();

    removedDocChanges.forEach((change) => {
      if (change.type === "removed") {
        removedDocIds.add(change.doc.id);
        if (change.doc.reference) removedDocIds.add(change.doc.reference);
        removedTxMap.set(change.doc.id, change.doc);
        if (change.doc.reference) removedTxMap.set(change.doc.reference, change.doc);
      }
    });

    const updatedHistory = page1And2History.map((tx) => {
      const statusUpper = (tx.status || "").toUpperCase();
      const isTxPending = statusUpper === "PENDING" || statusUpper === "PROCESSING";

      if (isTxPending && (removedDocIds.has(tx.id) || (tx.reference && removedDocIds.has(tx.reference)))) {
        const transitionMatch = removedTxMap.get(tx.id) || (tx.reference ? removedTxMap.get(tx.reference) : undefined);
        if (transitionMatch) {
          return {
            ...tx,
            ...transitionMatch,
          };
        }
      }
      return tx;
    });

    expect(updatedHistory.length).toBe(20);
    expect(updatedHistory[18].id).toBe("tx-page-19");
    expect(updatedHistory[18].status).toBe("SUCCESS");
    expect(getTransactionLedgerStatus(updatedHistory[18]).code).toBe("CREDITED");
  });

  it("4b. Target pending listener updates older pagination page items on PENDING -> FAILED transition", () => {
    const page1And2History = Array.from({ length: 20 }, (_, i) => ({
      id: `tx-page-${i + 1}`,
      reference: `ref-page-${i + 1}`,
      type: "DEPOSIT",
      amount: 15000,
      currency: "NGN",
      status: i === 18 ? "PENDING" : "SUCCESS",
      createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    }));

    const removedDocChanges = [
      {
        type: "removed",
        doc: {
          id: "tx-page-19",
          reference: "ref-page-19",
          type: "DEPOSIT",
          amount: 15000,
          currency: "NGN",
          status: "FAILED",
          createdAt: new Date(Date.now() - 19 * 3600000).toISOString(),
        },
      },
    ];

    const removedDocIds = new Set<string>();
    const removedTxMap = new Map<string, any>();

    removedDocChanges.forEach((change) => {
      if (change.type === "removed") {
        removedDocIds.add(change.doc.id);
        if (change.doc.reference) removedDocIds.add(change.doc.reference);
        removedTxMap.set(change.doc.id, change.doc);
        if (change.doc.reference) removedTxMap.set(change.doc.reference, change.doc);
      }
    });

    const updatedHistory = page1And2History.map((tx) => {
      const statusUpper = (tx.status || "").toUpperCase();
      const isTxPending = statusUpper === "PENDING" || statusUpper === "PROCESSING";

      if (isTxPending && (removedDocIds.has(tx.id) || (tx.reference && removedDocIds.has(tx.reference)))) {
        const transitionMatch = removedTxMap.get(tx.id) || (tx.reference ? removedTxMap.get(tx.reference) : undefined);
        if (transitionMatch) {
          return {
            ...tx,
            ...transitionMatch,
          };
        }
      }
      return tx;
    });

    expect(updatedHistory.length).toBe(20);
    expect(updatedHistory[18].id).toBe("tx-page-19");
    expect(updatedHistory[18].status).toBe("FAILED");
    expect(getTransactionLedgerStatus(updatedHistory[18]).code).toBe("FAILED");
  });

  it("4c. Realistic Firestore scenario: removed snapshot contains old PENDING status, getDoc fetches latest SUCCESS/FAILED", async () => {
    // Older page transaction (index 18, page 2)
    const page1And2History = Array.from({ length: 20 }, (_, i) => ({
      id: `tx-page-${i + 1}`,
      reference: `ref-page-${i + 1}`,
      type: "DEPOSIT",
      amount: 50000,
      currency: "NGN",
      status: i === 18 ? "PENDING" : "SUCCESS",
      createdAt: new Date(Date.now() - (i + 1) * 3600000).toISOString(),
    }));

    // Selected transaction in receipt drawer
    let selectedTx: any = { ...page1And2History[18] };

    // Firestore listener 'removed' doc change with old PENDING state in snapshot
    const removedDocChange = {
      type: "removed",
      doc: {
        id: "tx-page-19",
        reference: "ref-page-19",
        type: "DEPOSIT",
        amount: 50000,
        currency: "NGN",
        status: "PENDING", // Snapshot still says PENDING at time of query exit
        createdAt: new Date(Date.now() - 19 * 3600000).toISOString(),
        ref: "transactions/tx-page-19",
      },
    };

    // Simulated getDoc resolver returning fresh terminal document
    const mockGetDocResolver = async (ref: string) => {
      if (ref === "transactions/tx-page-19") {
        return {
          exists: () => true,
          data: () => ({
            id: "tx-page-19",
            reference: "ref-page-19",
            type: "DEPOSIT",
            amount: 50000,
            currency: "NGN",
            status: "SUCCESS",
            totalCredited: 50000,
            createdAt: new Date(Date.now() - 19 * 3600000).toISOString(),
          }),
        };
      }
      return { exists: () => false, data: () => null };
    };

    // Simulating pending listener processing algorithm
    const removedDocIds = new Set<string>();
    const removedTxMap = new Map<string, any>();

    if (removedDocChange.type === "removed") {
      const removedTx = { ...removedDocChange.doc };
      removedDocIds.add(removedTx.id);
      if (removedTx.reference) removedDocIds.add(removedTx.reference);

      const statusUpper = (removedTx.status || "").toUpperCase();
      const isStillPending = statusUpper === "PENDING" || statusUpper === "PROCESSING";

      if (!isStillPending) {
        removedTxMap.set(removedTx.id, removedTx);
      } else {
        const freshSnap = await mockGetDocResolver(removedDocChange.doc.ref);
        if (freshSnap.exists()) {
          const freshTx = freshSnap.data();
          removedTxMap.set(freshTx.id, freshTx);
          if (freshTx.reference) removedTxMap.set(freshTx.reference, freshTx);
        }
      }
    }

    const updatedList = page1And2History.map((tx) => {
      const statusUpper = (tx.status || "").toUpperCase();
      const isTxPending = statusUpper === "PENDING" || statusUpper === "PROCESSING";

      if (isTxPending && (removedDocIds.has(tx.id) || (tx.reference && removedDocIds.has(tx.reference)))) {
        const transitionMatch = removedTxMap.get(tx.id) || (tx.reference ? removedTxMap.get(tx.reference) : undefined);
        if (transitionMatch) {
          return {
            ...tx,
            ...transitionMatch,
          };
        }
      }
      return tx;
    });

    // Sync selectedTx receipt modal state
    const updatedSelected = updatedList.find(
      (t) => t.id === selectedTx.id || t.reference === selectedTx.reference
    );
    if (updatedSelected) {
      selectedTx = updatedSelected;
    }

    // Monthly credit total recalculation check
    const newMonthlyCreditTotal = updatedList.reduce((acc, tx) => {
      const isSuccess = (tx.status || "").toUpperCase() === "SUCCESS";
      return isSuccess && isCreditTransaction(tx) ? acc + getTransactionDisplayAmount(tx) : acc;
    }, 0);

    expect(updatedList.length).toBe(20); // No duplicate rows created
    expect(updatedList[18].status).toBe("SUCCESS");
    expect(selectedTx.status).toBe("SUCCESS");
    expect(getTransactionLedgerStatus(selectedTx).code).toBe("CREDITED");
    expect(newMonthlyCreditTotal).toBe(20 * 50000); // All 20 items are now SUCCESS credited
  });

  it("4d. Safely ignores deleted documents and documents that remain pending without corrupting status", async () => {
    const history = [
      { id: "tx-deleted", reference: "ref-deleted", status: "PENDING", amount: 10000, type: "DEPOSIT" },
      { id: "tx-still-pending", reference: "ref-still-pending", status: "PENDING", amount: 20000, type: "DEPOSIT" },
    ];

    // Mock getDoc for a deleted document (freshSnap.exists() === false)
    const mockGetDocDeleted = async () => ({
      exists: () => false,
      data: () => null,
    });

    // Mock getDoc for document that somehow returned still pending
    const mockGetDocPending = async () => ({
      exists: () => true,
      data: () => ({ id: "tx-still-pending", reference: "ref-still-pending", status: "PENDING", amount: 20000, type: "DEPOSIT" }),
    });

    const removedDocIds = new Set<string>();
    const removedTxMap = new Map<string, any>();

    // Case A: Deleted Document
    removedDocIds.add("tx-deleted");
    const freshDeletedSnap = await mockGetDocDeleted();
    if (freshDeletedSnap.exists()) {
      const freshTx = freshDeletedSnap.data();
      removedTxMap.set(freshTx.id, freshTx);
    }

    // Case B: Document still pending
    removedDocIds.add("tx-still-pending");
    const freshPendingSnap = await mockGetDocPending();
    if (freshPendingSnap.exists()) {
      const freshTx = freshPendingSnap.data();
      // If freshTx status is still pending, it is ignored for status completion
      const statusUpper = (freshTx.status || "").toUpperCase();
      if (statusUpper !== "PENDING" && statusUpper !== "PROCESSING") {
        removedTxMap.set(freshTx.id, freshTx);
      }
    }

    const updatedList = history.map((tx) => {
      const statusUpper = (tx.status || "").toUpperCase();
      const isTxPending = statusUpper === "PENDING" || statusUpper === "PROCESSING";

      if (isTxPending && (removedDocIds.has(tx.id) || (tx.reference && removedDocIds.has(tx.reference)))) {
        const transitionMatch = removedTxMap.get(tx.id) || (tx.reference ? removedTxMap.get(tx.reference) : undefined);
        if (transitionMatch) {
          return {
            ...tx,
            ...transitionMatch,
          };
        }
      }
      return tx;
    });

    // Neither transaction should be changed to SUCCESS/FAILED
    expect(updatedList[0].status).toBe("PENDING");
    expect(updatedList[1].status).toBe("PENDING");
    expect(updatedList.length).toBe(2);
  });

  it("5. Monthly wallet credit total recalculates correctly when a pending deposit transitions to SUCCESS", () => {
    const now = new Date();
    const startOfMonthIso = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const transactions = [
      { id: "tx-1", type: "WALLET_FUNDING", amount: 10000, status: "SUCCESS", createdAt: startOfMonthIso },
      { id: "tx-2", type: "WALLET_FUNDING", amount: 5000, status: "PENDING", createdAt: startOfMonthIso },
    ];

    const calculateMonthlyTotal = (txList: typeof transactions) => {
      let sum = 0;
      txList.forEach((tx) => {
        const isSuccess = (tx.status || "").toUpperCase() === "SUCCESS";
        if (isSuccess && isCreditTransaction(tx)) {
          sum += getTransactionDisplayAmount(tx);
        }
      });
      return sum;
    };

    expect(calculateMonthlyTotal(transactions)).toBe(10000);

    // Pending deposit transitions to SUCCESS via delayed reconciliation
    transactions[1].status = "SUCCESS";
    expect(calculateMonthlyTotal(transactions)).toBe(15000);
  });

  it("6. Session cache serialization format preserves updated transactions", () => {
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
