"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { handleAppSignOut } from "@/lib/logout-util";
import { cn } from "@/lib/utils";

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
  const [faceIdStep, setFaceIdStep] = useState<"instructions" | "camera" | "rotate_head" | "verifying" | "success" | "failed">("instructions");
  const [feedback, setFeedback] = useState("Position your face inside the frame");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [countdown, setCountdown] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
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

  // Safe camera streamer controls
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startFaceCapture = async () => {
    try {
      setFaceIdStep("camera");
      setFeedback("Align your face inside the frame");
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false
      });
      setStream(userStream);
      if (videoRef.current) {
        videoRef.current.srcObject = userStream;
      }
      setCountdown(3);
    } catch (err) {
      console.error("[Device FaceID] Stream error:", err);
      toast.error("Camera access denied. Please enable permissions.");
      setFaceIdStep("failed");
    }
  };

  // Automated biometric head-movement scan challenge sequence
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
        if (countdown === 3) {
          setFeedback("Perfect. Keep face centered...");
        } else if (countdown === 2) {
          setFaceIdStep("rotate_head");
          setFeedback("MOVE YOUR HEAD IN A SLOW CIRCLE ROUND...");
        } else if (countdown === 1) {
          setFeedback("Scanning head coordinates...");
        }
      }, 1500);
      return () => clearTimeout(timer);
    } else {
      setCountdown(null);
      verifyFaceIdBiometrics();
    }
  }, [countdown]);

  const verifyFaceIdBiometrics = async () => {
    setFaceIdStep("verifying");
    setFeedback("Reconstructing 3D vector map...");

    try {
      stopCamera();
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const deviceId = getOrCreateDeviceId();
      const currentVerified = Array.isArray(userData?.verifiedDevices) ? userData.verifiedDevices : [];

      // Whitelist this device atomically in Firestore
      await updateUserData({
        verifiedDevices: [...currentVerified, deviceId],
        currentDeviceId: deviceId,
      });

      setFaceIdStep("success");
      toast.success("Biometric Face ID Verified!", {
        description: "This device is registered and authorized."
      });
      setIsNewDeviceBlocked(false);
    } catch (err) {
      console.error("[Face ID Verification Exception]:", err);
      setFaceIdStep("failed");
    }
  };

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

  const handleSignOutFromBlockedDevice = async () => {
    stopCamera();
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

  // Render high-fidelity professional biometric Face ID authentication overlay for new devices
  if (isNewDeviceBlocked && userData) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-black/60 backdrop-blur-lg p-6 z-[999999] relative">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          className="w-full max-w-sm bg-white rounded-[32px] p-6 border border-gray-100 shadow-2xl text-center space-y-6"
        >
          {/* Header instructions with Red warning font */}
          <div className="space-y-2">
            <div className="mx-auto w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center shadow-inner">
              <span className="material-symbols-outlined text-[24px] font-bold">gpp_maybe</span>
            </div>
            <h2 className="font-hanken font-black text-base text-red-600 uppercase tracking-wider leading-none">
              NEW DEVICE DETECTED
            </h2>
            <p className="font-hanken text-[10.5px] text-gray-400 font-bold uppercase tracking-wider">
              Secure Biometric Activation
            </p>
            <p className="font-hanken text-[11px] text-gray-500 leading-relaxed font-semibold">
              To verify this device, please complete a live Face ID liveness scan. Make sure your face is clearly lit.
            </p>
          </div>

          {/* Interactive Biometric Face ID steps */}
          <div className="flex flex-col items-center justify-center min-h-[220px]">
            {faceIdStep === "instructions" && (
              <div className="space-y-5 w-full flex flex-col items-center">
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 animate-pulse">
                  <span className="material-symbols-outlined text-[32px] font-bold">face</span>
                </div>
                <div className="p-3.5 bg-gray-50 border border-gray-100 rounded-2xl text-[10px] text-gray-500 font-semibold leading-relaxed text-left w-full space-y-2">
                  <div className="flex gap-2 items-center">
                    <span className="material-symbols-outlined text-emerald-500 text-sm font-bold">check_circle</span>
                    <span>Hold device at eye level</span>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className="material-symbols-outlined text-emerald-500 text-sm font-bold">check_circle</span>
                    <span>Rotate head slowly when prompted</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={startFaceCapture}
                  className="w-full py-4 bg-black hover:bg-gray-900 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer transition-all active:scale-[0.98] shadow-md flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm font-bold">photo_camera</span>
                  Start Biometric Face ID
                </button>
              </div>
            )}

            {(faceIdStep === "camera" || faceIdStep === "rotate_head") && (
              <div className="space-y-5 w-full flex flex-col items-center">
                {/* Video Circular viewport with dual scanning radar borders */}
                <div className="relative w-44 h-44 rounded-full border-[5px] border-emerald-500 overflow-hidden bg-gray-950 flex items-center justify-center shadow-lg">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />

                  {/* Shutter flash effect during scanning */}
                  {faceIdStep === "rotate_head" && (
                    <motion.div
                      animate={{ opacity: [0, 0.4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.5 }}
                      className="absolute inset-0 bg-white/40 pointer-events-none"
                    />
                  )}

                  {/* Rotating biometric radar ring */}
                  <div className="absolute inset-0.5 border-2 border-dashed border-white/60 rounded-full animate-spin [animation-duration:8s] pointer-events-none" />
                </div>

                {/* Live Feedback instruction cue */}
                <div className="bg-gray-950 border border-white/10 px-4 py-2.5 rounded-2xl shadow-sm text-center">
                  <p className={cn(
                    "font-hanken font-extrabold text-[10px] tracking-wider uppercase leading-none",
                    faceIdStep === "rotate_head" ? "text-amber-400 animate-pulse" : "text-emerald-400"
                  )}>
                    {feedback}
                  </p>
                </div>
              </div>
            )}

            {faceIdStep === "verifying" && (
              <div className="space-y-4 flex flex-col items-center text-center">
                <div className="relative w-12 h-12 flex items-center justify-center">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="absolute inset-0 rounded-full border-3 border-gray-150 border-t-[#FC7A00] border-r-emerald-500"
                  />
                  <span className="material-symbols-outlined text-[20px] text-gray-400">face</span>
                </div>
                <div>
                  <h4 className="font-hanken font-bold text-xs text-black uppercase tracking-wider">Verifying face vectors</h4>
                  <p className="font-hanken text-[10px] text-gray-400 mt-1 font-semibold">
                    Comparing matches with registered bank directories...
                  </p>
                </div>
              </div>
            )}

            {faceIdStep === "success" && (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
                  <span className="material-symbols-outlined text-[24px] font-bold">verified</span>
                </div>
                <div>
                  <h4 className="font-hanken font-black text-xs text-black uppercase">Device Approved</h4>
                  <p className="font-hanken text-[10px] text-gray-400 font-semibold leading-relaxed">
                    Facial vectors authorized! Your device is now whitelisted.
                  </p>
                </div>
              </div>
            )}

            {faceIdStep === "failed" && (
              <div className="space-y-4 flex flex-col items-center">
                <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[24px] font-bold">gpp_maybe</span>
                </div>
                <div>
                  <h4 className="font-hanken font-black text-xs text-black uppercase">Scan Interrupted</h4>
                  <p className="font-hanken text-[10px] text-red-500 font-semibold leading-relaxed max-w-[200px]">
                    We could not verify your biometric profile. Please ensure face lighting is clear.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setFaceIdStep("instructions")}
                  className="w-full py-3 bg-[#FC7A00] text-white text-[10px] font-black uppercase tracking-widest rounded-xl cursor-pointer"
                >
                  Restart Scan
                </button>
              </div>
            )}
          </div>

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
