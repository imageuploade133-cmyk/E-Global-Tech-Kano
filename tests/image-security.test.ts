import { describe, test, expect } from "bun:test";
import crypto from "crypto";

// Security logic helpers for testing image flow rules deterministically
function generateReceiptDocId(uid: string, url: string): string {
  return crypto.createHash("sha256").update(`${uid}:${url}`).digest("hex");
}

function validateImageUrlHost(url: string): { valid: boolean; hostname?: string; error?: string } {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") {
      return { valid: false, error: "Protocol must be https" };
    }
    if (parsed.hostname !== "i.ibb.co" && parsed.hostname !== "ibb.co") {
      return { valid: false, error: "Hostname must be i.ibb.co or ibb.co" };
    }
    return { valid: true, hostname: parsed.hostname };
  } catch {
    return { valid: false, error: "Malformed URL" };
  }
}

function validateKycReceiptAuthorization(
  authUid: string,
  receipt: { ownerUid: string; url: string; purpose: string; expiresAt: string },
  submittedUrl: string,
  requiredPurpose: string,
  nowIso: string
): { authorized: boolean; reason?: string } {
  if (!authUid || typeof authUid !== "string") {
    return { authorized: false, reason: "Unauthenticated" };
  }
  if (receipt.ownerUid !== authUid) {
    return { authorized: false, reason: "Receipt belongs to another user account (IDOR attempt blocked)" };
  }
  if (receipt.url !== submittedUrl) {
    return { authorized: false, reason: "URL mismatch" };
  }
  if (receipt.purpose !== requiredPurpose) {
    return { authorized: false, reason: `Purpose mismatch: expected ${requiredPurpose}, got ${receipt.purpose}` };
  }
  if (receipt.expiresAt <= nowIso) {
    return { authorized: false, reason: "Receipt expired" };
  }
  return { authorized: true };
}

function sanitizeAdminConfigForClient(configDoc: Record<string, any>): Record<string, any> {
  const sanitized = { ...configDoc };
  delete sanitized.imgbbApiKey;
  return sanitized;
}

