import { adminDb } from "@/lib/firebase-admin";
import { UserWalletAccount, FLWVirtualAccountResponse } from "@/types/flutterwave";

const FLW_SECRET_KEY = process.env.FLW_SECRET_KEY || "";
const FLW_BASE_URL = "https://api.flutterwave.com/v3";

export class VirtualAccountService {
  /**
   * Retrieves an existing permanent virtual account for a user or creates a new one idempotently.
   * Utilizes safe verified Firebase ID Token fallbacks if profile fields are missing in Firestore.
   */
  static async getOrCreateVirtualAccount(
    userId: string,
    emailFallback?: string,
    nameFallback?: string
  ): Promise<UserWalletAccount> {
    if (!userId) {
      throw new Error("Missing authenticated user ID context.");
    }

    const accountRef = adminDb.collection("wallet_accounts").doc(userId);

    // 1. Check if the permanent account already exists in Firestore (Idempotent check)
    const accountDoc = await accountRef.get();
    if (accountDoc.exists) {
      console.log(`[Virtual Account Service] Idempotent hit: existing permanent account found for user: ${userId}`);
      return accountDoc.data() as UserWalletAccount;
    }

    // 2. Fetch the user profile to compile required payload parameters
    console.log(`[Virtual Account Service] No account found. Loading user profile details for: ${userId}`);
    const userDocRef = adminDb.collection("users").doc(userId);
    const userDoc = await userDocRef.get();

    const userData = userDoc.exists ? (userDoc.data() || {}) : {};

    // Defensively resolve email and name with high-security verified Token fallback contexts
    const email = userData.email || emailFallback || `user-${userId}@e-tech-hub.com`;
    const fullname = userData.name || userData.displayName || nameFallback || "Captain User";
    const phone = userData.phoneNumber || userData.phone || "08012345678";
    const bvn = userData.bvn || ""; // optional, passed if configured

    if (!email) {
      throw new Error("Missing required customer email to generate a permanent virtual account.");
    }
    if (!fullname) {
      throw new Error("Missing required customer name. Please configure your profile display name first.");
    }

    const nameParts = fullname.trim().split(/\s+/);
    const firstname = nameParts[0] || "Customer";
    const lastname = nameParts.slice(1).join(" ") || "Wallet";
    const tx_ref = `user-wallet-${userId}`;

    console.log(`[Virtual Account Service] Registering permanent virtual account with Flutterwave for: ${userId}`);

    // 3. Request a permanent virtual account from Flutterwave API
    if (!FLW_SECRET_KEY) {
      throw new Error("Configuration Error: Missing Flutterwave Secret Key.");
    }

    const response = await fetch(`${FLW_BASE_URL}/virtual-account-numbers`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email,
        tx_ref,
        phonenumber: phone,
        is_permanent: true,
        currency: "NGN",
        firstname,
        lastname,
        narration: "E-Tech Wallet Funding Link",
        ...(bvn ? { bvn } : {}),
      }),
    });

    const resData: FLWVirtualAccountResponse = await response.json();

    console.log(`[Virtual Account API Call] HTTP Status: ${response.status}`);
    console.log(`[Virtual Account API Raw Response] ${JSON.stringify(resData)}`);

    if (!response.ok || resData.status !== "success") {
      const apiErrorMessage = resData.message || `HTTP Error ${response.status}`;
      console.error(`[Virtual Account API Error] Failed: ${apiErrorMessage}`);
      throw new Error(apiErrorMessage);
    }

    const flwAccount = resData.data;
    if (!flwAccount || !flwAccount.account_number) {
      throw new Error("The payment gateway failed to return virtual account number credentials.");
    }

    // Mapped account details format
    const newAccountRecord: UserWalletAccount = {
      userId,
      accountNumber: flwAccount.account_number,
      bankName: flwAccount.bank_name || "Wema Bank",
      accountName: `${firstname} ${lastname} - E-Tech`,
      currency: flwAccount.currency || "NGN",
      flwRef: flwAccount.order_ref,
      txRef: tx_ref,
      isPermanent: true,
      status: flwAccount.account_status || "active",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 4. Save to Firestore
    await accountRef.set(newAccountRecord);
    console.log(`[Virtual Account Service] Permanent account recorded in Firestore for: ${userId}`);

    return newAccountRecord;
  }
}
