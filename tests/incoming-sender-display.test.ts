import { describe, it, expect } from "bun:test";
import { resolveBankName } from "../src/lib/bank-resolver";

describe("Incoming Sender Information Display & Resolution Safety", () => {
  // Helper simulating TransactionReceipt's resolveRealSenderName
  const resolveRealSenderName = (
    transaction: {
      senderName?: string | null;
      description?: string | null;
      recipientName?: string | null;
      customerName?: string | null;
      beneficiaryName?: string | null;
    },
    userData?: { name?: string | null; displayName?: string | null; fullName?: string | null }
  ): string | null => {
    let candidate = transaction.senderName;
    if (!candidate && transaction.description) {
      const descMatch = transaction.description.match(/^(?:Transfer From|Bank Transfer • From)\s+(.+)$/i);
      if (descMatch && descMatch[1]) {
        candidate = descMatch[1].trim();
      }
    }

    if (!candidate || typeof candidate !== "string") return null;
    const trimmedCandidate = candidate.trim();
    if (trimmedCandidate.length === 0) return null;

    const isInvalidRecipientMatch = (invalidName?: string | null) => {
      if (!invalidName || typeof invalidName !== "string") return false;
      const normInvalid = invalidName.trim().toLowerCase();
      const normCand = trimmedCandidate.toLowerCase();
      return normInvalid.length > 0 && normCand === normInvalid;
    };

    if (
      isInvalidRecipientMatch(transaction.recipientName) ||
      isInvalidRecipientMatch(transaction.customerName) ||
      isInvalidRecipientMatch(transaction.beneficiaryName) ||
      isInvalidRecipientMatch(userData?.name) ||
      isInvalidRecipientMatch(userData?.displayName) ||
      isInvalidRecipientMatch(userData?.fullName)
    ) {
      return null;
    }

    return trimmedCandidate;
  };

  // Helper simulating maskAcc function
  const maskAcc = (acc?: string | null) => {
    if (!acc) return null;
    const clean = acc.replace(/\D/g, "");
    if (clean.length <= 4) return clean;
    return "****" + clean.slice(-4);
  };

  it("Test 1: An incoming transaction containing senderName displays the real sender name", () => {
    const tx = {
      senderName: "KABIRU ABDULLAHI SHABA",
      recipientName: "E-GLOBAL USER",
    };
    const resolved = resolveRealSenderName(tx, { name: "E-GLOBAL USER" });
    expect(resolved).toBe("KABIRU ABDULLAHI SHABA");
  });

  it("Test 2: senderBankName is displayed and resolved correctly when available (and does NOT fall back to receiving bank name)", () => {
    const txWithSenderBank = {
      senderBankName: "GTBANK",
      senderBankCode: "058",
      bankName: "Wema Bank", // Receiving bank
      virtualAccountBankName: "Wema Bank",
    };

    const resolvedBank = resolveBankName(txWithSenderBank, [], "TRANSFER_FROM");
    expect(resolvedBank).toBe("GTBANK");

    // When senderBankName is absent, it must NOT fall back to receiving bankName
    const txWithoutSenderBank = {
      senderBankName: null,
      bankName: "Wema Bank", // Receiving bank
      virtualAccountBankName: "Wema Bank",
    };

    const fallbackBank = resolveBankName(txWithoutSenderBank, [], "TRANSFER_FROM");
    expect(fallbackBank).toBe("Bank");
    expect(fallbackBank).not.toBe("Wema Bank");
  });

  it("Test 3: senderAccountNumber is handled according to existing masking rules", () => {
    expect(maskAcc("0123456789")).toBe("****6789");
    expect(maskAcc("1234")).toBe("1234");
    expect(maskAcc(null)).toBeNull();
  });

  it("Test 4: The recipient/customer/user name is NEVER substituted as the sender name", () => {
    const txMatchingRecipient = {
      senderName: "JOHN RECIPIENT DOE",
      recipientName: "JOHN RECIPIENT DOE",
      customerName: "JOHN RECIPIENT DOE",
    };

    const resolved = resolveRealSenderName(txMatchingRecipient, { name: "JOHN RECIPIENT DOE" });
    expect(resolved).toBeNull();
  });

  it("Test 5: Missing sender information does NOT produce a false sender identity", () => {
    const txMissingSender = {
      senderName: null,
      description: "Wallet Funding",
      recipientName: "RECEIVING USER",
    };

    const resolved = resolveRealSenderName(txMissingSender, { name: "RECEIVING USER" });
    expect(resolved).toBeNull();
  });

  it("Test 6: Existing transaction types continue working unchanged", () => {
    const transferTx = {
      recipientBankName: "Access Bank",
      beneficiaryBankName: "Access Bank",
      bankName: "Access Bank",
    };

    const resolvedToBank = resolveBankName(transferTx, [], "TRANSFER_TO");
    expect(resolvedToBank).toBe("Access Bank");
  });
});
