"use client";

import React, { createContext, useContext, useEffect, useState, useRef } from "react";
import { User, onAuthStateChanged, updateProfile } from "firebase/auth";
import { doc, onSnapshot, updateDoc, getDocFromCache } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "sonner";
import { handleAppSignOut } from "@/lib/logout-util";
import { SessionRevokedModal } from "@/components/SessionRevokedModal";
import { NewDeviceOtpModal } from "@/components/NewDeviceOtpModal";
import { NewDeviceSuccessModal } from "@/components/NewDeviceSuccessModal";

export type DeviceAuthState =
  | "CHECKING_DEVICE_SESSION"
  | "AUTHENTICATED_VERIFIED"
  | "AUTHENTICATED_PENDING_DEVICE_VERIFICATION"
  | "OFFLINE_STARTUP"
  | "UNAUTHENTICATED";

export interface UserData {
  uid?: string;
  name?: string;
  displayName?: string;
  email?: string;
  pin?: string;
  pinHash?: string;
  isPinRequired?: boolean;
  isFaceIdEnabled?: boolean;
  dailyLimit?: number;
  balance?: number;
  activeSessionId?: string;
  [key: string]: any;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPinVerified: boolean;
  setPinVerified: (verified: boolean) => void;
  userData: UserData | null;
  updateUserData: (updates: Partial<UserData>) => Promise<void>;
  deviceAuthState: DeviceAuthState;
  isOfflineStartup: boolean;
  retryOnlineConnection: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const getDetailedDeviceName = (): string => {
  if (typeof window === "undefined") return "Web App";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android Device";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS Device";
  if (/Mac/i.test(ua)) return "Mac Computer";
  if (/Windows/i.test(ua)) return "Windows PC";
  if (/Linux/i.test(ua)) return "Linux Workstation";
  return "Mobile Device";
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [deviceAuthState, setDeviceAuthState] = useState<DeviceAuthState>("CHECKING_DEVICE_SESSION");
  const [isOfflineStartup, setIsOfflineStartup] = useState(false);

  const [isRevokedModalOpen, setIsRevokedModalOpen] = useState(false);
  const [revokedSessionData, setRevokedSessionData] = useState<any>(null);

  const [isNewDeviceOtpOpen, setIsNewDeviceOtpOpen] = useState(false);
  const [isNewDeviceSuccessOpen, setIsNewDeviceSuccessOpen] = useState(false);
  const [previousDeviceName, setPreviousDeviceName] = useState("");
  const inFlightEstablishRef = useRef(false);

  const [newDeviceChallenge, setNewDeviceChallenge] = useState<{
    challengeId: string;
    channel: "whatsapp" | "email";
    maskedDestination: string;
    channels: Array<{ type: "whatsapp" | "email"; label: string; masked: string }>;
  } | null>(null);

  // Load custom mock data from sessionStorage if present
  const getStoredMockData = (): UserData => {
    if (typeof window === "undefined") return {};
    const stored = sessionStorage.getItem("mock_user_data");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  };

  const saveStoredMockData = (data: UserData) => {
    if (typeof window === "undefined") {
      sessionStorage.setItem("mock_user_data", JSON.stringify(data));
    }
  };

  const establishSessionWithTimeout = async (currentUser: User): Promise<boolean> => {
    if (inFlightEstablishRef.current) return false;
    inFlightEstablishRef.current = true;

    const existingSessionId = typeof window !== "undefined" ? localStorage.getItem("active_session_id") : null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500); // 3.5s bounded timeout for network session check

      const idToken = await currentUser.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          ...(existingSessionId ? { "X-Session-ID": existingSessionId } : {}),
        },
        body: JSON.stringify({
          action: "establish",
          existingSessionId: existingSessionId || undefined,
          deviceName: getDetailedDeviceName(),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const sessData = await res.json().catch(() => ({}));

      if (res.ok && sessData.requiresOtp && sessData.challengeId) {
        setDeviceAuthState("AUTHENTICATED_PENDING_DEVICE_VERIFICATION");
        setIsPinVerified(false);
        setIsOfflineStartup(false);
        if (typeof window !== "undefined") {
          localStorage.removeItem("active_session_id");
        }
        setNewDeviceChallenge({
          challengeId: sessData.challengeId,
          channel: sessData.channel || "whatsapp",
          maskedDestination: sessData.maskedDestination || "",
          channels: sessData.channels || [],
        });
        setIsNewDeviceOtpOpen(true);
        if (sessData.dispatchWarning) toast.warning(sessData.dispatchWarning);
        return true;
      } else if (res.ok && sessData.sessionId) {
        setDeviceAuthState("AUTHENTICATED_VERIFIED");
        setIsOfflineStartup(false);
        if (typeof window !== "undefined") {
          localStorage.setItem("active_session_id", sessData.sessionId);
        }
        return true;
      } else {
        toast.error(sessData.error || "Session verification failed.");
        setDeviceAuthState("UNAUTHENTICATED");
        handleAppSignOut(null);
        return false;
      }
    } catch (err: any) {
      if (err.name === "AbortError" || !navigator.onLine) {
        console.warn("[AuthContext] Session fetch timed out or device is offline. Transitioning to OFFLINE_STARTUP mode.");
        setDeviceAuthState("OFFLINE_STARTUP");
        setIsOfflineStartup(true);
        return false;
      } else {
        console.error("[AuthContext Session Setup Error]:", err.message);
        toast.error("Session establishment error. Signing out for security.");
        setDeviceAuthState("UNAUTHENTICATED");
        handleAppSignOut(null);
        return false;
      }
    } finally {
      inFlightEstablishRef.current = false;
    }
  };

