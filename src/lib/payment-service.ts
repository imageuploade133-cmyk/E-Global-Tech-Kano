import { safeParseJson } from "@/lib/utils";

const FLW_BASE_URL = "https://etechglobalhub.duckdns.org/api/flutterwave";

export interface USSDPaymentPayload { tx_ref: string; amount: number; email: string; phone_number: string; fullname: string; bank_code: string; }
export interface BankTransferPayload { tx_ref: string; amount: number; email: string; phone_number: string; fullname: string; firstname?: string; lastname?: string; narration?: string; }

const TEST_USSD_TEMPLATES: Record<string, string> = { "058": "*737*1*2*", "044": "*901*1*2*", "033": "*919*3*2*", "057": "*966*2*", "011": "*894*1*1*", "999992": "*955*2*", "50515": "*5573*1*" };

export class PaymentService {
  static async createUSSDPayment(payload: USSDPaymentPayload, idToken: string) {
    const response = await fetch(`${FLW_BASE_URL}/charges?type=ussd`, { method: "POST", headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ tx_ref: payload.tx_ref, amount: payload.amount.toString(), currency: "NGN", email: payload.email, phone_number: payload.phone_number, fullname: payload.fullname, type: "ussd", country: "NG", account_bank: payload.bank_code }) });
    const resData = await safeParseJson(response);
    console.log(`[VM Payment Gateway USSD Charge API] HTTP Status: ${response.status}`);
    console.log(`[VM Payment Gateway USSD Charge API] Raw Response: ${JSON.stringify(resData)}`);
    if (!response.ok || resData.status !== "success") throw new Error(resData.message || `HTTP Error ${response.status}`);
    const flwData = resData.data || resData || {};
    const auth = resData.meta?.authorization || resData.data?.meta?.authorization || resData.data?.authorization || {};
    let authNote = auth.note || auth.validate_instructions || auth.instruction || flwData.payment_code || flwData.payment_instruction || resData.payment_code || resData.payment_instruction;
    if (!authNote) authNote = `${TEST_USSD_TEMPLATES[payload.bank_code] || "*955*2*"}${payload.amount}#`;
    return { status: "pending", flwId: flwData.id || "flw-test-id", txRef: payload.tx_ref, ussdCode: authNote, bankName: flwData.account_bank || "Selected Bank" };
  }

  static async createBankTransferPayment(payload: BankTransferPayload, idToken: string) {
    const nameParts = (payload.fullname || "").trim().split(/\s+/);
    const calculatedFirstname = payload.firstname || nameParts[0] || "Customer";
    const calculatedLastname = payload.lastname || nameParts.slice(1).join(" ") || "Wallet";
    const response = await fetch(`${FLW_BASE_URL}/charges?type=bank_transfer`, { method: "POST", headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ tx_ref: payload.tx_ref, amount: payload.amount.toString(), currency: "NGN", email: payload.email, phone_number: payload.phone_number, fullname: payload.fullname, firstname: calculatedFirstname, lastname: calculatedLastname, narration: payload.narration || "E-Tech Wallet Funding", type: "bank_transfer", is_permanent: false }) });
    const resData = await safeParseJson(response);
    console.log(`[VM Payment Gateway Bank Transfer Charge API] HTTP Status: ${response.status}`);
    console.log(`[VM Payment Gateway Bank Transfer Charge API] Raw Response: ${JSON.stringify(resData)}`);
    if (!response.ok || resData.status !== "success") throw new Error(resData.message || `HTTP Error ${response.status}`);
    const flwData = resData.data || resData || {};
    const auth = resData.meta?.authorization || resData.data?.meta?.authorization || resData.data?.authorization || {};
    const transferAccount = auth.transfer_account || flwData.transfer_account || resData.transfer_account;
    const transferBank = auth.transfer_bank || flwData.transfer_bank || resData.transfer_bank || "";
    const transferAmount = Number(auth.transfer_amount || flwData.transfer_amount || resData.transfer_amount || payload.amount);
    const transferReference = auth.transfer_reference || flwData.transfer_reference || resData.transfer_reference || payload.tx_ref;
    const transferNote = auth.transfer_note || flwData.transfer_note || resData.transfer_note || "Make direct transfer to this account number";
    if (!transferAccount) throw new Error("No dynamic virtual account was allocated by the payment gateway.");
    return { status: "pending", flwId: flwData.id || "flw-test-id", txRef: payload.tx_ref, accountNumber: transferAccount, bankName: transferBank, accountName: "E-Tech Global Hub", amount: transferAmount, expiresAt: new Date(Date.now() + 11 * 60 * 1000).toISOString(), reference: transferReference, transferAccount, transferBank, transferAmount, transferReference, transferNote };
  }

  static async checkPaymentStatus(txRef: string, idToken: string) {
    const response = await fetch("/api/flutterwave/verify", { method: "POST", headers: { "Authorization": `Bearer ${idToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ txRef }) });
    const resData = await safeParseJson(response);
    if (!response.ok) {
      const errorMsg = resData.message || "";
      const isNotFound = response.status === 404 || response.status === 400 || errorMsg.toLowerCase().includes("no transaction") || errorMsg.toLowerCase().includes("not found");
      if (isNotFound) return { status: "PENDING" };
      throw new Error(resData.message || "Failed to contact VM verification api.");
    }

    if (resData.status === "EXPIRED" || resData.status === "FAILED" || resData.status === "CANCELED" || resData.status === "REVERSED") {
      return { status: resData.status, credited: false, fundedAmount: 0, totalCredited: 0, message: resData.message };
    }

    // Provider SUCCESS is not sufficient for the UI. The wallet must be confirmed credited.
    if (resData.success && resData.credited === true) {
      const fundedAmount = Number(resData.totalCredited ?? resData.fundedAmount ?? resData.amount);
      const totalCredited = Number(resData.totalCredited ?? resData.fundedAmount ?? resData.amount);
      return {
        status: "SUCCESS",
        fundedAmount: Number.isFinite(fundedAmount) && fundedAmount >= 0 ? fundedAmount : undefined,
        totalCredited: Number.isFinite(totalCredited) && totalCredited >= 0 ? totalCredited : undefined,
        credited: true,
        newBalance: resData.newBalance,
        duplicate: resData.duplicate,
        message: resData.message,
      };
    }

    if (resData.success && resData.credited !== true) {
      console.warn(`[Polling Status Info] Provider verification succeeded but wallet credit is not confirmed for ${txRef}. Keeping status PENDING.`);
      return { status: "PENDING", credited: false, fundedAmount: 0, totalCredited: 0, message: resData.message };
    }

    if (resData.error && String(resData.error).toLowerCase().includes("failed")) return { status: "FAILED" };
    return { status: "PENDING" };
  }
}