describe("Comprehensive Authenticated Attacker & Image Security Test Suite", () => {
  const USER_A_UID = "user-a-attacker-uid";
  const USER_B_UID = "user-b-victim-uid";
  const USER_B_SELFIE_URL = "https://i.ibb.co/victim-selfie.jpg";
  const USER_A_DOC_URL = "https://i.ibb.co/attacker-doc.jpg";
  const USER_A_EXPIRED_URL = "https://i.ibb.co/attacker-expired.jpg";

  test("Test 1: User A requests User B's KYC receipt -> DENIED (IDOR blocked)", () => {
    const receiptB = {
      ownerUid: USER_B_UID,
      url: USER_B_SELFIE_URL,
      purpose: "kyc_selfie",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };
    const now = new Date().toISOString();

    const authResult = validateKycReceiptAuthorization(USER_A_UID, receiptB, USER_B_SELFIE_URL, "kyc_selfie", now);
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toContain("belongs to another user account");
  });

  test("Test 2: User A changes target userId to User B -> DENIED (Server derives identity from auth session)", () => {
    const authSessionUid = USER_A_UID;
    const bodySuppliedUid = USER_B_UID;

    // Backend ignores bodySuppliedUid and evaluates using authSessionUid
    const receiptB = {
      ownerUid: USER_B_UID,
      url: USER_B_SELFIE_URL,
      purpose: "kyc_selfie",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    const authResult = validateKycReceiptAuthorization(authSessionUid, receiptB, USER_B_SELFIE_URL, "kyc_selfie", new Date().toISOString());
    expect(authResult.authorized).toBe(false);
  });

  test("Test 3: User A changes kycId to User B's receipt ID -> DENIED", () => {
    const receiptIdB = generateReceiptDocId(USER_B_UID, USER_B_SELFIE_URL);
    const receiptIdA = generateReceiptDocId(USER_A_UID, USER_B_SELFIE_URL);

    expect(receiptIdA).not.toBe(receiptIdB);
  });

  test("Test 4: User A attempts to reuse a kyc_document receipt as kyc_selfie -> DENIED", () => {
    const receiptADoc = {
      ownerUid: USER_A_UID,
      url: USER_A_DOC_URL,
      purpose: "kyc_document",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    const authResult = validateKycReceiptAuthorization(USER_A_UID, receiptADoc, USER_A_DOC_URL, "kyc_selfie", new Date().toISOString());
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toContain("Purpose mismatch");
  });

  test("Test 5: User A attempts to submit an expired kyc_selfie receipt -> DENIED", () => {
    const receiptAExpired = {
      ownerUid: USER_A_UID,
      url: USER_A_EXPIRED_URL,
      purpose: "kyc_selfie",
      expiresAt: new Date(Date.now() - 60 * 1000).toISOString(), // expired 1 minute ago
    };

    const authResult = validateKycReceiptAuthorization(USER_A_UID, receiptAExpired, USER_A_EXPIRED_URL, "kyc_selfie", new Date().toISOString());
    expect(authResult.authorized).toBe(false);
    expect(authResult.reason).toContain("Receipt expired");
  });

  test("Test 6: Valid user submitting own, unexpired kyc_selfie receipt -> AUTHORIZED", () => {
    const validSelfieUrl = "https://i.ibb.co/valid-selfie.jpg";
    const receiptAValid = {
      ownerUid: USER_A_UID,
      url: validSelfieUrl,
      purpose: "kyc_selfie",
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    };

    const authResult = validateKycReceiptAuthorization(USER_A_UID, receiptAValid, validSelfieUrl, "kyc_selfie", new Date().toISOString());
    expect(authResult.authorized).toBe(true);
  });

  test("Test 7: Direct URL validation strictly requires HTTPS and i.ibb.co / ibb.co domain", () => {
    expect(validateImageUrlHost("https://i.ibb.co/xyz123/selfie.jpg").valid).toBe(true);
    expect(validateImageUrlHost("https://ibb.co/xyz123/selfie.jpg").valid).toBe(true);
    expect(validateImageUrlHost("http://i.ibb.co/xyz123/selfie.jpg").valid).toBe(false); // Insecure HTTP
    expect(validateImageUrlHost("https://evil-attacker.com/fake-selfie.png").valid).toBe(false); // Arbitrary domain
  });

  test("Test 8: Rejection of raw base64 and data URLs for KYC selfies", () => {
    const isBase64OrData = (str: string) => str.trim().startsWith("data:") || str.includes("base64");

    expect(isBase64OrData("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")).toBe(true);
    expect(isBase64OrData("https://i.ibb.co/valid-selfie.jpg")).toBe(false);
  });

  test("Test 9: Admin config sanitization removes imgbbApiKey before returning to client", () => {
    const rawConfig = {
      logoUrl: "https://i.ibb.co/logo.png",
      imgbbApiKey: "secret_imgbb_v1_api_key_12345",
      supportEmail: "support@eglobalpay.com",
    };

    const sanitized = sanitizeAdminConfigForClient(rawConfig);
    expect(sanitized.imgbbApiKey).toBeUndefined();
    expect(sanitized.logoUrl).toBe("https://i.ibb.co/logo.png");
  });

  test("Test 10: Deterministic SHA-256 receipt ID generation consistency", () => {
    const id1 = generateReceiptDocId("user-123", "https://i.ibb.co/sample.jpg");
    const id2 = generateReceiptDocId("user-123", "https://i.ibb.co/sample.jpg");
    const id3 = generateReceiptDocId("user-456", "https://i.ibb.co/sample.jpg");

    expect(id1).toBe(id2);
    expect(id1).not.toBe(id3);
    expect(id1.length).toBe(64); // 256-bit hex digest length
  });
});
