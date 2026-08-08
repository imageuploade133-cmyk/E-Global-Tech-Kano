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

  // New Device verification states
  const [isNewDeviceBlocked, setIsNewDeviceBlocked] = useState(false);
  const [verPhone, setVerPhone] = useState("");
  const [verBvnOrNinOrEmail, setVerBvnOrNinOrEmail] = useState("");
  const [verError, setVerError] = useState("");
  const [verifyingDevice, setVerifyingDevice] = useState(false);

  const initializingDeviceRef = useRef(false);

  // Single-device session listener & verification guard
  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (loading || isMock || !user || !userData) return;

    // 1. STRICTLY BYPASS session/device guards on public, login, signup, PIN, or PIN setup views
    const isPublicOrAuthRoute =
      pathname === "/auth/login" ||
      pathname === "/auth/signup" ||
      pathname === "/auth/pin" ||
      pathname === "/auth/pin-setup" ||
      pathname === "/cpanel";

    if (isPublicOrAuthRoute) {
      setIsNewDeviceBlocked(false);
      return;
    }

    // 2. STRICTLY enforce device session checking ONLY when the user is logged in AND they have verified their PIN
    const isPinRequired = userData?.isPinRequired !== false;
    if (isPinRequired && !isPinVerified) {
      setIsNewDeviceBlocked(false);
      return;
    }

    const deviceId = getOrCreateDeviceId();
    const verifiedList = Array.isArray(userData.verifiedDevices) ? userData.verifiedDevices : [];

    // 3. First-time registration of deviceId: Whitelist the first device used to register/login
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

    // 4. Check if the current device is whitelisted
    const isCurrentDeviceVerified = userData.registeredDeviceId === deviceId || verifiedList.includes(deviceId);
    if (isCurrentDeviceVerified) {
      setIsNewDeviceBlocked(false);

      // Real-time active session validation (Force logout if logged in on another device)
      if (userData.currentDeviceId && userData.currentDeviceId !== deviceId) {
        console.warn("[Device Guard] Active session changed to another device. Terminating this session.");
        toast.error("Session Expired", {
          description: "Your account was logged in on another device. Logging out...",
        });

        localStorage.removeItem("isPinVerified");
        sessionStorage.clear();

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
      // 5. Unrecognized device detected: Block transaction activity with validation overlay
      console.log("[Device Guard] Unrecognized device detected:", deviceId);
      setIsNewDeviceBlocked(true);
    }
  }, [user, loading, userData, isPinVerified, pathname, router, updateUserData]);

  // Detect and verify Flutterwave redirects globally on app startup before any guards or locks activate
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
  }, [user]);

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

  // Verification submission handler for unrecognized devices (BVN/NIN/Email match)
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

      let isBvnOrNinOrEmailMatch = false;
      const bvnValue = (userData.bvn as string || "").trim();
      const ninValue = (userData.nin as string || "").trim();

      if (bvnValue || ninValue) {
        // Match last 4 of BVN or NIN
        const last4Bvn = bvnValue.slice(-4);
        const last4Nin = ninValue.slice(-4);
        const inputTrimmed = verBvnOrNinOrEmail.trim();

        isBvnOrNinOrEmailMatch =
          (!!bvnValue && inputTrimmed === last4Bvn) ||
          (!!ninValue && inputTrimmed === last4Nin);
      } else {
        // Otherwise, compare registered email address case-insensitively
        const registeredEmail = (userData.email as string || "").trim().toLowerCase();
        isBvnOrNinOrEmailMatch = verBvnOrNinOrEmail.trim().toLowerCase() === registeredEmail;
      }

      if (isPhoneMatch && isBvnOrNinOrEmailMatch) {
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
        const hasKyc = bvnValue || ninValue;
        setVerError(
          hasKyc
            ? "Verification failed. The registered phone number or last 4 digits of your BVN/NIN do not match."
            : "Verification failed. The registered phone number or email address do not match."
        );
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

  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (loading && !isMock) return;

    // Allow public/exempt routes (/auth/login, /auth/signup, /cpanel)
    const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel";

    if (!user && !isMock) {
      if (!isPublicRoute) {
        router.push("/auth/login");
      }
    } else if (user) {
      // User is logged in
      const hasPin = Boolean(userData?.pin || userData?.pinHash);
      const isPinRequired = userData?.isPinRequired !== false;

      // Allow /cpanel access even if pin or auth state verification is pending
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
          {/* Sizable app-like compact loading card container */}
          <div className="flex flex-col items-center p-5 rounded-2xl bg-[#fdfdfd]/80 backdrop-blur-md border border-gray-100/50 shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
            {/* Spinning brand gradient ring (Perfect global app-like compact loader) */}
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[2px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />

              {/* Logo container inside the ring with micro-scale pulse */}
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

  // Render high-fidelity professional full-screen BVN/NIN/Email authentication page for new devices
  if (isNewDeviceBlocked && userData) {
    const bvnValue = (userData.bvn as string || "").trim();
    const ninValue = (userData.nin as string || "").trim();
    const hasKyc = !!(bvnValue || ninValue);

    return (
      <div className="flex min-h-screen flex-col bg-white p-8 items-center justify-between z-[999999] fixed inset-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="w-full flex flex-col items-center text-center mt-6 shrink-0">
          <div className="relative w-16 h-16 mb-4">
            <Image
              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
              alt="E-Tech Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-hanken font-bold text-xl tracking-tight text-black mb-1">E-Global Pay</h1>

          <div className="space-y-1 mt-3">
            <h2 className="font-hanken font-black text-sm text-red-600 uppercase tracking-wider leading-none">
              NEW DEVICE DETECTED
            </h2>
            <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-none mt-1">
              Security Verification Required
            </p>
            <p className="font-hanken text-xs text-gray-500 max-w-xs mt-2.5 leading-relaxed font-semibold px-4">
              To secure your wallet and complete transactions, please authorize this device by confirming your registration credentials.
            </p>
          </div>
        </div>

        {/* Dynamic Verification Form */}
        <form onSubmit={handleVerifyNewDevice} className="w-full max-w-xs space-y-4 my-10 flex-grow flex flex-col justify-center text-left">
          {/* Phone Number Input */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
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

          {/* Dynamic Identity Verification (Last 4 of BVN/NIN vs Email address) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">
              {hasKyc ? "Last 4 Digits of your BVN or NIN" : "Registered Email Address"}
            </label>
            <input
              type={hasKyc ? "password" : "email"}
              maxLength={hasKyc ? 4 : undefined}
              required
              value={verBvnOrNinOrEmail}
              onChange={(e) => setVerBvnOrNinOrEmail(e.target.value)}
              placeholder={hasKyc ? "•••• (Last 4)" : "doe@example.com"}
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
            disabled={verifyingDevice || !verPhone || !verBvnOrNinOrEmail}
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

        {/* Fallback exit button with Sign Out in bold RED color at bottom */}
        <div className="w-full text-center border-t border-gray-150 pt-4 pb-4 shrink-0 max-w-xs">
          <button
            type="button"
            onClick={handleSignOutFromBlockedDevice}
            className="text-[11px] font-extrabold text-red-600 uppercase tracking-widest hover:text-red-700 hover:underline py-2.5 cursor-pointer transition-colors"
          >
            Sign Out from Account
          </button>
        </div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/cpanel";

  // Show nothing while redirecting
  if (!user && !isPublicRoute && !isMockRoute) return null;
  if (pathname === "/cpanel") return <>{children}</>;
  if (user && !(userData?.pin || userData?.pinHash) && pathname !== "/auth/pin-setup") return null;
  const isPinRequired = userData?.isPinRequired !== false;
  if (user && (userData?.pin || userData?.pinHash) && isPinRequired && !isPinVerified && pathname !== "/auth/pin") return null;

  return <>{children}</>;
}
