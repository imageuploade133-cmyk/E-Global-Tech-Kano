export interface PaymentLogPayload {
  category:
    | "Payment Initialization"
    | "Webhook Received"
    | "Redirect Verification"
    | "Duplicate Transaction"
    | "Wallet Credited"
    | "Pending Payment Deleted"
    | "Verification Failed"
    | "Webhook Signature Failure"
    | "Cancelled Payment"
    | "Internal Error";
  transactionId?: string;
  tx_ref?: string;
  userId?: string;
  amount?: number;
  currency?: string;
  processingTimeMs?: number;
  message?: string;
  details?: Record<string, unknown>;
}

export function logPaymentEvent(payload: PaymentLogPayload) {
  const logObj = {
    timestamp: new Date().toISOString(),
    ...payload,
  };

  // Format as structured JSON log for log aggregation systems like Datadog, AWS CloudWatch, or Vercel Axiom
  console.log(`[STRUCTURED_PAYMENT_LOG] ${JSON.stringify(logObj)}`);
}
