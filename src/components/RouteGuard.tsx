"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { handleAppSignOut } from "@/lib/logout-util";
import { AppLogo } from "@/components/AppLogo";
import { useAppConfig } from "@/lib/ConfigContext";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useScrollRestoration } from "@/lib/useScrollRestoration";

// Persistently identify the device using sessionStorage instead of localStorage (Bypasses caching on Ctrl+F5)
const getOrCreateDeviceId = (): string => {
  if (typeof window === "undefined") return "";
  let devId = sessionStorage.getItem("deviceId");
  if (!devId) {
    devId = "device_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    sessionStorage.setItem("deviceId", devId);
  }
  return devId;
};

// Global flat micro spinner
const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isPinVerified, userData, updateUserData, deviceAuthState, isOfflineStartup, retryOnlineConnection } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const pathname = usePathname();

  // Enable global scroll position persistence & back history scroll restoration
  useScrollRestoration();

  const [flwVerifying, setFlwVerifying] = useState(false);
  const [flwMessage, setFlwMessage] = useState("");

  // Multi-Device Suspension States (OPay-like Session Overlap Blockers)
  const [isSessionSuspended, setIsSessionSuspended] = useState(false);
  const [isNewDeviceBlocked, setIsNewDeviceBlocked] = useState(false);
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [pinChangeError, setPinChangeError] = useState("");
  const [isSavingPin, setIsSavingPin] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Capture the exact instant the multi-device conflict is intercepted
  const [suspendTime] = useState(() => new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }));

  const activeDeviceModel = typeof window !== "undefined"
    ? (/android/i.test(navigator.userAgent) ? "Android Device" : /iphone|ipad/i.test(navigator.userAgent) ? "iOS Device" : "Workstation / PC")
    : "Mobile Device";

  const isMockRoute = typeof window !== "undefined" && (
    sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true")
  );

  const handleSuspendReLogin = async () => {
    setIsLoggingOut(true);
    if (typeof window !== "undefined") {
      localStorage.removeItem("active_session_id");
    }
    await handleAppSignOut(null);
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinChangeError("");

    if (newPin.length !== 4) {
      setPinChangeError("PIN must be exactly 4 digits");
      return;
    }

    if (newPin !== confirmPin) {
      setPinChangeError("PIN confirmation does not match");
      return;
    }

    setIsSavingPin(true);
    try {
      await updateUserData({ pin: newPin, pinHash: "" });
      toast.success("Security PIN updated successfully!");
      if (typeof window !== "undefined") {
        localStorage.removeItem("active_session_id");
      }
      await handleAppSignOut(null);
    } catch (err: any) {
      setPinChangeError(err.message || "Failed to update PIN");
    } finally {
      setIsSavingPin(false);
    }
  };

  if (isSessionSuspended) {
    return (
      <div className="fixed inset-0 z-[99999] bg-white/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center select-none animate-fadeIn">
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="w-full max-w-sm bg-white rounded-3xl border border-gray-200 p-6 shadow-2xl space-y-5"
        >
          {/* Header Badge */}
          <div className="space-y-2">
            <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto">
              <span className="material-symbols-outlined text-[34px] animate-pulse" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_bad</span>
            </div>
            <h2 className="font-hanken font-black text-lg text-black uppercase tracking-wider leading-tight">
              SESSION EXPIRED
            </h2>
            <p className="font-hanken text-[10px] text-rose-600 font-black uppercase tracking-widest leading-none">
              Logged in on another device
            </p>
          </div>

          {/* Device logs details box */}
          <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl text-left space-y-2.5">
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Conflict Session Details</p>
            <div className="grid grid-cols-1 gap-2 text-xs font-semibold text-gray-800">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">smartphone</span>
                <span className="text-gray-500 uppercase">Device:</span>
                <span className="font-bold select-all text-gray-900">{activeDeviceModel}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">calendar_month</span>
                <span className="text-gray-500 uppercase">Timestamp:</span>
                <span className="font-mono text-gray-900 font-bold">{suspendTime}</span>
              </div>
            </div>
          </div>

          {/* Conflict safety notice */}
          <p className="font-hanken text-[11px] text-gray-500 leading-relaxed font-semibold">
            Your account was logged in on another device. For your financial safety, this session has been suspended.
            <span className="text-rose-600 block mt-1.5 font-bold uppercase text-[9px] tracking-wider">
              If you did not do this, kindly change your access credentials immediately.
            </span>
          </p>

          {/* Action Row */}
          {!isChangingPin ? (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                disabled={isLoggingOut}
                onClick={handleSuspendReLogin}
                className="w-full py-3.5 bg-black hover:bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all disabled:opacity-50"
              >
                {isLoggingOut ? <><ButtonSpinner /> Clearing Session...</> : "Dismiss & Re-login"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setPinChangeError("");
                  setIsChangingPin(true);
                }}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
              >
                Change Security PIN
              </button>
            </div>
          ) : (
            <form onSubmit={handleChangePinSubmit} className="space-y-4 text-left border-t border-gray-100 pt-4 animate-fadeIn">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Enter New 4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="New 4-digit code"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Confirm New 4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                    placeholder="Confirm 4-digit code"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-mono font-bold text-center"
                  />
                </div>
              </div>

              {pinChangeError && (
                <p className="text-[10px] text-red-600 font-bold text-center">{pinChangeError}</p>
              )}

              <div className="flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsChangingPin(false)}
                  className="w-1/3 py-3 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-xl text-xs font-black uppercase text-center"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={isSavingPin || newPin.length !== 4}
                  className="w-2/3 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider disabled:opacity-50"
                >
                  {isSavingPin ? <><ButtonSpinner /> Saving...</> : "Save PIN & Log Out"}
                </button>
              </div>
            </form>
          )}
        </motion.div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel" || pathname?.startsWith("/cpanel");

  if (!user && !isPublicRoute && !isMockRoute) return null;
  if (pathname === "/cpanel" || pathname?.startsWith("/cpanel")) return <>{children}</>;

  // RENDER-LEVEL SECURITY GATE 1: Pending New-Device Verification HARD BLOCK
  if (user && deviceAuthState === "AUTHENTICATED_PENDING_DEVICE_VERIFICATION" && !isPublicRoute && !isMockRoute) {
    return (
      <div className="fixed inset-0 z-[99999] bg-white flex flex-col items-center justify-center p-6 text-center select-none">
        <div className="flex flex-col items-center max-w-sm p-6 rounded-3xl bg-[#fdfdfd] border border-gray-100 shadow-sm space-y-4">
          <div className="w-16 h-16 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600">
            <span className="material-symbols-outlined text-[32px] animate-pulse" style={{ fontVariationSettings: '"FILL" 1' }}>security</span>
          </div>
          <div className="space-y-1">
            <h2 className="font-hanken font-extrabold text-base text-gray-900 uppercase tracking-wider">
              NEW DEVICE DETECTED
            </h2>
            <p className="font-hanken text-xs text-amber-600 font-bold uppercase tracking-widest">
              Security Verification Required
            </p>
          </div>
          <p className="font-hanken text-xs text-gray-500 font-medium leading-relaxed">
            For your security, wallet routes and protected financial services are locked on this unrecognized device until you verify the security code.
          </p>
        </div>
      </div>
    );
  }

  // RENDER-LEVEL SECURITY GATE 2: Offline Startup Mode
  // Displays a clean, read-only offline UI notice while preventing infinite spinner loading hanging
  if (user && (deviceAuthState === "OFFLINE_STARTUP" || isOfflineStartup) && !isMockRoute) {
    return (
      <div className="relative min-h-screen bg-[#FAFAFA]">
        {/* Top Sticky Offline Banner */}
        <div className="sticky top-0 z-[999] w-full bg-amber-500 text-white px-4 py-2.5 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2 text-xs font-bold font-hanken">
            <span className="material-symbols-outlined text-sm animate-pulse">wifi_off</span>
            <span>You are currently offline. Displaying cached read-only wallet view.</span>
          </div>
          <button
            type="button"
            onClick={retryOnlineConnection}
            className="px-3 py-1 bg-white text-amber-700 hover:bg-amber-50 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
          >
            Retry
          </button>
        </div>
        {children}
      </div>
    );
  }

  // Wait for Firestore user data & session state check before making any PIN decision
  if (user && (deviceAuthState === "CHECKING_DEVICE_SESSION" || !userData) && !isMockRoute && !isOfflineStartup) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="relative flex flex-col items-center">
          <div className="flex flex-col items-center p-5 rounded-2xl bg-[#fdfdfd]/80 backdrop-blur-md border border-gray-100/50">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[2px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="relative w-7 h-7 bg-white rounded-full flex items-center justify-center overflow-hidden"
              >
                <AppLogo size={24} />
              </motion.div>
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="mt-3 font-hanken font-bold text-[8px] tracking-[0.25em] uppercase text-gray-400 select-none"
            >
              E-Global Pay
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  if (user && !(userData?.pin || userData?.pinHash) && pathname !== "/auth/pin-setup") return null;
  const isPinRequired = userData?.isPinRequired !== false;
  const isNotificationDeepLink = typeof window !== "undefined" && (
    window.location.search.includes("txRef=") ||
    window.location.search.includes("transactionReference=") ||
    window.location.search.includes("reference=") ||
    Boolean(sessionStorage.getItem("pending_notification_tx_ref")) ||
    Boolean(sessionStorage.getItem("notification_receipt_active"))
  );
  if (user && (userData?.pin || userData?.pinHash) && isPinRequired && !isPinVerified && pathname !== "/auth/pin" && !isNotificationDeepLink) return null;

  return <>{children}</>;
}
