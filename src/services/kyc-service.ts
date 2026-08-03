import crypto from "crypto";
import { adminDb } from "@/lib/firebase-admin";

export interface KYCProviderResponse {
  success: boolean;
  fullName?: string;
  dob?: string;
  phoneNumber?: string;
  status?: string;
  message?: string;
}

export interface IdentityVerificationProvider {
  resolveIdentity(idNumber: string, type: "bvn" | "nin"): Promise<KYCProviderResponse>;
}

/**
 * High-fidelity Mock KYC Provider for local development & sandboxes.
 * Simulates real provider responses and fraud trigger cases.
 */
export class MockKYCProvider implements IdentityVerificationProvider {
  async resolveIdentity(idNumber: string, type: "bvn" | "nin"): Promise<KYCProviderResponse> {
    const cleanId = idNumber.trim();

    // Mock scenario 1: Fraud Mismatch Case (bvn/nin is "22222222222")
    if (cleanId === "22222222222") {
      return {
        success: true,
        fullName: "John Fraudulent Doe", // will mismatch registered account name
        dob: "1980-01-01",
        phoneNumber: "+2348000000000",
        status: "ACTIVE",
      };
    }

    // Mock scenario 2: Inactive or Invalid ID (bvn/nin is "44444444444")
    if (cleanId === "44444444444") {
      return {
        success: false,
        message: "Identity credential reported as inactive or suspended by registry.",
      };
    }

    // Default mock response: returns a name that can match typical test user profiles
    return {
      success: true,
      fullName: "Abdulkadir Shaba",
      dob: "1995-10-15",
      phoneNumber: "+2348123456789",
      status: "ACTIVE",
    };
  }
}

/**
 * Production-ready Flutterwave KYC Provider.
 * Integrates directly with Flutterwave KYC Resolve APIs.
 */
export class FlutterwaveKYCProvider implements IdentityVerificationProvider {
  async resolveIdentity(idNumber: string, type: "bvn" | "nin"): Promise<KYCProviderResponse> {
    const secretKey = process.env.FLUTTERWAVE_SECRET_KEY;
    if (!secretKey) {
      // Fallback to Mock in dev if key is missing to ensure zero-friction testing
      console.warn("[FlutterwaveKYCProvider] Missing FLUTTERWAVE_SECRET_KEY, falling back to Mock provider.");
      return new MockKYCProvider().resolveIdentity(idNumber, type);
    }

    const url = type === "bvn"
      ? `https://api.flutterwave.com/v3/kyc/bvns/${idNumber}`
      : `https://api.flutterwave.com/v3/kyc/nins/${idNumber}`; // Note: NIN endpoint can vary depending on FLW enterprise contract

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        return { success: false, message: `Upstream KYC provider returned status ${response.status}` };
      }

      const data = await response.json();
      if (data.status === "success" && data.data) {
        return {
          success: true,
          fullName: `${data.data.first_name || ""} ${data.data.last_name || ""}`.trim(),
          dob: data.data.date_of_birth || undefined,
          phoneNumber: data.data.phone_number || undefined,
          status: "ACTIVE",
        };
      }

      return { success: false, message: data.message || "Failed to resolve identity." };
    } catch (err: any) {
      return { success: false, message: err.message || "Network failure connecting to KYC provider." };
    }
  }
}

/**
 * Premium Name Normalization & Cryptographic Duplicate Detection.
 */
