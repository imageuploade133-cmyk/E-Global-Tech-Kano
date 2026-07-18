import { adminDb } from "../firebase-admin";
import { PaymentGateway, InitializePaymentPayload, InitializePaymentResponse, VerifyPaymentResponse, ResolveAccountPayload, ResolveAccountResponse, TransferPayload, TransferResponse, VirtualAccountPayload, VirtualAccountResponse } from "./PaymentGateway";
import { flutterwaveGateway } from "./providers/flutterwave/FlutterwaveGateway";
import { paystackGateway } from "./providers/paystack/PaystackGateway";
import { logPaymentEvent } from "../payment-logger";

export interface GatewayConfig {
  id: string;
  enabled: boolean;
  priority: number;
  countries: string[];
  currencies: string[];
  features: {
    funding: boolean;
    transfer: boolean;
    virtualAccount: boolean;
    bills: boolean;
    airtime: boolean;
    data: boolean;
  };
  environment: "sandbox" | "production";
  publicKey: string;
  secretKey: string;
  webhookSecret: string;
}

const DEFAULT_GATEWAYS: Record<string, GatewayConfig> = {
  flutterwave: {
    id: "flutterwave",
    enabled: true,
    priority: 2,
    countries: ["NG", "GH", "KE"],
    currencies: ["NGN", "USD", "GHS", "KES"],
    features: {
      funding: true,
      transfer: true,
      virtualAccount: true,
      bills: true,
      airtime: true,
      data: true,
    },
    environment: "sandbox",
    publicKey: process.env.FLW_PUBLIC_KEY || "",
    secretKey: process.env.FLW_SECRET_KEY || "",
    webhookSecret: process.env.FLW_WEBHOOK_SECRET || "",
  },
  paystack: {
    id: "paystack",
    enabled: true,
    priority: 1,
    countries: ["NG", "GH"],
    currencies: ["NGN", "GHS"],
    features: {
      funding: true,
      transfer: true,
      virtualAccount: true,
      bills: true,
      airtime: true,
      data: true,
    },
    environment: "sandbox",
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || "",
    secretKey: process.env.PAYSTACK_SECRET_KEY || "",
    webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET || "",
  },
};

export class PaymentGatewayManager {
  private static providers: Record<string, PaymentGateway> = {
    flutterwave: flutterwaveGateway,
    paystack: paystackGateway,
  };

  static async getGatewayConfigs(): Promise<Record<string, GatewayConfig>> {
    try {
      const snap = await adminDb.collection("payment_gateways").get();
      if (snap.empty) {
        console.log("[PaymentGatewayManager] Seeding default configurations...");
        const seeded: Record<string, GatewayConfig> = {};
        for (const [key, value] of Object.entries(DEFAULT_GATEWAYS)) {
          await adminDb.collection("payment_gateways").doc(key).set(value);
          seeded[key] = value;
        }
        return seeded;
      }

      const configs: Record<string, GatewayConfig> = {};
      snap.forEach((doc) => {
        configs[doc.id] = doc.data() as GatewayConfig;
      });
      return configs;
    } catch (err) {
      console.warn("[PaymentGatewayManager] Failed to read configs. Falling back to local defaults.", err);
      return DEFAULT_GATEWAYS;
    }
  }

  static async saveGatewayConfig(config: Partial<GatewayConfig> & { id: string }): Promise<void> {
    await adminDb.collection("payment_gateways").doc(config.id).set(config, { merge: true });
    logPaymentEvent({
      category: "Pending Payment Deleted",
      message: `Admin update on Gateway Configuration of [${config.id}] saved successfully.`,
    });
  }

  static async selectGateway(params: {
    country: string;
    currency: string;
    feature: keyof GatewayConfig["features"];
  }): Promise<PaymentGateway> {
    const configs = await this.getGatewayConfigs();
    const candidates = Object.values(configs)
      .filter((cfg) => {
        return (
          cfg.enabled &&
          cfg.countries.includes(params.country.toUpperCase()) &&
          cfg.currencies.includes(params.currency.toUpperCase()) &&
          cfg.features[params.feature]
        );
      })
      .sort((a, b) => b.priority - a.priority);

    if (candidates.length > 0) {
      const bestId = candidates[0].id;
      const provider = this.providers[bestId];
      if (provider) {
        console.log(`[PaymentGatewayManager] Selected prioritized gateway: [${bestId}] for feature [${params.feature}]`);
        return provider;
      }
    }

    console.warn(`[PaymentGatewayManager] No matching prioritized gateway found. Defaulting to Flutterwave.`);
    return this.providers.flutterwave;
  }

  static getProviders(): PaymentGateway[] {
    return Object.values(this.providers);
  }

  static getProvider(id: string): PaymentGateway {
    return this.providers[id] || this.providers.flutterwave;
  }

  static async initializePayment(
    payload: InitializePaymentPayload
  ): Promise<InitializePaymentResponse> {
    const startTime = Date.now();
    const primary = await this.selectGateway({ country: "NG", currency: payload.currency, feature: "funding" });

    try {
      const res = await primary.initializePayment(payload);
      this.logMetrics(primary.name, "initializePayment", startTime, true);
      if (res.success) return res;
      throw new Error(res.error || "Gateway initialization failed.");
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.warn(`[Failover Activated] Primary gateway ${primary.name} failed initialization: ${errorMsg}. Retrying fallback...`);
      const alternativeId = primary.name === "paystack" ? "flutterwave" : "paystack";
      const fallback = this.providers[alternativeId];

      try {
        const res = await fallback.initializePayment(payload);
        this.logMetrics(fallback.name, "initializePayment_failover", startTime, true);
        return res;
      } catch (fallbackErr: unknown) {
        const fallbackErrorMsg = (fallbackErr as Error).message;
        this.logMetrics(primary.name, "initializePayment_failed_entirely", startTime, false, fallbackErrorMsg);
        return {
          success: false,
          reference: "",
          error: `Both primary and fallback gateways failed to initialize: ${fallbackErrorMsg}`,
        };
      }
    }
  }

