import crypto from "crypto";

const rawBaseUrl = process.env.FLW_BASE_URL || "";
// Strictly verify the API Base URL doesn't point to an external webhook url like Odoo
const FLW_BASE_URL = rawBaseUrl.includes("api.flutterwave.com")
  ? rawBaseUrl
  : "https://api.flutterwave.com/v3";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || "";

// Custom fetch client with retry logic and standard timeouts
async function flwRequest(endpoint: string, options: RequestInit = {}, retries = 3) {
  const url = `${FLW_BASE_URL}${endpoint}`;
  const headers = {
    "Authorization": `Bearer ${FLW_SECRET_KEY}`,
    "Content-Type": "application/json",
    ...options.headers,
  };

  const config: RequestInit = {
    ...options,
    headers,
  };

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 15000); // 15 seconds timeout

      const response = await fetch(url, {
        ...config,
        signal: controller.signal,
      });

      clearTimeout(id);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP Error ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt === retries) {
        console.error(`[Flutterwave API Error] Call to ${endpoint} failed after ${retries} attempts:`, message);
        throw err;
      }
      // Backoff delay before retry
      await new Promise((res) => setTimeout(res, attempt * 1000));
    }
  }
}

export const flutterwaveService = {
  /**
   * Initializes a transaction payment link
   */
  async initializePayment(data: {
    tx_ref: string;
    amount: number;
    currency: string;
    redirect_url: string;
    customer: {
      email: string;
      name: string;
      phone_number?: string;
    };
    customizations?: {
      title: string;
      description?: string;
      logo?: string;
    };
    meta?: Record<string, string | number | boolean | undefined>;
  }) {
    return flwRequest("/payments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Verifies the status of a specific transaction
   */
  async verifyTransaction(transactionId: string) {
    return flwRequest(`/transactions/${transactionId}/verify`, {
      method: "GET",
    });
  },

  /**
   * Resolves and verifies bank account details
   */
  async verifyBankAccount(data: { account_number: string; account_bank: string }) {
    return flwRequest("/accounts/resolve", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  /**
   * Initiates a single transfer/settlement to a bank account
   */
  async initiateTransfer(data: {
    account_bank: string;
    account_number: string;
    amount: number;
    narrow_reference?: string;
    narration: string;
    currency: string;
    reference: string;
    callback_url?: string;
  }) {
    const payload = {
      account_bank: data.account_bank,
      account_number: data.account_number,
      amount: data.amount,
      narration: data.narration,
      currency: data.currency,
      reference: data.reference,
      callback_url: data.callback_url,
    };

    return flwRequest("/transfers", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  /**
   * Validates the webhook signature securely to avoid forgery
   */
  validateWebhookSignature(signatureHeader: string | null, payloadString: string): boolean {
    if (!signatureHeader || !FLW_WEBHOOK_SECRET) return false;

    try {
      // Flutterwave sends its signature header which can be matched against the hash of our payload
      const hash = crypto.createHmac("sha256", FLW_WEBHOOK_SECRET).update(payloadString).digest("hex");

      // Also check standard hash match for older webhook signatures
      const simpleHash = crypto.createHash("sha256").update(FLW_WEBHOOK_SECRET).digest("hex");

      return signatureHeader === hash || signatureHeader === FLW_WEBHOOK_SECRET || signatureHeader === simpleHash;
    } catch (e) {
      console.error("Signature validation exception:", e);
      return false;
    }
  }
};
