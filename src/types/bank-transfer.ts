/**
 * Bank Transfer Domain Models
 * ---------------------------------------------------------------------------
 * Single source of truth for every Bank Transfer data shape used across the
 * app: inward funding (dynamic virtual accounts), outward single transfers,
 * bulk transfer batches, pending payment sessions and ledger records.
 *
 * These interfaces are pure type contracts (no runtime code) so importing them
 * never affects existing functionality. Field names mirror the exact Firestore
 * documents and API payloads already produced by the existing services to keep
 * full backward compatibility.
 */

// ===========================================================================
// Shared primitives
// ===========================================================================

export type BankTransferCurrency = "NGN" | string;

/** Canonical lifecycle status for any bank transfer record. */
export type BankTransferStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELED"
  | "REFUND";

export type BankTransferDirection = "CREDIT" | "DEBIT";

/** Funding rails recognised by the ledger (`fundingMethod` field). */
export type BankTransferFundingMethod = "BANK_TRANSFER" | "USSD" | "CARD" | "VIRTUAL_ACCOUNT" | string;

/** Normalizes arbitrary gateway/Firestore status strings to canonical form. */
export function normalizeBankTransferStatus(status?: string | null): BankTransferStatus {
  const s = String(status || "").toUpperCase().trim();
  if (s === "SUCCESS" || s === "SUCCESSFUL") return "SUCCESS";
  if (s === "PENDING") return "PENDING";
  if (s === "PROCESSING") return "PROCESSING";
  if (s === "FAILED" || s === "DECLINED" || s === "REJECTED") return "FAILED";
  if (s === "EXPIRED") return "EXPIRED";
  if (s === "CANCELED" || s === "CANCELLED") return "CANCELED";
  if (s === "REFUND" || s === "REFUNDED" || s === "REVERSED" || s === "REVERSAL") return "REFUND";
  return "PENDING";
}

/** True only when a normalized status represents a confirmed settlement. */
export function isBankTransferSettled(status?: string | null): boolean {
  return normalizeBankTransferStatus(status) === "SUCCESS";
}

/** True when a status represents a terminal failure (no further polling needed). */
export function isBankTransferTerminal(status?: string | null): boolean {
  const s = normalizeBankTransferStatus(status);
  return s === "FAILED" || s === "EXPIRED" || s === "CANCELED";
}

// ===========================================================================
// Outward transfer models (wallet -> external beneficiary bank account)
// ===========================================================================

/** Beneficiary destination details for an outward bank transfer. */
export interface BankTransferBeneficiary {
  name: string;
  accountNumber: string;
  bankName: string;
  /** NIBSS bank code, e.g. "044", or an aggregator-specific id like "100004". */
  bankCode: string;
}

/** Fee breakdown charged on an outward transfer (provider fee + platform markup). */
export interface BankTransferFeeBreakdown {
  /** Raw cost charged by the payment provider/gateway. */
  providerFee: number;
  /** Platform profit markup (tiered or default, from CPanel config). */
  markup: number;
  /** providerFee + markup. */
  combinedFee: number;
  /** amount + combinedFee + vat — the total actually debited from the wallet. */
  totalDebited: number;
}

/** Server-validated request contract accepted by POST /api/flutterwave/transfer. */
export interface OutwardTransferRequest {
  amount: number;
  currency?: BankTransferCurrency;
  account_number?: string;
  accountNumber?: string;
  account_bank?: string;
  accountBank?: string;
  bankCode?: string;
  bank_name?: string;
  bankName?: string;
  account_name?: string;
  accountName?: string;
  narration?: string;
  reference?: string;
  pin?: string;
}

/** Successful response returned by the outward transfer endpoint. */
export interface OutwardTransferResult {
  success: true;
  reference: string;
  provider_reference?: string;
  message?: string;
}

/** A single recipient row inside a bulk transfer batch. */
export interface BulkTransferRecipient {
  account_number: string;
  account_bank: string;
  amount: number;
  account_name?: string;
  narration?: string;
  [key: string]: unknown;
}

