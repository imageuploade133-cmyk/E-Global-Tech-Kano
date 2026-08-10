import { adminDb } from "../firebase-admin";
import { logPaymentEvent } from "../payment-logger";
import { safeParseJson } from "@/lib/utils";

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
    secretKey: "",
    webhookSecret: "",
  },
};

export interface BillPaymentPayload {
  biller_code: string;
  item_code: string;
  amount: number;
  customer_id: string;
  biller_name?: string;
  biller_type?: string;
  reference: string;
}

export interface BillPaymentResponse {
  success: boolean;
  reference: string;
  tx_ref: string;
  flw_ref?: string;
  amount: number;
  customer: string;
  biller_name?: string;
  error?: string;
}

export class PaymentGatewayManager {
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
  }): Promise<{ name: string; payBills: (payload: BillPaymentPayload, idToken?: string) => Promise<BillPaymentResponse> }> {
    console.log(`[PaymentGatewayManager] Selecting gateway for feature: ${params.feature}`);
    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    // Option 1 Design: If feature is airtime, route to Clubkonnect VTU endpoint on the Payment Gateway
    if (params.feature === "airtime") {
      return {
        name: "clubkonnect",
        payBills: async (payload: BillPaymentPayload, idToken?: string) => {
          console.log(`[PaymentGatewayManager] Routing airtime purchase S2S to Clubkonnect VTU endpoint | ref=${payload.reference}`);

          const response = await fetch(`${gatewayUrl}/api/vtu/airtime`, {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${idToken || ""}`,
              "x-api-key": gatewayApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              network: payload.biller_name || "MTN",
              phone: payload.customer_id,
              amount: payload.amount,
            }),
          });

          const resData = await safeParseJson(response);
          if (response.ok && resData.success) {
            return {
              success: true,
              reference: payload.reference,
              tx_ref: payload.reference,
              flw_ref: resData.orderId || resData.requestId,
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
            error: resData.message || "Failed to process airtime VTU payment via Clubkonnect.",
          };
        }
      };
    }

    // Default Flutterwave path for other bills (sends both Firebase ID Token & Gateway S2S API Key)
    return {
      name: "flutterwave",
      payBills: async (payload: BillPaymentPayload, idToken?: string) => {
        const response = await fetch(`${gatewayUrl}/api/flutterwave/bills`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${idToken || ""}`,
            "x-api-key": gatewayApiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            country: "NG",
            customer: payload.customer_id,
            amount: payload.amount,
            recurrence: "ONCE",
            type: payload.item_code,
            biller_code: payload.biller_code,
            reference: payload.reference,
          }),
        });

        const resData = await safeParseJson(response);
        if (response.ok && resData.status === "success") {
          return {
            success: true,
            reference: payload.reference,
            tx_ref: payload.reference,
            flw_ref: resData.data?.tx_ref || resData.data?.reference,
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
          error: resData.message || "Failed to process bill payment.",
        };
      }
    };
  }
}
export const gatewayManager = PaymentGatewayManager;
