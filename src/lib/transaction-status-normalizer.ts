export type TransactionLedgerStatus = "DEBITED" | "CREDITED" | "REVERSAL" | "PENDING" | "FAILED";

export interface LedgerStatusResult {
  code: TransactionLedgerStatus;
  label: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
  dotBg: string;
  icon: string;
}

/**
 * Normalizes any transaction record into its authoritative bank ledger status and presentation metadata:
 * - Reversal (Official bank terminology for Refunds / Reversals)
 * - Debited (For outgoing debits / payments)
 * - Credited (For incoming credits / deposits)
 * - Pending (For processing transactions)
 * - Failed (For failed transactions)
 */
export const getTransactionLedgerStatus = (tx?: {
  status?: string;
  direction?: string;
  type?: string;
  category?: string;
  description?: string;
  narration?: string;
} | null): LedgerStatusResult => {
  if (!tx) {
    return {
      code: "FAILED",
      label: "Failed",
      badgeBg: "bg-red-50",
      badgeText: "text-red-600",
      badgeBorder: "border-red-100",
      dotBg: "bg-red-500",
      icon: "cancel",
    };
  }

  const s = String(tx.status || "").toUpperCase().trim();
  const dir = String(tx.direction || "").toUpperCase().trim();
  const type = String(tx.type || "").toUpperCase().trim();
  const cat = String(tx.category || "").toUpperCase().trim();
  const desc = String(tx.description || "").toLowerCase();
  const narr = String(tx.narration || "").toLowerCase();

  // 1. REVERSAL / REFUND (Official Bank Term)
  if (
    s === "REFUND" ||
    s === "REFUNDED" ||
    s === "REVERSED" ||
    s === "REVERSAL" ||
    type === "REFUND" ||
    cat === "REFUND" ||
    desc.includes("refund") ||
    desc.includes("reversal") ||
    narr.includes("refund") ||
    narr.includes("reversal")
  ) {
    return {
      code: "REVERSAL",
      label: "Reversal",
      badgeBg: "bg-blue-50",
      badgeText: "text-blue-600",
      badgeBorder: "border-blue-100",
      dotBg: "bg-blue-500",
      icon: "keyboard_backup_api",
    };
  }

  // 2. PENDING
  if (s === "PENDING" || s === "PROCESSING") {
    return {
      code: "PENDING",
      label: "Pending",
      badgeBg: "bg-amber-50",
      badgeText: "text-amber-600",
      badgeBorder: "border-amber-100",
      dotBg: "bg-amber-500",
      icon: "schedule",
    };
  }

  // 3. FAILED
  if (s === "FAILED" || s === "DECLINED" || s === "REJECTED") {
    return {
      code: "FAILED",
      label: "Failed",
      badgeBg: "bg-red-50",
      badgeText: "text-red-600",
      badgeBorder: "border-red-100",
      dotBg: "bg-red-500",
      icon: "cancel",
    };
  }

  // 4. SUCCESS -> Check if Credited or Debited
  const isCredit =
    dir === "CREDIT" ||
    type === "DEPOSIT" ||
    type === "VIRTUAL_ACCOUNT_DEPOSIT" ||
    cat === "DEPOSIT" ||
    type === "SWAP_CREDIT" ||
    desc.includes("deposit") ||
    desc.includes("credited") ||
    desc.includes("transfer from") ||
    narr.includes("deposit") ||
    narr.includes("transfer from");

  if (isCredit) {
    return {
      code: "CREDITED",
      label: "Credited",
      badgeBg: "bg-emerald-50",
      badgeText: "text-emerald-600",
      badgeBorder: "border-emerald-100",
      dotBg: "bg-emerald-500",
      icon: "check_circle",
    };
  }

  return {
    code: "DEBITED",
    label: "Debited",
    badgeBg: "bg-emerald-50",
    badgeText: "text-emerald-600",
    badgeBorder: "border-emerald-100",
    dotBg: "bg-emerald-500",
    icon: "check_circle",
  };
};
