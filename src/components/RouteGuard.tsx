"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { handleAppSignOut } from "@/lib/logout-util";

// Persistently identify the device using localStorage
const getOrCreateDeviceId = (): string => {
  if (typeof window === "undefined") return "";
  let devId = localStorage.getItem("deviceId");
  if (!devId) {
    devId = "device_" + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    localStorage.setItem("deviceId", devId);
  }
  return devId;
};

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isPinVerified, userData, updateUserData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [flwVerifying, setFlwVerifying] = useState(false);
  const [flwMessage, setFlwMessage] = useState("");

  // New Device verification overlay states
  const [isNewDeviceBlocked, setIsNewDeviceBlocked] = useState(false);
  const [verPhone, setVerPhone] = useState("");
  const [verBvnOrEmail, setVerBvnOrEmail] = useState("");
  const [verError, setVerError] = useState("");
  const [verifyingDevice, setVerifyingDevice] = useState(false);

  // Reference lock to prevent infinite updateUserData loops
  const initializingDeviceRef = useRef(false);

  // Detect and verify Flutterwave redirects globally on app startup
  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const verify = params.get("verify");
    const status = params.get("status");
    const transactionId = params.get("transaction_id") || params.get("transactionId");
    const txRef = params.get("tx_ref") || params.get("txRef");

    if (verify === "flw" || transactionId || status === "successful" || status === "completed" || status === "cancelled") {
      console.log("[Redirect Detected] Flutterwave parameters detected on app startup:", {
        verify,
        status,
        transactionId,
        txRef
      });

      if (status === "cancelled") {
        console.log("[Redirect Detected] Payment was cancelled by user.");
        toast.error("The transaction checkout flow was cancelled.");

        if (txRef) {
          const handleCancelCleanup = async () => {
            try {
              let idToken = "mock-token";
              const isMock = sessionStorage.getItem("mock") === "true";
              if (!isMock && user) {
                try {
                  idToken = await user.getIdToken();
                } catch (tokenErr) {
                  console.error("Failed to retrieve client ID token:", tokenErr);
                }
              }

              console.log(`[Cancel Cleanup Started] Cleaning up pending payment: ${txRef}`);
              const res = await fetch("/api/flutterwave/cancel", {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${idToken}`
                },
                body: JSON.stringify({ txRef })
              });
              const data = await res.json();
              console.log("[Cancel Cleanup Complete] Server response received:", data);
            } catch (err) {
              console.error("[Cancel Cleanup Error] Failed to contact cancel clean endpoint:", err);
            } finally {
              const url = new URL(window.location.href);
              url.search = "";
              window.history.replaceState({}, "", url.toString());
            }
          };

          handleCancelCleanup();
        } else {
          const url = new URL(window.location.href);
          url.search = "";
          window.history.replaceState({}, "", url.toString());
        }
        return;
      }

      if (!transactionId) {
        console.warn("[Redirect Detected] missing transaction_id parameter. Skipping verification.");
        return;
      }

      const verifyTransaction = async () => {
        setFlwVerifying(true);
        setFlwMessage("Securing settlement credentials...");

        console.log(`[Calling Verify Endpoint] POST /api/flutterwave/verify with transactionId: ${transactionId}, txRef: ${txRef}`);

        try {
          let idToken = "mock-token";
          const isMock = sessionStorage.getItem("mock") === "true";
          if (!isMock && user) {
            try {
              idToken = await user.getIdToken();
            } catch (tokenErr) {
              console.error("Failed to retrieve client ID token:", tokenErr);
            }
          }

          const res = await fetch("/api/flutterwave/verify", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({ transactionId, txRef })
          });
          const data = await res.json();

          console.log("[Verification Complete] Server response received:", data);

          if (data.success) {
            const url = new URL(window.location.href);
            url.search = "";
            window.history.replaceState({}, "", url.toString());

            if (data.duplicate) {
              console.log("[Duplicate Detected] Transaction was already processed.");
              toast.info("Transaction already processed", {
                description: "This transaction has already been processed. Your wallet was not credited again."
              });
            } else {
              console.log(`[Wallet Refreshed] Successfully verified transaction. Amount: ₦${data.fundedAmount || "N/A"}. New balance: ₦${data.newBalance || "N/A"}`);

              toast.success("Wallet funded successfully!", {
                description: data.message || "Your payment was verified and credited."
              });
            }
          } else {
            console.error("[Verification Complete] Verification unsuccessful:", data.error);
            toast.error("Payment settlement was rejected.", {
              description: data.error || "Please contact customer support."
            });
            const url = new URL(window.location.href);
            url.search = "";
            window.history.replaceState({}, "", url.toString());
          }
        } catch (err) {
          console.error("[Verification Complete] Endpoint execution error:", err);
          toast.error("Verification failed.", {
            description: "Connection error with settlement gateway."
          });
        } finally {
          setFlwVerifying(false);
        }
      };

      verifyTransaction();
    }
  }, []);

  // Smooth scroll and keyboard focus positions reset to prevent page shifting/gaps
  useEffect(() => {
    const handleBlur = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
        setTimeout(() => {
          window.scrollTo({ top: window.scrollY, left: 0, behavior: "smooth" });
        }, 50);
      }
    };

    document.addEventListener("focusout", handleBlur);
    return () => {
      document.removeEventListener("focusout", handleBlur);
    };
  }, []);

  // Single-device session listener & verification guard
  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (loading || isMock || !user || !userData) return;

    // Skip device enforcement on public routes
    const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel";
    if (isPublicRoute) return;

    const deviceId = getOrCreateDeviceId();
    const verifiedList = Array.isArray(userData.verifiedDevices) ? userData.verifiedDevices : [];

    // 1. First-time registration of deviceId: Whitelist the first device used to register/login
    if (!userData.registeredDeviceId && !initializingDeviceRef.current) {
      initializingDeviceRef.current = true;
      console.log("[Device Guard] Initializing original registered device ID:", deviceId);
      updateUserData({
        registeredDeviceId: deviceId,
        verifiedDevices: [deviceId],
        currentDeviceId: deviceId,
      })
        .then(() => {
          setIsNewDeviceBlocked(false);
          initializingDeviceRef.current = false;
        })
        .catch((err) => {
          console.error("Failed to initialize registered device:", err);
          initializingDeviceRef.current = false;
        });
      return;
    }

    // 2. Real-time active session validation (Force logout if logged in elsewhere)
    const isCurrentDeviceVerified = userData.registeredDeviceId === deviceId || verifiedList.includes(deviceId);
    if (isCurrentDeviceVerified) {
      setIsNewDeviceBlocked(false);

      if (userData.currentDeviceId && userData.currentDeviceId !== deviceId) {
        console.warn("[Device Guard] Active session changed to another device. Terminating this session.");
        toast.error("Session Expired", {
          description: "Your account was logged in on another device. Logging out...",
        });
        handleAppSignOut(router);
        return;
      }

      // If we are verified but database records another currentDeviceId, sync it atomically
      if (userData.currentDeviceId !== deviceId && !initializingDeviceRef.current) {
        initializingDeviceRef.current = true;
        updateUserData({ currentDeviceId: deviceId })
          .then(() => {
            initializingDeviceRef.current = false;
          })
          .catch(() => {
            initializingDeviceRef.current = false;
          });
      }
    } else {
      // 3. Unrecognized device detected: Block transaction activity with validation overlay
      console.warn("[Device Guard] Unrecognized device detected:", deviceId);
      setIsNewDeviceBlocked(true);
    }
  }, [user, loading, userData, pathname, router, updateUserData]);

  // Route protection rules for standard login status
  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (loading && !isMock) return;

    const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel";

    if (!user && !isMock) {
      if (!isPublicRoute) {
        router.push("/auth/login");
      }
    } else if (user) {
      const hasPin = Boolean(userData?.pin || userData?.pinHash);
      const isPinRequired = userData?.isPinRequired !== false;

      if (pathname === "/cpanel") {
        return;
      }

      if (!hasPin && pathname !== "/auth/pin-setup") {
        router.push("/auth/pin-setup");
      } else if (hasPin && isPinRequired && !isPinVerified && pathname !== "/auth/pin") {
        router.push("/auth/pin");
      } else if (
        (hasPin && isPinVerified && (pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/auth/pin" || pathname === "/auth/pin-setup")) ||
        (hasPin && !isPinRequired && (pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/auth/pin" || pathname === "/auth/pin-setup"))
      ) {
        router.push("/");
      }
    }
  }, [user, loading, isPinVerified, userData, pathname, router]);

  // Verification submission handler for unrecognized devices
  const handleVerifyNewDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userData) return;

    setVerError("");
    setVerifyingDevice(true);

    try {
      // Normalize and clean phone digits for safe matching
      const inputPhoneClean = verPhone.replace(/\D/g, "");
      const registeredPhoneClean = (userData.phoneNumber as string || "").replace(/\D/g, "");

      const isPhoneMatch =
        inputPhoneClean.length >= 7 &&
        (registeredPhoneClean.endsWith(inputPhoneClean) || inputPhoneClean.endsWith(registeredPhoneClean));

      let isBvnOrEmailMatch = false;
      const bvnValue = (userData.bvn as string || "").trim();

      if (bvnValue) {
        // If BVN is stored, compare the last 4 characters
        const last4Bvn = bvnValue.slice(-4);
        isBvnOrEmailMatch = verBvnOrEmail.trim() === last4Bvn;
      } else {
        // Otherwise, compare registered email address case-insensitively
        const registeredEmail = (userData.email as string || "").trim().toLowerCase();
        isBvnOrEmailMatch = verBvnOrEmail.trim().toLowerCase() === registeredEmail;
      }

      if (isPhoneMatch && isBvnOrEmailMatch) {
        const deviceId = getOrCreateDeviceId();
        const currentVerified = Array.isArray(userData.verifiedDevices) ? userData.verifiedDevices : [];

        // Save verified status
        await updateUserData({
          verifiedDevices: [...currentVerified, deviceId],
          currentDeviceId: deviceId,
        });

        toast.success("Device Authorized!", {
          description: "This device is verified. Security sessions initialized.",
        });
        setIsNewDeviceBlocked(false);
      } else {
        setVerError("Verification failed. Registered phone number or last 4 digits of BVN do not match.");
      }
    } catch (err: any) {
      console.error("Device verification failed:", err);
      setVerError("Internal error during device validation. Please try again.");
    } finally {
      setVerifyingDevice(false);
    }
  };

  const handleSignOutFromBlockedDevice = async () => {
    setIsNewDeviceBlocked(false);
    await handleAppSignOut(router);
  };

  if (flwVerifying) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="relative flex flex-col items-center">
          <div className="flex flex-col items-center p-6 rounded-3xl bg-[#fdfdfd]/80 backdrop-blur-md border border-gray-100/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)] max-w-xs text-center">
            <div className="relative w-12 h-12 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[3px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px] font-bold animate-pulse">lock_clock</span>
            </div>

            <h3 className="font-hanken font-extrabold text-xs text-gray-900 uppercase tracking-wider mt-4">Verifying Settlement</h3>
            <p className="font-hanken text-[10px] text-gray-500 mt-1.5 font-semibold leading-relaxed">
              {flwMessage || "Connecting to Flutterwave rails to verify your secure transaction deposit..."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  const isMockRoute = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
  if (loading && !isMockRoute) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="relative flex flex-col items-center">
          <div className="flex flex-col items-center p-5 rounded-2xl bg-[#fdfdfd]/80 backdrop-blur-md border border-gray-100/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[2px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />

              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="relative w-7 h-7 bg-white rounded-full p-0.5 shadow-sm flex items-center justify-center overflow-hidden"
              >
                <Image
                  src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                  alt="E-Tech Logo"
                  width={24}
                  height={24}
                  className="object-contain"
                />
              </motion.div>
            </div>

            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="mt-3 font-hanken font-bold text-[8px] tracking-[0.25em] uppercase text-gray-400 select-none"
            >
              E-TECH HUB
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  // Render high-fidelity security block overlay for unrecognized device logins
  if (isNewDeviceBlocked && userData) {
    const hasBvn = !!userData.bvn;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50/50 p-6 z-[999999] relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-3xl p-6 border border-gray-100 shadow-xl text-center space-y-6"
        >
          {/* Lock Header */}
          <div className="space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[24px] font-bold animate-pulse">gpp_maybe</span>
            </div>
            <h2 className="font-hanken font-black text-base text-red-600 uppercase tracking-wider leading-none">
              NEW DEVICE DETECTED
            </h2>
            <p className="font-hanken text-[11px] text-gray-400 font-bold uppercase tracking-wider">
              Verification Required
            </p>
            <p className="font-hanken text-[10.5px] text-gray-500 leading-relaxed font-semibold">
              To secure your wallet and prevent unauthorized transfers, please verify your identity to register this device.
            </p>
          </div>

          {/* Validation Form with Verify button moved below inputs for 100% user friendliness */}
          <form onSubmit={handleVerifyNewDevice} className="space-y-4 text-left">
            {/* Phone Number Input */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] font-black uppercase tracking-widest text-gray-400">
                Registered Phone Number
              </label>
              <input
                type="tel"
                required
                value={verPhone}
                onChange={(e) => setVerPhone(e.target.value)}
                placeholder="080XXXXXXXX"
                className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm font-mono"
              />
            </div>

            {/* Dynamic Identity Verification (Last 4 of BVN vs Email address) */}
            <div className="space-y-1.5">
              <label className="text-[9.5px] font-black uppercase tracking-widest text-gray-400">
                {hasBvn ? "Last 4 Digits of your BVN" : "Registered Email Address"}
              </label>
              <input
                type={hasBvn ? "password" : "email"}
                maxLength={hasBvn ? 4 : undefined}
                required
                value={verBvnOrEmail}
                onChange={(e) => setVerBvnOrEmail(e.target.value)}
                placeholder={hasBvn ? "•••• (Last 4)" : "doe@example.com"}
                className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm font-mono"
              />
            </div>

            {verError && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-2xl text-[10px] text-red-600 font-bold leading-relaxed text-center">
                {verError}
              </div>
            )}

            {/* Verify button positioned directly below inputs */}
            <button
              type="submit"
              disabled={verifyingDevice || !verPhone || !verBvnOrEmail}
              className="w-full py-4 bg-[#FC7A00] hover:brightness-105 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 shadow-md disabled:opacity-50"
            >
              {verifyingDevice ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Authorizing Device...</span>
                </>
              ) : (
                "Verify & Authorize Device"
              )}
            </button>
          </form>

          {/* Fallback exit button */}
          <div className="border-t border-gray-150 pt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSignOutFromBlockedDevice}
              className="text-[10px] font-black text-gray-400 uppercase tracking-wider hover:text-black py-1 cursor-pointer transition-colors"
            >
              Sign Out from Account
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel";

  if (!user && !isPublicRoute && !isMockRoute) return null;
  if (pathname === "/cpanel") return <>{children}</>;
  if (user && !(userData?.pin || userData?.pinHash) && pathname !== "/auth/pin-setup") return null;
  const isPinRequired = userData?.isPinRequired !== false;
  if (user && (userData?.pin || userData?.pinHash) && isPinRequired && !isPinVerified && pathname !== "/auth/pin") return null;

  return <>{children}</>;
}
