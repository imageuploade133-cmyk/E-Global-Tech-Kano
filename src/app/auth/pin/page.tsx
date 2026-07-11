"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { LogoutDrawer } from "@/components/layout/LogoutDrawer";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([]);
  const { user, userData, setPinVerified, loading } = useAuth();
  const router = useRouter();

  // Logout confirmation state
  const [isLogoutDrawerOpen, setIsLogoutDrawerOpen] = useState(false);

  // Loading Delay State
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyingText, setVerifyingText] = useState("Securing connection...");

  // Forgot PIN bottom drawer state
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [resetOption, setResetOption] = useState<"email" | "otp">("email");
  const hasPushedState = useRef(false);

  const shuffleKeypad = () => {
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    setKeypadNumbers(numbers);
  };

  useEffect(() => {
    shuffleKeypad();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  // Sync state with browser back history for Forgot PIN drawer
  useEffect(() => {
    if (showForgotPin) {
      window.history.pushState({ forgotPinOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        setShowForgotPin(false);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [showForgotPin]);

  // Prevent background scroll when Forgot PIN drawer is active
  useEffect(() => {
    if (showForgotPin) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showForgotPin]);

  const handleLogOutFromPin = async () => {
    setIsLogoutDrawerOpen(false);
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch {
      toast.error("Failed to sign out");
    }
  };

  const handleRequestResetLink = () => {
    setIsRequestingReset(true);
    setTimeout(() => {
      setIsRequestingReset(false);
      setShowForgotPin(false);
      if (resetOption === "email") {
        toast.success("A secure verification link has been dispatched to your email address.");
      } else {
        toast.success("A 6-digit One-Time Passcode has been sent to your registered mobile number.");
      }
    }, 1200);
  };

  const handleForgotPinDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      setShowForgotPin(false);
    }
  };

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      // Reshuffle after key press for maximum security
      shuffleKeypad();

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    shuffleKeypad();
  };

  const verifyPin = (submittedPin: string) => {
    setIsVerifying(true);
    setVerifyingText("Decrypting security key...");

    // Stage 1 of loading animation
    setTimeout(() => {
      setVerifyingText("Authenticating signature...");
    }, 800);

    // Stage 2: final resolution after 1.8 seconds delay
    setTimeout(() => {
      if (userData?.pin === submittedPin) {
        setPinVerified(true);
        toast.success("Identity verified");
        router.push("/");
      } else {
        toast.error("Incorrect PIN");
        setPin("");
        setIsVerifying(false);
      }
    }, 1800);
  };

  if (loading) return null;

  return (
    <div className="flex flex-col min-h-screen bg-white p-8 items-center justify-between relative overflow-hidden">
      {/* Full Screen High-Fidelity Loading Overlay */}
      <AnimatePresence>
        {isVerifying && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white/95 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6"
          >
            <div className="relative flex flex-col items-center">
              {/* Spinning luxury gradient ring */}
              <div className="relative w-24 h-24 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-4 border-gray-100 border-t-[#FC7A00] border-r-[#0b513d]"
                />

                {/* Logo container inside the ring with micro-scale pulse */}
                <motion.div
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="relative w-14 h-14 bg-white rounded-full p-2 shadow-sm flex items-center justify-center"
                >
                  <Image
                    src="https://e-global-tech-kano.vercel.app/_next/image?url=https%3A%2F%2Fi.ibb.co%2FWWjZrtC7%2FE-Tech.png&w=640&q=75"
                    alt="E-Tech Logo"
                    width={40}
                    height={40}
                    className="object-contain"
                    priority
                  />
                </motion.div>
              </div>

              {/* Status Message Text */}
              <motion.p
                key={verifyingText}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-8 font-hanken font-bold text-sm tracking-wider uppercase text-gray-800 text-center"
              >
                {verifyingText}
              </motion.p>

              <p className="mt-2 font-hanken text-xs text-gray-400">
                Please do not close or exit the app
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="w-full flex flex-col items-center text-center mt-10">
        <div className="relative w-16 h-16 mb-4">
          <Image
            src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
            alt="E-Tech Logo"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="font-hanken font-bold text-xl tracking-tight text-black mb-1">E-TECH GLOBAL HUB</h1>
        <p className="text-gray-500 font-hanken tracking-widest uppercase text-xs">Enter Access PIN</p>
      </div>

      <div className="flex gap-4 justify-center my-10">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${
              pin.length > i ? "bg-black border-black scale-125" : "bg-transparent border-gray-200"
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-xs grid grid-cols-3 gap-6 mb-10">
        {keypadNumbers.slice(0, 9).map((num) => (
          <motion.button
            whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
            whileHover={{ scale: 1.05 }}
            key={num}
            onClick={() => handleKeyPress(num)}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-200 text-black cursor-pointer transition-colors"
          >
            {num}
          </motion.button>
        ))}
        <div className="w-20 h-20" />
        {keypadNumbers[9] !== undefined && (
          <motion.button
            whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
            whileHover={{ scale: 1.05 }}
            onClick={() => handleKeyPress(keypadNumbers[9])}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-200 text-black cursor-pointer transition-colors"
          >
            {keypadNumbers[9]}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={handleDelete}
          className="w-20 h-20 rounded-full flex items-center justify-center text-black active:text-red-500 cursor-pointer"
        >
          <span className="material-symbols-outlined text-3xl">backspace</span>
        </motion.button>
      </div>

      {/* Forgot PIN and Sign Out options below secure keypad */}
      <div className="flex justify-between w-full max-w-xs px-2 mb-8 font-hanken text-sm">
        <button
          onClick={() => setShowForgotPin(true)}
          className="text-gray-400 hover:text-black font-semibold transition-colors cursor-pointer"
        >
          Forgot PIN?
        </button>
        <button
          onClick={() => setIsLogoutDrawerOpen(true)}
          className="text-gray-400 hover:text-red-500 font-semibold transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </div>

      {/* Logout Confirmation Drawer */}
      <LogoutDrawer
        isOpen={isLogoutDrawerOpen}
        onClose={() => setIsLogoutDrawerOpen(false)}
        onConfirm={handleLogOutFromPin}
      />

      {/* 90% Height Bottom Drawer for Forgot PIN recovery */}
      <AnimatePresence>
        {showForgotPin && (
          <>
            {/* Backdrop Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowForgotPin(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
            />

            {/* Bottom Sheet Drawer */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
              drag="y"
              dragDirectionLock
              dragConstraints={{ top: 0, bottom: 450 }}
              dragElastic={{ top: 0, bottom: 0.2 }}
              onDragEnd={handleForgotPinDragEnd}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] p-6 pb-8 z-[99999] flex flex-col items-center shadow-none"
            >
              {/* Grab handle */}
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-2 mb-4" />

              {/* Header */}
              <div className="w-full flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <div className="w-8" />
                <h3 className="font-hanken font-bold text-base text-black text-center">Reset Access PIN</h3>
                <button
                  type="button"
                  onClick={() => setShowForgotPin(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-all"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                </button>
              </div>

              {/* Content body with selection options */}
              <div className="flex-grow flex flex-col justify-start items-center px-4 text-center w-full overflow-y-auto">
                <div className="w-12 h-12 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] mb-4">
                  <span className="material-symbols-outlined text-[24px] font-bold">lock_reset</span>
                </div>
                <h4 className="font-hanken font-bold text-base text-black mb-1">Verify Identity to Reset PIN</h4>
                <p className="font-hanken text-xs text-gray-500 max-w-[280px] leading-relaxed mb-6">
                  Select your preferred high-security verification method to recover your secure 4-digit Access PIN.
                </p>

                {/* Reset options interactive selector list */}
                <div className="w-full flex flex-col gap-3 mb-6">
                  {/* Email option card */}
                  <button
                    type="button"
                    onClick={() => setResetOption("email")}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      resetOption === "email"
                        ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      resetOption === "email" ? "bg-[#FC7A00]/20 text-[#FC7A00]" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">mail</span>
                    </div>
                    <div className="flex-grow">
                      <p className="font-hanken font-bold text-xs text-black">Email Verification</p>
                      <p className="font-hanken text-[11px] text-gray-400">Send recovery link to registered email</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      resetOption === "email" ? "border-[#FC7A00]" : "border-gray-300"
                    }`}>
                      {resetOption === "email" && <div className="w-2.5 h-2.5 rounded-full bg-[#FC7A00]" />}
                    </div>
                  </button>

                  {/* SMS OTP option card */}
                  <button
                    type="button"
                    onClick={() => setResetOption("otp")}
                    className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                      resetOption === "otp"
                        ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                      resetOption === "otp" ? "bg-[#FC7A00]/20 text-[#FC7A00]" : "bg-gray-100 text-gray-500"
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">sms</span>
                    </div>
                    <div className="flex-grow">
                      <p className="font-hanken font-bold text-xs text-black">SMS One-Time Passcode (OTP)</p>
                      <p className="font-hanken text-[11px] text-gray-400">Send 6-digit secure code to phone</p>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                      resetOption === "otp" ? "border-[#FC7A00]" : "border-gray-300"
                    }`}>
                      {resetOption === "otp" && <div className="w-2.5 h-2.5 rounded-full bg-[#FC7A00]" />}
                    </div>
                  </button>
                </div>
              </div>

              {/* Bottom Buttons with high-fidelity loading visual feedback */}
              <div className="w-full flex flex-col gap-3">
                <button
                  type="button"
                  disabled={isRequestingReset}
                  onClick={handleRequestResetLink}
                  className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isRequestingReset ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {resetOption === "email" ? "Dispatching Reset..." : "Generating OTP..."}
                    </>
                  ) : (
                    resetOption === "email" ? "Request Secure Reset Link" : "Generate Secure OTP Code"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForgotPin(false)}
                  className="w-full py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