  const retryOnlineConnection = async () => {
    if (!user) return;
    setLoading(true);
    setDeviceAuthState("CHECKING_DEVICE_SESSION");
    const success = await establishSessionWithTimeout(user);
    if (!success && !navigator.onLine) {
      toast.info("Still offline. Displaying read-only wallet view.");
    }
    setLoading(false);
  };

  useEffect(() => {
    // Listen to browser online/offline events
    const handleOnline = () => {
      if (isOfflineStartup && user) {
        toast.success("Back online. Syncing session...");
        retryOnlineConnection();
      }
    };
    const handleOffline = () => {
      setIsOfflineStartup(true);
    };

    if (typeof window !== "undefined") {
      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      }
    };
  }, [isOfflineStartup, user]);

  useEffect(() => {
    // Mock mode restriction
    const isDevEnv = process.env.NODE_ENV !== "production";
    const hasMockQuery = isDevEnv && typeof window !== "undefined" && window.location.search.includes("mock=true");
    const hasMockSession = isDevEnv && typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";

    if (hasMockQuery) {
      sessionStorage.setItem("mock", "true");
    }

    if (isDevEnv && (hasMockQuery || hasMockSession)) {
      setUser({
        uid: "mock-uid",
        displayName: "JULES VERNE",
        email: "jules@example.com",
      } as User);

      const storedMock = getStoredMockData();
      setUserData({
        name: "JULES VERNE",
        email: "jules@example.com",
        pin: "1234",
        balance: 750000,
        isPinRequired: true,
        isFaceIdEnabled: false,
        dailyLimit: 500000,
        ...storedMock
      });
      setIsPinVerified(window.location.pathname !== "/auth/pin");
      setLoading(false);
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        setDeviceAuthState("CHECKING_DEVICE_SESSION");

        // Execute session establishment with a bounded 3.5s timeout
        establishSessionWithTimeout(currentUser);

        // Safety timer to resolve userData loading if offline and Firestore listener hangs
        const offlineSnapshotTimer = setTimeout(async () => {
          if (!userData) {
            console.warn("[AuthContext] Firestore snapshot pending. Attempting cache lookup for offline startup...");
            try {
              const cacheSnap = await getDocFromCache(doc(db, "users", currentUser.uid));
              if (cacheSnap.exists()) {
                const cData = cacheSnap.data() as UserData;
                setUserData({
                  isPinRequired: true,
                  isFaceIdEnabled: false,
                  dailyLimit: 500000,
                  balance: cData.balance !== undefined ? cData.balance : 0.00,
                  name: (cData.displayName as string | undefined) || cData.name || "",
                  ...cData,
                });
              } else {
                setUserData({
                  isPinRequired: true,
                  isFaceIdEnabled: false,
                  dailyLimit: 500000,
                  balance: 0.00,
                  name: currentUser.displayName || "",
                  email: currentUser.email || "",
                });
              }
            } catch (_) {
              setUserData({
                isPinRequired: true,
                isFaceIdEnabled: false,
                dailyLimit: 500000,
                balance: 0.00,
                name: currentUser.displayName || "",
                email: currentUser.email || "",
              });
            } finally {
              setLoading(false);
            }
          }
        }, 3000); // 3s fallback

        // Set up real-time listener for user data & active session revocation
        unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          clearTimeout(offlineSnapshotTimer);
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;

            // Single Active Device / Session Revocation Check (only evaluated when online with valid active_session_id)
            const localSessionId = typeof window !== "undefined" ? localStorage.getItem("active_session_id") : null;
            const remoteActiveSessionId = data.activeSessionId as string | undefined;

            if (navigator.onLine && localSessionId && remoteActiveSessionId && localSessionId !== remoteActiveSessionId) {
              console.warn("[Session Revoked] Remote active session changed. Quietly executing security logout for old device...");
              if (typeof window !== "undefined") {
                localStorage.removeItem("active_session_id");
              }
              handleAppSignOut(null);
              return;
            }

            setUserData({
              isPinRequired: true,
              isFaceIdEnabled: false,
              dailyLimit: 500000,
              balance: data.balance !== undefined ? data.balance : 0.00,
              name: (data.displayName as string | undefined) || data.name || "",
              ...data
            });
          } else {
            setUserData({
              isPinRequired: true,
              isFaceIdEnabled: false,
              dailyLimit: 500000,
              balance: 0.00,
            });
          }
          setLoading(false);
        }, (error) => {
          clearTimeout(offlineSnapshotTimer);
          console.warn("[AuthContext] Firestore Listener Error (likely offline):", error.message);
          if (!userData) {
            setUserData({
              isPinRequired: true,
              isFaceIdEnabled: false,
              dailyLimit: 500000,
              balance: 0.00,
              name: currentUser.displayName || "",
              email: currentUser.email || "",
            });
          }
          setLoading(false);
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        setUserData(null);
        setIsPinVerified(false);
        setDeviceAuthState("UNAUTHENTICATED");
        setIsOfflineStartup(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const updateUserData = async (updates: Partial<UserData>) => {
    if (isOfflineStartup || !navigator.onLine) {
      toast.error("You are currently offline. Please reconnect to update settings.");
      return;
    }

    const isMock = sessionStorage.getItem("mock") === "true";

    if (isMock) {
      const merged = { ...userData, ...updates };
      setUserData(merged);
      saveStoredMockData(merged);

      if (user && updates.name) {
        setUser({ ...user, displayName: updates.name } as User);
      }
      return;
    }

    if (user) {
      if (updates.name || updates.photoURL) {
        await updateProfile(user, {
          displayName: updates.name || user.displayName,
          photoURL: (updates.photoURL as string) || user.photoURL
        });
      }
      await updateDoc(doc(db, "users", user.uid), updates);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPinVerified,
        setPinVerified: setIsPinVerified,
        userData,
        updateUserData,
        deviceAuthState,
        isOfflineStartup,
        retryOnlineConnection,
      }}
    >
      {children}
      <SessionRevokedModal
        isOpen={isRevokedModalOpen}
        sessionData={revokedSessionData}
        onClose={() => setIsRevokedModalOpen(false)}
      />

      {newDeviceChallenge && (
        <NewDeviceOtpModal
          isOpen={isNewDeviceOtpOpen}
          challengeId={newDeviceChallenge.challengeId}
          initialChannel={newDeviceChallenge.channel}
          maskedDestination={newDeviceChallenge.maskedDestination}
          channels={newDeviceChallenge.channels}
          onVerifiedSuccess={(newSessId, prevDev) => {
            if (typeof window !== "undefined") {
              localStorage.setItem("active_session_id", newSessId);
            }
            setIsNewDeviceOtpOpen(false);
            setNewDeviceChallenge(null);
            if (prevDev) {
              setPreviousDeviceName(prevDev);
            }
            setIsNewDeviceSuccessOpen(true);
          }}
          onCancel={() => {
            setIsNewDeviceOtpOpen(false);
            setNewDeviceChallenge(null);
            setDeviceAuthState("UNAUTHENTICATED");
            handleAppSignOut(null);
          }}
        />
      )}

      <NewDeviceSuccessModal
        isOpen={isNewDeviceSuccessOpen}
        previousDeviceName={previousDeviceName}
        onContinue={() => {
          setIsNewDeviceSuccessOpen(false);
          setDeviceAuthState("AUTHENTICATED_VERIFIED");
          toast.success("Welcome to E-Global Pay!");
        }}
      />
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
