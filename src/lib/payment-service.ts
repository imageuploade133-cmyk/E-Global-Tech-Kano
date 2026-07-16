import { verifyAndCreditWallet } from "@/lib/wallet-funding";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export interface USSDPaymentPayload {
  tx_ref: string;
  amount: number;
  email: string;
  phone_number: string;
  fullname: string;
  bank_code: string;
}

export interface BankTransferPayload {
  tx_ref: string;
  amount: number;
  email: string;
  phone_number: string;
  fullname: string;
}

export class PaymentService {
  /**
   * Requests a custom USSD charge code from Flutterwave charges API
   */
  static async createUSSDPayment(payload: USSDPaymentPayload) {
    if (!FLW_SECRET_KEY) {
      throw new Error("Configuration Error: Missing Flutterwave Secret Key.");
    }

    const response = await fetch(`${FLW_BASE_URL}/charges?type=ussd`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: payload.tx_ref,
        amount: payload.amount.toString(),
        currency: "NGN",
        email: payload.email,
        phone_number: payload.phone_number,
        fullname: payload.fullname,
        type: "ussd",
        country: "NG",
        account_bank: payload.bank_code,
      }),
    });

    const resData = await response.json();

    if (!response.ok || resData.status !== "success") {
      console.error("[Flutterwave USSD Charge API Error] Response:", resData);
      throw new Error(resData.message || "Failed to initiate USSD charge from Flutterwave.");
    }

    const authNote = resData.data?.meta?.authorization?.note;
    if (!authNote) {
      throw new Error("No USSD dial code returned from the payment gateway.");
    }

    return {
      status: "pending",
      flwId: resData.data.id,
      txRef: payload.tx_ref,
      ussdCode: authNote,
      bankName: resData.data.account_bank || "Selected Bank",
    };
  }

  /**
   * Requests virtual account details from Flutterwave charges API for direct bank transfer checkout
   */
  static async createBankTransferPayment(payload: BankTransferPayload) {
    if (!FLW_SECRET_KEY) {
      throw new Error("Configuration Error: Missing Flutterwave Secret Key.");
    }

    const response = await fetch(`${FLW_BASE_URL}/charges?type=bank_transfer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: payload.tx_ref,
        amount: payload.amount.toString(),
        currency: "NGN",
        email: payload.email,
        phone_number: payload.phone_number,
        fullname: payload.fullname,
        type: "bank_transfer",
      }),
    });

    const resData = await response.json();

    if (!response.ok || resData.status !== "success") {
      console.error("[Flutterwave Bank Transfer Charge API Error] Response:", resData);
      throw new Error(resData.message || "Failed to initiate bank transfer charge from Flutterwave.");
    }

    const auth = resData.data?.meta?.authorization;
    if (!auth || !auth.transfer_account) {
      throw new Error("No dynamic virtual account was allocated by the payment gateway.");
    }

    return {
      status: "pending",
      flwId: resData.data.id,
      txRef: payload.tx_ref,
      transferAmount: Number(auth.transfer_amount || payload.amount),
      transferBank: auth.transfer_bank || "Wema Bank",
      transferAccount: auth.transfer_account,
      transferReference: auth.transfer_reference || payload.tx_ref,
      transferNote: auth.transfer_note || "Make direct transfer to this account number",
    };
  }

  /**
   * Queries Flutterwave transaction status by tx_ref using verify_by_reference.
   * If successful, triggers the shared verifyAndCreditWallet() atomic transaction helper.
   */
  static async checkPaymentStatus(txRef: string) {
    if (!FLW_SECRET_KEY) {
      throw new Error("Configuration Error: Missing Flutterwave Secret Key.");
    }

    const response = await fetch(`${FLW_BASE_URL}/transactions/verify_by_reference?tx_ref=${txRef}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
    });

    const resData = await response.json();

    if (!response.ok) {
      // If transaction reference not found, it is still pending/unpaid
      if (response.status === 404) {
        return { status: "PENDING" };
      }
      throw new Error(resData.message || "Failed to contact Flutterwave verification api.");
    }

    if (resData.status === "success" && resData.data) {
      const flwTx = resData.data;

      if (flwTx.status === "successful") {
        // Trigger the secure, atomic verify and crediting flow
        const creditResult = await verifyAndCreditWallet(flwTx.id.toString());
        return {
          status: "SUCCESS",
          fundedAmount: flwTx.amount,
          newBalance: creditResult.newBalance,
          duplicate: creditResult.duplicate,
          message: creditResult.message,
        };
      } else if (flwTx.status === "failed") {
        return { status: "FAILED" };
      }
    }

    return { status: "PENDING" };
  }
}