  static async verifyPayment(
    transactionId: string,
    txRef?: string
  ): Promise<VerifyPaymentResponse> {
    const startTime = Date.now();
    let targetGateway = this.providers.flutterwave;
    const reference = txRef || transactionId;
    if (reference.startsWith("pstk-")) {
      targetGateway = this.providers.paystack;
    }

    try {
      const res = await targetGateway.verifyPayment(transactionId, txRef);
      this.logMetrics(targetGateway.name, "verifyPayment", startTime, true);
      return res;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      this.logMetrics(targetGateway.name, "verifyPayment_failed", startTime, false, errorMsg);
      return {
        success: false,
        error: errorMsg || "Failed to verify transaction.",
      };
    }
  }

  static async resolveAccount(
    payload: ResolveAccountPayload,
    country = "NG",
    currency = "NGN"
  ): Promise<ResolveAccountResponse> {
    const startTime = Date.now();
    const gateway = await this.selectGateway({ country, currency, feature: "transfer" });

    try {
      const res = await gateway.resolveAccount(payload);
      this.logMetrics(gateway.name, "resolveAccount", startTime, true);
      return res;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.warn(`[Failover Account Resolution] Gateway ${gateway.name} failed account resolve: ${errorMsg}. Falling back...`);
      const alternativeId = gateway.name === "paystack" ? "flutterwave" : "paystack";
      const fallback = this.providers[alternativeId];
      try {
        const res = await fallback.resolveAccount(payload);
        this.logMetrics(fallback.name, "resolveAccount_failover", startTime, true);
        return res;
      } catch (fallbackErr: unknown) {
        const fallbackErrorMsg = (fallbackErr as Error).message;
        this.logMetrics(gateway.name, "resolveAccount_failed_entirely", startTime, false, fallbackErrorMsg);
        return {
          success: false,
          error: "Failed to resolve account details with all providers.",
        };
      }
    }
  }

  static async transfer(
    payload: TransferPayload,
    country = "NG",
    currency = "NGN"
  ): Promise<TransferResponse> {
    const startTime = Date.now();
    const gateway = await this.selectGateway({ country, currency, feature: "transfer" });

    try {
      const res = await gateway.transfer(payload);
      this.logMetrics(gateway.name, "transfer", startTime, true);
      return res;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.warn(`[Failover Transfer] Primary gateway ${gateway.name} failed transfer: ${errorMsg}. Initiating fallback...`);
      const alternativeId = gateway.name === "paystack" ? "flutterwave" : "paystack";
      const fallback = this.providers[alternativeId];
      try {
        const res = await fallback.transfer(payload);
        this.logMetrics(fallback.name, "transfer_failover", startTime, true);
        return res;
      } catch (fallbackErr: unknown) {
        const fallbackErrorMsg = (fallbackErr as Error).message;
        this.logMetrics(gateway.name, "transfer_failed_entirely", startTime, false, fallbackErrorMsg);
        return {
          success: false,
          reference: payload.reference,
          error: `Transfer failed on both providers. Last error: ${fallbackErrorMsg}`,
        };
      }
    }
  }

  static async createVirtualAccount(
    payload: VirtualAccountPayload,
    country = "NG",
    currency = "NGN"
  ): Promise<VirtualAccountResponse> {
    const startTime = Date.now();
    const gateway = await this.selectGateway({ country, currency, feature: "virtualAccount" });

    try {
      const res = await gateway.createVirtualAccount(payload);
      this.logMetrics(gateway.name, "createVirtualAccount", startTime, true);
      return res;
    } catch (err: unknown) {
      const errorMsg = (err as Error).message;
      console.warn(`[Failover Virtual Account] ${gateway.name} failed creation: ${errorMsg}. Falling back...`);
      const alternativeId = gateway.name === "paystack" ? "flutterwave" : "paystack";
      const fallback = this.providers[alternativeId];
      try {
        const res = await fallback.createVirtualAccount(payload);
        this.logMetrics(fallback.name, "createVirtualAccount_failover", startTime, true);
        return res;
      } catch (fallbackErr: unknown) {
        const fallbackErrorMsg = (fallbackErr as Error).message;
        this.logMetrics(gateway.name, "createVirtualAccount_failed_entirely", startTime, false, fallbackErrorMsg);
        return {
          success: false,
          bankName: "",
          accountNumber: "",
          accountName: "",
          error: "Failed to generate virtual account details.",
        };
      }
    }
  }

  private static logMetrics(
    gateway: string,
    action: string,
    startTime: number,
    success: boolean,
    errorMessage?: string
  ) {
    const latency = Date.now() - startTime;
    logPaymentEvent({
      category: success ? "Payment Initialized" : "Errors",
      message: `Gateway metric [${gateway}] action [${action}] finished in ${latency}ms. Success: ${success}${errorMessage ? ` | Error: ${errorMessage}` : ""}`,
      processingTimeMs: latency,
    });
  }
}
export const gatewayManager = PaymentGatewayManager;
