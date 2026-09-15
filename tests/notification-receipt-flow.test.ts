import { describe, test, expect } from "bun:test";

function evaluateTransactionAuthorization(
  authUid: string,
  txDoc: { userId?: string; recipientUserId?: string; metadata?: any; phoneNumber?: string },
  userPhone?: string
): boolean {
  if (!authUid) return false;

  // Direct owner
  if (txDoc.userId && txDoc.userId === authUid) return true;

  // Recipient user
  if (txDoc.recipientUserId && txDoc.recipientUserId === authUid) return true;

  // Metadata checks
  const meta = txDoc.metadata || {};
  if (meta.recipientUserId === authUid || meta.senderUserId === authUid || meta.userId === authUid) {
    return true;
  }

  // Secondary phone match
  if (userPhone && (txDoc.phoneNumber || meta.phoneNumber)) {
    const cleanUserPhone = userPhone.replace(/\D/g, "");
    const cleanTxPhone = (txDoc.phoneNumber || meta.phoneNumber || "").replace(/\D/g, "");
    if (cleanUserPhone && cleanTxPhone && cleanUserPhone.slice(-10) === cleanTxPhone.slice(-10)) {
      return true;
    }
  }

  return false;
}

describe("Notification Receipt & Authorization Flow Suite", () => {
  test("Allows access to transaction owner (userId == authUid)", () => {
    const txDoc = { userId: "user-123", reference: "TX-111" };
    expect(evaluateTransactionAuthorization("user-123", txDoc)).toBe(true);
  });

  test("Allows access to internal transfer recipient (recipientUserId == authUid)", () => {
    const txDoc = { userId: "user-sender", recipientUserId: "user-recipient", reference: "TX-222" };
    expect(evaluateTransactionAuthorization("user-recipient", txDoc)).toBe(true);
  });

  test("Rejects unauthorized user attempt to view another user's transaction", () => {
    const txDoc = { userId: "user-victim", reference: "TX-333" };
    expect(evaluateTransactionAuthorization("user-attacker", txDoc)).toBe(false);
  });

  test("Allows secondary phone number match for airtime/data recipient", () => {
    const txDoc = { userId: "admin-uid", phoneNumber: "+2348012345678", reference: "TX-444" };
    expect(evaluateTransactionAuthorization("user-phone-owner", txDoc, "08012345678")).toBe(true);
  });

  test("Rejects unauthenticated user (authUid is empty)", () => {
    const txDoc = { userId: "user-123", reference: "TX-555" };
    expect(evaluateTransactionAuthorization("", txDoc)).toBe(false);
  });
});