export class FraudDetectionService {
  /**
   * Cleans names by removing spaces, punctuation, and converting to lowercase.
   */
  static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "") // remove punctuation
      .replace(/\s+/g, " ")                       // normalize extra spacing
      .trim();
  }

  /**
   * High-accuracy, case-insensitive, space-normalized overlapping word name matcher.
   */
  static doesNameMatch(registeredName: string, providerName: string): boolean {
    const cleanReg = this.normalizeName(registeredName);
    const cleanProv = this.normalizeName(providerName);

    if (cleanReg === cleanProv) return true;

    const regWords = cleanReg.split(" ");
    const provWords = cleanProv.split(" ");

    // Ensure at least 2 key words overlap (e.g. "Abdulkadir" and "Shaba" match)
    let overlapCount = 0;
    for (const word of regWords) {
      if (word.length > 2 && provWords.includes(word)) {
        overlapCount++;
      }
    }

    return overlapCount >= 2;
  }

  /**
   * Generates a secure, irreversible cryptographic hash of BVN/NIN for duplicate checks.
   */
  static hashId(idNumber: string): string {
    return crypto.createHash("sha256").update(idNumber.trim()).digest("hex");
  }

  /**
   * Verifies that the ID hash is not already linked to another active account in Firestore.
   */
  static async checkDuplicateId(idHash: string, currentUid: string): Promise<boolean> {
    // Check bvnHash fields
    const bvnQuery = await adminDb.collection("users")
      .where("bvnHash", "==", idHash)
      .limit(1)
      .get();

    // Check ninHash fields
    const ninQuery = await adminDb.collection("users")
      .where("ninHash", "==", idHash)
      .limit(1)
      .get();

    if (!bvnQuery.empty) {
      const doc = bvnQuery.docs[0];
      if (doc.id !== currentUid) return true;
    }

    if (!ninQuery.empty) {
      const doc = ninQuery.docs[0];
      if (doc.id !== currentUid) return true;
    }

    return false;
  }
}

export class KYCService {
  private static provider: IdentityVerificationProvider = process.env.FLUTTERWAVE_SECRET_KEY
    ? new FlutterwaveKYCProvider()
    : new MockKYCProvider();

  /**
   * Configures the active KYC provider dynamically.
   */
  static setProvider(customProvider: IdentityVerificationProvider): void {
    this.provider = customProvider;
  }

  /**
   * Executes the full secure server-side KYC validation workflow.
   */
  static async verifyUserKYC(
    uid: string,
    idNumber: string,
    type: "bvn" | "nin"
  ): Promise<{ success: boolean; message: string; providerName: string }> {
    const cleanId = idNumber.trim();

    // 1. Fetch current registered user account information
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      throw new Error("User profile not found in database.");
    }

    const userData = userSnap.data();
    if (!userData) {
      throw new Error("Invalid user profile record.");
    }

    const registeredName = userData.fullName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
    if (!registeredName) {
      throw new Error("Registered name not found on user profile. Please update profile display name first.");
    }

    // 2. Cryptographic Duplicate Prevention Check
    const idHash = FraudDetectionService.hashId(cleanId);
    const isDuplicate = await FraudDetectionService.checkDuplicateId(idHash, uid);
    if (isDuplicate) {
      throw new Error("This BVN/NIN is already linked to another active account.");
    }

    // 3. Resolve details via our configured KYC Provider
    const response = await this.provider.resolveIdentity(cleanId, type);
    if (!response.success || !response.fullName) {
      throw new Error(response.message || "Failed to resolve identity status.");
    }

    if (response.status && response.status !== "ACTIVE" && response.status !== "active") {
      throw new Error("The resolved identity has been reported as suspended or inactive.");
    }

    // 4. Strict Identity Name Matching Check
    const isNameMatched = FraudDetectionService.doesNameMatch(registeredName, response.fullName);
    if (!isNameMatched) {
      throw new Error("Resolved identity name does not match the registered account owner.");
    }

    // Mask ID digits for secure storage (e.g. *******5678)
    const maskedId = cleanId.slice(0, 3) + "*".repeat(Math.max(0, cleanId.length - 7)) + cleanId.slice(-4);

    // 5. Securely save verified status metadata in Firestore (with irreversible SHA-256 hashes instead of raw digits)
    const kycVerifiedAt = new Date().toISOString();
    const providerName = process.env.FLUTTERWAVE_SECRET_KEY ? "Flutterwave" : "MockProvider";

    await userRef.set({
      kycStatus: "VERIFIED",
      kycVerifiedAt,
      verificationProvider: providerName,
      verificationReference: `kyc-ref-${uid}-${Date.now()}`,
      verificationLevel: 1,
      // Save masked representations
      maskedBvn: type === "bvn" ? maskedId : userData.maskedBvn || null,
      maskedNin: type === "nin" ? maskedId : userData.maskedNin || null,
      // Save secure cryptographic hashes to prevent future duplicate use
      bvnHash: type === "bvn" ? idHash : userData.bvnHash || null,
      ninHash: type === "nin" ? idHash : userData.ninHash || null,
      // Legacy plain text fields (set to null or masked to satisfy "Do not store raw BVN/NIN")
      bvn: null,
      nin: null,
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    return {
      success: true,
      message: "Identity verification passed successfully.",
      providerName,
    };
  }
}
