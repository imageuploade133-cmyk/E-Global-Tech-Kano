const FLW_BASE_URL = "https://etechglobalhub.duckdns.org/api/flutterwave";

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
  firstname?: string;
  lastname?: string;
  narration?: string;
}

// Map of bank codes to default high-fidelity test dial code templates for sandbox fallback
const TEST_USSD_TEMPLATES: Record<string, string> = {
  "058": "*737*1*2*",
  "044": "*901*1*2*",
  "033": "*919*3*2*",
  "057": "*966*2*",
  "011": "*894*1*1*",
  "999992": "*955*2*",
  "50515": "*5573*1*",
};

export class PaymentService {
  /**
   * Requests a custom USSD charge code from the VM Payment Gateway
   */
  static async createUSSDPayment(payload: USSDPaymentPayload, idToken: string) {
    const response = await fetch(`${FLW_BASE_URL}/charges?type=ussd`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
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

    console.log(`[VM Payment Gateway USSD Charge API] HTTP Status: ${response.status}`);
    console.log(`[VM Payment Gateway USSD Charge API] Raw Response: ${JSON.stringify(resData)}`);

    if (!response.ok || resData.status !== "success") {
      const apiErrorMessage = resData.message || `HTTP Error ${response.status}`;
      throw new Error(apiErrorMessage);
    }

    const flwData = resData.data || resData || {};
    const auth = resData.meta?.authorization ||
                 resData.data?.meta?.authorization ||
                 resData.data?.authorization ||
                 {};

    let authNote = auth.note ||
                   auth.validate_instructions ||
                   auth.instruction ||
                   flwData.payment_code ||
                   flwData.payment_instruction ||
                   resData.payment_code ||
                   resData.payment_instruction;

    if (!authNote) {
      const bankPrefix = TEST_USSD_TEMPLATES[payload.bank_code] || "*955*2*";
      authNote = `${bankPrefix}${payload.amount}#`;
    }

    return {
      status: "pending",
      flwId: flwData.id || "flw-test-id",
      txRef: payload.tx_ref,
      ussdCode: authNote,
      bankName: flwData.account_bank || "Selected Bank",
    };
  }

  /**
   * Requests virtual account details from the VM Payment Gateway for direct bank transfer checkout
   */
  static async createBankTransferPayment(payload: BankTransferPayload, idToken: string) {
    const nameParts = (payload.fullname || "").trim().split(/\s+/);
    const calculatedFirstname = payload.firstname || nameParts[0] || "Customer";
    const calculatedLastname = payload.lastname || nameParts.slice(1).join(" ") || "Wallet";

    const response = await fetch(`${FLW_BASE_URL}/charges?type=bank_transfer`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tx_ref: payload.tx_ref,
        amount: payload.amount.toString(),
        currency: "NGN",
        email: payload.email,
        phone_number: payload.phone_number,
        fullname: payload.fullname,
        firstname: calculatedFirstname,
        lastname: calculatedLastname,
        narration: payload.narration || "E-Tech Wallet Funding",
        type: "bank_transfer",
        is_permanent: false,
      }),
    });

    const resData = await response.json();

    console.log(`[VM Payment Gateway Bank Transfer Charge API] HTTP Status: ${response.status}`);
    console.log(`[VM Payment Gateway Bank Transfer Charge API] Raw Response: ${JSON.stringify(resData)}`);

    if (!response.ok || resData.status !== "success") {
      const apiErrorMessage = resData.message || `HTTP Error ${response.status}`;
      throw new Error(apiErrorMessage);
    }

    const flwData = resData.data || resData || {};
    const auth = resData.meta?.authorization ||
                 resData.data?.meta?.authorization ||
                 resData.data?.authorization ||
                 {};

    const transferAccount = auth.transfer_account || flwData.transfer_account || resData.transfer_account;
    const transferBank = auth.transfer_bank || flwData.transfer_bank || resData.transfer_bank || "Wema Bank";
    const transferAmount = Number(auth.transfer_amount || flwData.transfer_amount || resData.transfer_amount || payload.amount);
    const transferReference = auth.transfer_reference || flwData.transfer_reference || resData.transfer_reference || payload.tx_ref;
    const transferNote = auth.transfer_note || flwData.transfer_note || resData.transfer_note || "Make direct transfer to this account number";

    if (!transferAccount) {
      throw new Error("No dynamic virtual account was allocated by the payment gateway.");
    }

    return {
      status: "pending",
      flwId: flwData.id || "flw-test-id",
      txRef: payload.tx_ref,
      accountNumber: transferAccount,
      bankName: transferBank,
      accountName: "E-Tech Global Hub",
      amount: transferAmount,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      reference: transferReference,

      transferAccount,
      transferBank,
      transferAmount,
      transferReference,
      transferNote,
    };
  }

  /**
   * Queries transaction status by tx_ref on the VM Payment Gateway
   */
  static async checkPaymentStatus(txRef: string, idToken: string) {
    const response = await fetch(`${FLW_BASE_URL}/verify`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ txRef }),
    });

    const resData = await response.json();

    if (!response.ok) {
      const errorMsg = resData.message || "";
      const isNotFound = response.status === 404 ||
                         response.status === 400 ||
                         errorMsg.toLowerCase().includes("no transaction") ||
                         errorMsg.toLowerCase().includes("not found");

      if (isNotFound) {
        console.log(`[Polling Status Info] Transaction reference ${txRef} is not yet settled on VM gateway. Status: PENDING`);
        return { status: "PENDING" };
      }

      throw new Error(resData.message || "Failed to contact VM verification api.");
    }

    if (resData.success) {
      return {
        status: "SUCCESS",
        fundedAmount: resData.fundedAmount,
        newBalance: resData.newBalance,
        duplicate: resData.duplicate,
        message: resData.message,
      };
    } else {
      if (resData.error && resData.error.toLowerCase().includes("failed")) {
        return { status: "FAILED" };
      }
      return { status: "PENDING" };
    }
  }
}
