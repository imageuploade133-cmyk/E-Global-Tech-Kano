import { adminDb } from "@/lib/firebase-admin";
import { getMessaging } from "firebase-admin/messaging";

export type NotificationType = "transaction" | "security" | "promo";

export interface NotificationPayload {
  title: string;
  body: string;
  type: NotificationType;
  url?: string;
  amount?: number;
  currency?: string;
  reference?: string;
  recipientName?: string;
  bankName?: string;
  channel?: string;
}

export class NotificationService {
  /**
   * Sends a push notification to all registered tokens for a user and saves the notification in history.
   * @param userId The ID of the recipient user.
   * @param payload The notification content (title, body, type, url).
   */
  public static async sendPushNotification(userId: string, payload: NotificationPayload): Promise<boolean> {
    try {
      const now = new Date().toISOString();

      // 1. Save to Firestore under user's notification subcollection
      if (adminDb) {
        try {
          const notificationRef = adminDb.collection("users").doc(userId).collection("notifications").doc();
          await notificationRef.set({
            title: payload.title,
            body: payload.body,
            message: payload.body, // compatibility fallback
            type: payload.type,
            read: false,
            createdAt: now,
            url: payload.url || "",
            amount: payload.amount !== undefined ? payload.amount : null,
            currency: payload.currency || "NGN",
            reference: payload.reference || "",
            recipientName: payload.recipientName || "",
            bankName: payload.bankName || "",
            channel: payload.channel || "",
          });
          console.log(`[NotificationService] Saved notification history for user=${userId} | docId=${notificationRef.id}`);
        } catch (fsErr: any) {
          console.error(`[NotificationService Error] Failed to save history for user=${userId}:`, fsErr.message);
        }
      }

      // 2. Fetch all registered tokens for this user
      if (!adminDb) {
        console.warn(`[NotificationService Warning] adminDb not initialized. Skipping FCM dispatch.`);
        return false;
      }

      const tokensSnapshot = await adminDb.collection("fcm_tokens").where("userId", "==", userId).get();
      if (tokensSnapshot.empty) {
        console.log(`[NotificationService] No active FCM tokens registered for user=${userId}`);
        return false;
      }

      const tokensList: { id: string; token: string; platform: string }[] = [];
      tokensSnapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.token) {
          tokensList.push({
            id: docSnap.id,
            token: data.token,
            platform: data.platform || "web",
          });
        }
      });

      console.log(`[NotificationService] Found ${tokensList.length} FCM token(s) for user=${userId}`);

      // 3. Send notifications via FCM
      const messaging = getMessaging();
      const tokensToDelete: string[] = [];
      let sentCount = 0;

      for (const t of tokensList) {
        try {
          const message = {
            token: t.token,
            notification: {
              title: payload.title,
              body: payload.body,
            },
            data: {
              title: payload.title,
              body: payload.body,
              type: payload.type,
              url: payload.reference ? `/?txRef=${payload.reference}` : (payload.url || ""),
              click_action: payload.reference ? `/?txRef=${payload.reference}` : (payload.url || ""),
              reference: payload.reference || "",
              transactionReference: payload.reference || "",
              txRef: payload.reference || "",
            },
            android: {
              priority: "high" as const,
              notification: {
                sound: "default",
                clickAction: "FLUTTER_NOTIFICATION_CLICK",
              },
            },
            apns: {
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
            webpush: {
              headers: {
                Urgency: "high",
              },
              notification: {
                icon: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
                badge: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
              },
            },
          };

          const fcmResponse = await messaging.send(message);
          sentCount += 1;
          console.log(`[NotificationService] Push successfully dispatched to platform=${t.platform} | fcmId=${fcmResponse}`);
        } catch (fcmErr: any) {
          const errMsg = fcmErr.message || "";
          console.warn(`[NotificationService Warning] Failed to send push to token=${t.id}:`, errMsg);

          // Automatic Invalid/Expired Token Cleanup
          const isInvalidToken =
            fcmErr.code === "messaging/invalid-registration-token" ||
            fcmErr.code === "messaging/registration-token-not-registered" ||
            errMsg.includes("registration-token-not-registered") ||
            errMsg.includes("invalid-registration-token") ||
            errMsg.includes("InvalidRegistration") ||
            errMsg.includes("NotRegistered");

          if (isInvalidToken) {
            tokensToDelete.push(t.id);
          }
        }
      }

      // Perform cleanups asynchronously to avoid blocking
      if (tokensToDelete.length > 0 && adminDb) {
        const db = adminDb;
        const batch = db.batch();
        tokensToDelete.forEach((tokenId) => {
          batch.delete(db.collection("fcm_tokens").doc(tokenId));
        });
        await batch.commit();
          console.log(`[NotificationService] Automatically deleted ${tokensToDelete.length} invalid/expired FCM token(s).`);
      }

      return sentCount > 0;
    } catch (err: any) {
      console.error(`[NotificationService Exception] Failed to execute notification dispatch:`, err.message);
      return false;
    }
  }

  /**
   * Sends one idempotent push notification for a completed reversal/refund.
   * The reversal transaction is already persisted before this method is called.
   */
  public static async sendReversalNotification(params: {
    userId: string;
    reference: string;
    originalReference?: string;
    amount: number;
    currency?: string;
    transactionLabel: string;
    recipientName?: string;
  }): Promise<void> {
    if (!adminDb || !params.userId || !params.reference || params.amount <= 0) return;

    const reversalRef = adminDb.collection("transactions").doc(`tx-${params.reference}`);
    const now = Date.now();
    let shouldDispatch = false;

    try {
      await adminDb.runTransaction(async (transaction) => {
        const snap = await transaction.get(reversalRef);
        if (!snap.exists) return;

        const data = snap.data() || {};
        if (data.reversalNotificationStatus === "SENT") return;

        const leaseExpiresAt = Number(data.reversalNotificationLeaseExpiresAt || 0);
        if (data.reversalNotificationStatus === "PROCESSING" && leaseExpiresAt > now) return;

        transaction.set(reversalRef, {
          reversalNotificationStatus: "PROCESSING",
          reversalNotificationLeaseExpiresAt: now + 60_000,
          reversalNotificationLastAttemptAt: new Date(now).toISOString(),
        }, { merge: true });
        shouldDispatch = true;
      });

      if (!shouldDispatch) return;

      const currency = params.currency || "NGN";
      const formattedAmount = params.amount.toLocaleString("en-NG", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const delivered = await this.sendPushNotification(params.userId, {
        title: "🔄 Transaction Reversed",
        body: `Your ${params.transactionLabel} has been reversed. ₦${formattedAmount} has been refunded to your wallet.`,
        type: "transaction",
        url: "/history",
        amount: params.amount,
        currency,
        reference: params.reference,
        recipientName: params.recipientName || "Wallet",
        channel: "Reversal",
      });

      if (!delivered) {
        await reversalRef.set({
          reversalNotificationStatus: "FAILED",
          reversalNotificationLeaseExpiresAt: null,
          reversalNotificationLastError: "No FCM token accepted the reversal notification",
        }, { merge: true });
        return;
      }

      await reversalRef.set({
        reversalNotificationStatus: "SENT",
        reversalNotificationSentAt: new Date().toISOString(),
        reversalNotificationLeaseExpiresAt: null,
        reversalNotificationOriginalReference: params.originalReference || "",
      }, { merge: true });
    } catch (err: any) {
      try {
        await reversalRef.set({
          reversalNotificationStatus: "FAILED",
          reversalNotificationLeaseExpiresAt: null,
          reversalNotificationLastError: String(err?.message || "Notification dispatch failed").slice(0, 500),
        }, { merge: true });
      } catch {
        // Notification failure must never affect the financial transaction.
      }
      console.error("[NotificationService] Reversal notification dispatch failed:", err?.message || err);
    }
  }

  }
}
