"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface SecuritySettingsSectionProps {
  isPinRequired: boolean;
  isFaceIdEnabled: boolean;
  is2faOtpEnabled: boolean;
  onTogglePinRequired: () => Promise<void>;
  onToggleFaceId: () => Promise<void>;
  onToggle2faOtp: (pin: string) => Promise<boolean>;
}

export function SecuritySettingsSection({
  isPinRequired,
  isFaceIdEnabled,
  is2faOtpEnabled,
  onTogglePinRequired,
  onToggleFaceId,
  onToggle2faOtp,
}: SecuritySettingsSectionProps) {
  const { user } = useAuth();

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // 4-Digit PIN Verification Pad Modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  useModalBackHandler(isPinModalOpen, () => setIsPinModalOpen(false), "2fa-otp-pin-modal");

  const handleInitiate2faToggle = () => {
    setPinDigits(["", "", "", ""]);
    setIsPinModalOpen(true);
  };

  const handlePinDigitPress = (digit: string) => {
    const emptyIdx = pinDigits.findIndex((d) => d === "");
    if (emptyIdx !== -1) {
      const updated = [...pinDigits];
      updated[emptyIdx] = digit;
      setPinDigits(updated);

      if (emptyIdx === 3) {
        const fullPin = updated.join("");
        executeVerified2faToggle(fullPin);
      }
    }
  };

  const handlePinBackspace = () => {
    const lastFilledIdx = pinDigits.map((d) => d !== "").lastIndexOf(true);
    if (lastFilledIdx !== -1) {
      const updated = [...pinDigits];
      updated[lastFilledIdx] = "";
      setPinDigits(updated);
    }
  };

  const handlePinClear = () => {
    setPinDigits(["", "", "", ""]);
  };

  const executeVerified2faToggle = async (enteredPin: string) => {
    setIsVerifyingPin(true);
    try {
      const success = await onToggle2faOtp(enteredPin);
      if (success) {
        setIsPinModalOpen(false);
      } else {
        setPinDigits(["", "", "", ""]);
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  return (
    <section className="premium-gradient-card premium-gradient-border p-6 space-y-4 font-hanken">
      <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
        Security Preferences & 2FA
      </h3>

      {/* Toggle PIN */}
      <div className="flex justify-between items-center py-2">
        <div>
          <p className="font-hanken font-bold text-xs text-black">Require Access PIN</p>
          <p className="font-hanken text-[10px] text-gray-400 font-semibold">Enforce PIN check on login/payment flows</p>
        </div>
        <button
          onClick={onTogglePinRequired}
          className={cn(
            "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
            isPinRequired ? "bg-[#07B038]" : "bg-gray-200"
          )}
        >
          <motion.div
            layout
            className="w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: isPinRequired ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Toggle 2FA Login OTP Code Requirement */}
      <div className="flex justify-between items-center py-2 border-t border-gray-100/60">
        <div>
          <div className="flex items-center gap-1.5">
            <p className="font-hanken font-bold text-xs text-black">2FA Login OTP Code</p>
            <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-orange-100 text-[#FC7A00]">
              2FA Security
            </span>
          </div>
          <p className="font-hanken text-[10px] text-gray-400 font-semibold mt-0.5">
            Require 6-digit OTP code after entering Access PIN on login
          </p>
        </div>
        <button
          onClick={handleInitiate2faToggle}
          className={cn(
            "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer shrink-0 ml-3",
            is2faOtpEnabled ? "bg-[#07B038]" : "bg-gray-200"
          )}
        >
          <motion.div
            layout
            className="w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: is2faOtpEnabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Toggle FaceID */}
      <div className="flex justify-between items-center py-2 border-t border-gray-100/60">
        <div>
          <p className="font-hanken font-bold text-xs text-black">Simulate FaceID Biometrics</p>
          <p className="font-hanken text-[10px] text-gray-400 font-semibold">Quick authentication via FaceID simulations</p>
        </div>
        <button
          onClick={onToggleFaceId}
          className={cn(
            "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer shrink-0 ml-3",
            isFaceIdEnabled ? "bg-[#07B038]" : "bg-gray-200"
          )}
        >
          <motion.div
            layout
            className="w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: isFaceIdEnabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* 4-Digit Access PIN Verification Modal */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isPinModalOpen && (
            <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full max-w-xs bg-white rounded-3xl p-6 text-center shadow-2xl space-y-5 border border-gray-100 font-hanken text-black"
              >
                <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-100 text-[#FC7A00] flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[24px]">security</span>
                </div>

                <div>
                  <h4 className="font-extrabold text-base uppercase text-gray-900">Confirm Access PIN</h4>
                  <p className="text-[11px] text-gray-500 mt-1 font-semibold">
                    Enter your 4-digit PIN to {is2faOtpEnabled ? "disable" : "enable"} 2FA Login OTP verification.
                  </p>
                </div>

                {/* 4 Pin Boxes */}
                <div className="flex justify-center gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => (
                    <div
                      key={idx}
                      className={cn(
                        "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all shadow-xs",
                        pinDigits[idx] ? "border-[#FC7A00] bg-orange-50/20 text-[#FC7A00]" : "border-gray-200 text-gray-400 bg-gray-50"
                      )}
                    >
                      {pinDigits[idx] ? "•" : ""}
                    </div>
                  ))}
                </div>

                {/* Keypad */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      disabled={isVerifyingPin}
                      onClick={() => handlePinDigitPress(num)}
                      className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    disabled={isVerifyingPin}
                    onClick={handlePinClear}
                    className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-xs uppercase text-gray-600 active:scale-95 transition-all cursor-pointer"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    disabled={isVerifyingPin}
                    onClick={() => handlePinDigitPress("0")}
                    className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    disabled={isVerifyingPin}
                    onClick={handlePinBackspace}
                    className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">backspace</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-2xl cursor-pointer"
                >
                  Cancel
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}