/** Request contract accepted by POST /api/flutterwave/bulk-transfer. */
export interface BulkTransferRequest {
  title: string;
  recipients: BulkTransferRecipient[];
  pin: string;
}

// ===========================================================================
// Inward funding models (external bank account -> wallet via dynamic VA)
// ===========================================================================

/** Payload sent to the gateway `POST /charges?type=bank_transfer` endpoint. */
export interface BankTransferChargePayload {
  tx_ref: string;
  amount: string;
  currency: string;
  email: string;
  phone_number: string;
  fullname: string;
  firstname: string;
  lastname: string;
  narration: string;
  type: "bank_transfer";
  is_permanent: false;
}

/** Gateway authorization block carrying the allocated temporary virtual account. */
export interface BankTransferGatewayAuthorization {
  transfer_account?: string;
  transfer_bank?: string;
  transfer_amount?: number | string;
  transfer_reference?: string;
  transfer_note?: string;
  [key: string]: unknown;
}

/** Raw (loosely typed) response shape returned by the gateway charge endpoint. */
export interface BankTransferGatewayResponse {
  status?: string;
  message?: string;
  data?: Record<string, any>;
  meta?: { authorization?: BankTransferGatewayAuthorization };
  transfer_account?: string;
  transfer_bank?: string;
  transfer_amount?: number | string;
  transfer_reference?: string;
  transfer_note?: string;
  [key: string]: unknown;
}

/**
 * The authoritative model for a dynamically allocated inbound bank transfer
 * (temporary virtual account) displayed on the funding checkout screen.
 */
export interface BankTransferSession {
  status: "pending";
  flwId: string;
  txRef: string;
  /** Convenience aliases kept for older consumers of the API response. */
  accountNumber: string;
  bankName: string;
  accountName: string;
  amount: number;
  expiresAt: string;
  reference: string;
  /** Canonical fields consumed by the funding wizard UI. */
  transferAccount: string;
  transferBank: string;
  transferAmount: number;
  transferReference: string;
  transferNote: string;
}

/** Client-side checkout state persisted in the restored funding session. */
export interface BankTransferCheckoutState {
  transferAccount: string;
  transferBank: string;
  transferAmount: number;
  transferReference: string;
  transferNote: string;
}

/** Server-managed document stored at `pending_payments/{tx_ref}`. */
export interface PendingBankPayment {
  userId: string;
  amount: number;
  currency: BankTransferCurrency;
  status: "pending" | "success" | "failed" | "expired" | "canceled";
  createdAt: string;
  [key: string]: unknown;
}

/**
 * Ledger record written to `transactions/tx-FUNDING-{tx_ref}` when a bank
 * transfer funding session is initialized (status PENDING until credited).
 */
export interface BankTransferFundingLedgerRecord {
  userId: string;
  amount: number;
  currency: BankTransferCurrency;
  reference: string;
  transactionNumber: string;
  providerReference: string;
  type: "WALLET_FUNDING";
  category: "deposit";
  direction: "CREDIT";
  title: string;
  description: string;
  recipientName: string;
  creditedTo: string;
  fundingMethod: BankTransferFundingMethod;
  status: BankTransferStatus | string;
  fee: number;
  totalCredited: number;
  date: string;
  time: string;
  transactionDate: string;
  createdAt: string;
  [key: string]: unknown;
}

// ===========================================================================
// Status verification models
// ===========================================================================

/** Normalized result returned by PaymentService.checkPaymentStatus(). */
export interface BankTransferStatusResult {
  success: boolean;
  status: "SUCCESS" | "FAILED" | "EXPIRED" | "CANCELED" | "PENDING";
  fundedAmount: number;
  totalCredited: number;
  amount?: number;
  credited?: boolean;
  newBalance?: number;
  duplicate?: boolean;
  message?: string;
}

// ===========================================================================
// Permanent virtual account models (re-exported for a unified entry point)
// ===========================================================================

export type {
  FLWVirtualAccountPayload,
  FLWVirtualAccountResponse,
  UserWalletAccount,
} from "./flutterwave";
