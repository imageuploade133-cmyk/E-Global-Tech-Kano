"use client";

import { useEffect, useState, useCallback } from "react";
import { getClientMessaging } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

// Use public VAPID key from environment or standard secure fallback
const VAPID_KEY = process.env.NEXT_PUBLIC_FCM_VAPID_KEY || "BH66pX1fTOnB0K7K6mI3bI_R7pW4-lFzD9k397O05B853VMy9g";

export function useFcm() {
  const { user, userData } = useAuth();
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  const syncTokenWithBackend = useCallback(async (token: string, action: "register" | "unregister") => {
    if (!user) return;
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/fcm/register", {
        method: action === "register" ? "POST" : "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      if (res.ok) {
        console.log(`[FCM Sync] Token ${action}ed successfully in database.`);
      } else {
        console.warn(`[FCM Sync Warning] Token ${action} failed:`, data.message || data.error);
      }
    } catch (err: any) {
      console.error(`[FCM Sync Exception] Failed to sync token with backend:`, err.message);
    }
  }, [user]);

  const requestPermissionAndGetToken = useCallback(async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      console.warn("[FCM Hook] Browser does not support push notifications.");
      return null;
    }

    try {
      const messaging = await getClientMessaging();
      if (!messaging) {
        console.warn("[FCM Hook] Firebase Messaging is not supported in this browser environment.");
        return null;
      }

      // Request browser permission
      const status = await Notification.requestPermission();
      setPermission(status);

      if (status !== "granted") {
        console.log("[FCM Hook] Notification permission denied or dismissed.");
        return null;
      }

      // Fetch FCM Token from Firebase messaging server using the public VAPID key
      const { getToken } = await import("firebase/messaging");
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
      });

      if (token) {
        setFcmToken(token);
        console.log("[FCM Hook] Generated secure FCM token successfully:", token);
        await syncTokenWithBackend(token, "register");
        return token;
      } else {
        console.warn("[FCM Hook] No FCM registration token available. Verify your VAPID key.");
      }
    } catch (err: any) {
      console.error("[FCM Hook Error] Failed to request permission or fetch token:", err.message);
    }
    return null;
  }, [syncTokenWithBackend]);

  useEffect(() => {
    if (!user) {
      setFcmToken(null);
      return;
    }

    // Request and sync FCM token on user login
    requestPermissionAndGetToken();

    // Listen to foreground notifications
    let unsubscribeForeground: (() => void) | undefined;

    const setupForegroundListener = async () => {
      const messaging = await getClientMessaging();
      if (!messaging) return;

      const { onMessage } = await import("firebase/messaging");
      unsubscribeForeground = onMessage(messaging, (payload) => {
        console.log("[FCM Foreground] Push notification received in foreground:", payload);

        const title = payload.notification?.title || payload.data?.title || "New Wallet Update";
        const body = payload.notification?.body || payload.data?.body || "You have a new transaction alert.";
        const type = payload.data?.type || "alert";

        // Display a high-fidelity, customized Sonner toast with a progress activity indicator
        toast.info(title, {
          description: body,
          duration: 6000,
          icon: (
            <span className="material-symbols-outlined text-[#FC7A00] text-[20px] font-bold animate-bounce">
              notifications_active
            </span>
          ),
        });
      });
    };

    setupForegroundListener();

    return () => {
      if (unsubscribeForeground) {
        unsubscribeForeground();
      }
    };
  }, [user, requestPermissionAndGetToken]);

  return {
    fcmToken,
    permission,
    requestPermission: requestPermissionAndGetToken,
  };
}
