"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import { motion, AnimatePresence, PanInfo } from "framer-motion";

import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([]);
  const { user, userData, setPinVerified, loading } = useAuth();
  const router = useRouter();

  // Forgot PIN bottom drawer state
  const [showForgotPin, setShowForgotPin] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
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
      toast.success("A secure verification link has been dispatched to your email address.");
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
    if (userData?.pin === submittedPin) {
      setPinVerified(true);
      toast.success("Identity verified");
      router.push("/");
    } else {
      toast.error("Incorrect PIN");
      setPin("");
    }
  };

  if (loading) return null;

  return (
    <div className="flex flex-col min-h-screen bg-white p-8 items-center justify-between">
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
          onClick={handleLogOutFromPin}
          className="text-gray-400 hover:text-red-500 font-semibold transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </div>

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

              {/* Content body */}
              <div className="flex-grow flex flex-col justify-center items-center px-6 text-center">
                <div className="w-16 h-16 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] mb-6">
                  <span className="material-symbols-outlined text-[32px] font-bold">lock_reset</span>
                </div>
                <h4 className="font-hanken font-bold text-lg text-black mb-2">Secure Verification Needed</h4>
                <p className="font-hanken text-sm text-gray-500 max-w-[280px] leading-relaxed">
                  For top-tier asset security, PIN retrieval is linked directly to your authenticated email. Click below to receive a secure OTP reset connection link.
                </p>
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
                      Dispatching Reset...
                    </>
                  ) : (
                    "Request Secure Reset Link"
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
