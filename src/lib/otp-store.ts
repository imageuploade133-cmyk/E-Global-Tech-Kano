import { adminDb, hasAdminCredentials } from "./firebase-admin";

export interface OtpSession {
  phoneNumber: string;
  otpHash: string;
  expiresAt: string;
  cooldownUntil: string;
  verified: boolean;
  verifiedAt?: string;
  attempts: number;
  updatedAt: string;
}

// Global in-memory fallback for local development or when Firebase credentials are not provided
// We attach it to global to persist across Next.js hot reloads in development
const globalForOtp = global as unknown as { inMemoryOtpStore?: Map<string, OtpSession> };
const inMemoryOtpStore = globalForOtp.inMemoryOtpStore || new Map<string, OtpSession>();
if (process.env.NODE_ENV !== "production") {
  globalForOtp.inMemoryOtpStore = inMemoryOtpStore;
}

export class OtpStoreService {
  static async getOtp(phoneNumber: string): Promise<OtpSession | null> {
    if (hasAdminCredentials) {
      try {
        const snap = await adminDb.collection("whatsapp_otps").doc(phoneNumber).get();
        if (snap.exists) {
          return snap.data() as OtpSession;
        }
        return null;
      } catch (err) {
        console.warn("[OTP Store] Firestore read failed, falling back to memory. Error:", err);
      }
    }
    return inMemoryOtpStore.get(phoneNumber) || null;
  }

  static async setOtp(phoneNumber: string, session: OtpSession): Promise<void> {
    if (hasAdminCredentials) {
      try {
        await adminDb.collection("whatsapp_otps").doc(phoneNumber).set(session, { merge: true });
        return;
      } catch (err) {
        console.warn("[OTP Store] Firestore write failed, falling back to memory. Error:", err);
      }
    }
    inMemoryOtpStore.set(phoneNumber, session);
  }

  static async deleteOtp(phoneNumber: string): Promise<void> {
    if (hasAdminCredentials) {
      try {
        await adminDb.collection("whatsapp_otps").doc(phoneNumber).delete();
        return;
      } catch (err) {
        console.warn("[OTP Store] Firestore delete failed, falling back to memory. Error:", err);
      }
    }
    inMemoryOtpStore.delete(phoneNumber);
  }
}
