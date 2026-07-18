import crypto from "crypto";
import {
  PaymentGateway,
  InitializePaymentPayload,
  InitializePaymentResponse,
  VerifyPaymentResponse,
  ResolveAccountPayload,
  ResolveAccountResponse,
  CreateTransferRecipientPayload,
  CreateTransferRecipientResponse,
  TransferPayload,
  TransferResponse,
  VirtualAccountPayload,
  VirtualAccountResponse,
  BillPaymentPayload,
  BillPaymentResponse
} from "../../PaymentGateway";
import { verifyAndCreditWallet } from "../../../wallet-funding";
import { BankService } from "@/services/bank-service";

const FLW_BASE_URL = process.env.FLW_BASE_URL || "https://api.flutterwave.com/v3";
const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_WEBHOOK_SECRET = process.env.FLW_WEBHOOK_SECRET || "";

export class FlutterwaveGateway implements PaymentGateway {
  name = "flutterwave";

  private async request(endpoint: string, options: RequestInit = {}, retries = 3) {
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
        const id = setTimeout(() => controller.abort(), 15000);

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
        await new Promise((res) => setTimeout(res, attempt * 1000));
      }
    }
  }

  async initializePayment(payload: InitializePaymentPayload): Promise<InitializePaymentResponse> {
    try {
      const data = {
        tx_ref: `flw-tx-${payload.userId}-${Date.now()}`,
        amount: payload.amount,
        currency: payload.currency,
        redirect_url: payload.redirectUrl,
        customer: {
          email: payload.email,
          name: payload.name,
          phone_number: payload.phone,
        },
        customizations: {
          title: "E-Tech Global Wallet Fund",
          description: "Wallet Provisioning Settlement Link",
          logo: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        },
        meta: {
          userId: payload.userId,
        },
      };

      const res = await this.request("/payments", {
        method: "POST",
        body: JSON.stringify(data),
      });

      if (res.status === "success") {
        return {
          success: true,
          paymentLink: res.data.link,
          reference: data.tx_ref,
        };
      }

      return {
        success: false,
        reference: data.tx_ref,
        error: res.message || "Failed to initialize payment link.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        reference: "",
        error: error.message || "Internal server error.",
      };
    }
  }

  async verifyPayment(transactionId: string, _txRef?: string): Promise<VerifyPaymentResponse> {
    try {
      if (_txRef) {
        console.log(`[FlutterwaveGateway] Verifying transaction with backup reference: ${_txRef}`);
      }
      const res = await this.request(`/transactions/${transactionId}/verify`, {
        method: "GET",
      });

      if (res.status === "success" && res.data) {
        const flwTx = res.data;
        if (flwTx.status === "successful") {
          const creditResult = await verifyAndCreditWallet(flwTx.id.toString());
          return {
            success: true,
            fundedAmount: flwTx.amount,
            newBalance: creditResult.newBalance,
            duplicate: creditResult.duplicate,
            message: creditResult.message,
          };
        }
      }
      return {
        success: false,
        error: "Verification failed. Transaction status: " + (res.data?.status || "unknown"),
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: error.message || "Failed to verify transaction.",
      };
    }
  }

  async resolveAccount(payload: ResolveAccountPayload): Promise<ResolveAccountResponse> {
    try {
      const bank = await BankService.getBankById(payload.bankId);
      if (!bank || !bank.code) {
        return { success: false, error: "Invalid bank selected." };
      }

      const res = await this.request("/accounts/resolve", {
        method: "POST",
        body: JSON.stringify({
          account_number: payload.accountNumber,
          account_bank: bank.code,
        }),
      });

      if (res.status === "success" && res.data) {
        return {
          success: true,
          accountName: res.data.account_name,
        };
      }

      return {
        success: false,
        error: res.message || "Verification failed.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        error: error.message || "Bank resolution error.",
      };
    }
  }

  async createTransferRecipient(payload: CreateTransferRecipientPayload): Promise<CreateTransferRecipientResponse> {
    // Flutterwave transfers directly to banks, they don't explicitly require pre-creating recipients.
    // We return a mock successful recipient code to conform with provider-based architecture.
    return {
      success: true,
      recipientCode: `flw-rec-${payload.bankCode}-${payload.accountNumber}`,
    };
  }

  async transfer(payload: TransferPayload): Promise<TransferResponse> {
    try {
      const bank = await BankService.getBankById(payload.bankId);
      if (!bank || !bank.code) {
        return { success: false, reference: payload.reference, error: "Bank not found." };
      }

      const res = await this.request("/transfers", {
        method: "POST",
        body: JSON.stringify({
          account_bank: bank.code,
          account_number: payload.accountNumber,
          amount: payload.amount,
          narration: payload.narration,
          currency: "NGN",
          reference: payload.reference,
        }),
      });

      if (res.status === "success" && res.data) {
        return {
          success: true,
          reference: res.data.reference || payload.reference,
        };
      }

      return {
        success: false,
        reference: payload.reference,
        error: res.message || "Transfer initiation failed.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        reference: payload.reference,
        error: error.message || "Failed to initiate transfer.",
      };
    }
  }

  async createVirtualAccount(payload: VirtualAccountPayload): Promise<VirtualAccountResponse> {
    try {
      const res = await this.request("/virtual-account-numbers", {
        method: "POST",
        body: JSON.stringify({
          email: payload.email,
          is_permanent: true,
          bvn: process.env.FLW_MOCK_BVN || "22222222222",
          tx_ref: `va-${payload.userId}-${Date.now()}`,
          phonenumber: payload.phone,
          firstname: payload.firstname,
          lastname: payload.lastname,
        }),
      });

      if (res.status === "success" && res.data) {
        return {
          success: true,
          bankName: res.data.bank_name || "Wema Bank",
          accountNumber: res.data.account_number,
          accountName: res.data.account_name || "E-TECH GLOBAL HUB",
        };
      }

      return {
        success: false,
        bankName: "",
        accountNumber: "",
        accountName: "",
        error: res.message || "Failed to generate virtual account.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        bankName: "",
        accountNumber: "",
        accountName: "",
        error: error.message || "Virtual account provisioning failed.",
      };
    }
  }

  async verifyWebhook(headers: Record<string, string>, body: string): Promise<boolean> {
    const signatureHeader = headers["verif-hash"] || headers["x-flutterwave-signature"] || "";
    if (!signatureHeader || !FLW_WEBHOOK_SECRET) return false;

    try {
      const hash = crypto.createHmac("sha256", FLW_WEBHOOK_SECRET).update(body).digest("hex");
      const simpleHash = crypto.createHash("sha256").update(FLW_WEBHOOK_SECRET).digest("hex");

      return signatureHeader === hash || signatureHeader === FLW_WEBHOOK_SECRET || signatureHeader === simpleHash;
    } catch {
      return false;
    }
  }

  async purchaseAirtime(payload: BillPaymentPayload): Promise<BillPaymentResponse> {
    return this.payBills(payload);
  }

  async purchaseData(payload: BillPaymentPayload): Promise<BillPaymentResponse> {
    return this.payBills(payload);
  }

  async payBills(payload: BillPaymentPayload): Promise<BillPaymentResponse> {
    try {
      const res = await this.request("/bills", {
        method: "POST",
        body: JSON.stringify({
          country: "NG",
          customer: payload.customer_id,
          amount: payload.amount,
          recurrence: "ONCE",
          type: payload.item_code,
          reference: payload.reference,
        }),
      });

      if (res.status === "success" && res.data) {
        return {
          success: true,
          reference: payload.reference,
          tx_ref: payload.reference,
          flw_ref: res.data.tx_ref || res.data.reference,
          amount: payload.amount,
          customer: payload.customer_id,
          biller_name: payload.biller_name,
        };
      }

      return {
        success: false,
        reference: payload.reference,
        tx_ref: payload.reference,
        amount: payload.amount,
        customer: payload.customer_id,
        biller_name: payload.biller_name,
        error: res.message || "Failed to process bill payment.",
      };
    } catch (err: unknown) {
      const error = err as Error;
      return {
        success: false,
        reference: payload.reference,
        tx_ref: payload.reference,
        amount: payload.amount,
        customer: payload.customer_id,
        biller_name: payload.biller_name,
        error: error.message || "Failed to process bill payment.",
      };
    }
  }

  async refund(reference: string, amount: number): Promise<boolean> {
    try {
      const res = await this.request(`/refunds`, {
        method: "POST",
        body: JSON.stringify({
          id: reference,
          amount: amount,
        }),
      });
      return res.status === "success";
    } catch {
      return false;
    }
  }
}
export const flutterwaveGateway = new FlutterwaveGateway();
