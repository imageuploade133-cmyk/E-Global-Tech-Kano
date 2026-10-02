"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { triggerHaptic } from "@/lib/haptics";

interface SecuritySettingsSectionProps {
  isPinRequired: boolean;
  isFaceIdEnabled: boolean;
  is2faOtpEnabled: boolean;
  onTogglePinRequired: () => Promise<void>;
  onToggleFaceId: () => Promise<void>;
  onToggle2faOtp: (pin: string, otpCode?: string) => Promise<{ success: boolean; requiresOtp?: boolean; maskedEmail?: string; maskedPhone?: string }>;
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

  // Modal Flow Stage: 1 = PIN verification, 2 = Channel selection & OTP input
  const [modalStage, setModalStage] = useState<1 | 2>(1);
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);

  // Stage 1: 4-Digit Access PIN Pad
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [verifiedPin, setVerifiedPin] = useState<string>("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Stage 2: OTP Verification
  const [otpChannel, setOtpChannel] = useState<"email" | "whatsapp">("email");
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState<string>("");
  const [maskedPhone, setMaskedPhone] = useState<string>("");

  useModalBackHandler(isPinModalOpen, () => handleCloseModal(), "2fa-otp-pin-modal");

  const handleCloseModal = () => {
    setIsPinModalOpen(false);
    setModalStage(1);
    setPinDigits(["", "", "", ""]);
    setVerifiedPin("");
    setOtpDigits(["", "", "", "", "", ""]);
  };

  const handleInitiate2faToggle = () => {
    triggerHaptic();
    setModalStage(1);
    setPinDigits(["", "", "", ""]);
    setVerifiedPin("");
    setOtpDigits(["", "", "", "", "", ""]);
    setIsPinModalOpen(true);
  };

  // PIN Pad Logic
  const handlePinDigitPress = (digit: string) => {
    triggerHaptic();
    const emptyIdx = pinDigits.findIndex((d) => d === "");
    if (emptyIdx !== -1) {
      const updated = [...pinDigits];
      updated[emptyIdx] = digit;
      setPinDigits(updated);

      if (emptyIdx === 3) {
        const fullPin = updated.join("");
        executeVerified2faToggleStage1(fullPin);
      }
    }
  };

  const handlePinBackspace = () => {
    triggerHaptic();
    const lastFilledIdx = pinDigits.map((d) => d !== "").lastIndexOf(true);
    if (lastFilledIdx !== -1) {
      const updated = [...pinDigits];
      updated[lastFilledIdx] = "";
      setPinDigits(updated);
    }
  };

  const handlePinClear = () => {
    triggerHaptic();
    setPinDigits(["", "", "", ""]);
  };

  const executeVerified2faToggleStage1 = async (enteredPin: string) => {
    setIsVerifyingPin(true);
    try {
      const res = await onToggle2faOtp(enteredPin);
      if (res.success) {
        if (res.requiresOtp) {
          setVerifiedPin(enteredPin);
          setMaskedEmail(res.maskedEmail || "");
          setMaskedPhone(res.maskedPhone || "");
          setModalStage(2);
        } else {
          handleCloseModal();
        }
      } else {
        setPinDigits(["", "", "", ""]);
      }
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Send OTP Code
  const handleResendOtp = async (selectedChannel?: "email" | "whatsapp") => {
    const ch = selectedChannel || otpChannel;
    setIsSendingOtp(true);
    try {
      let idToken = "";
      if (user) idToken = await user.getIdToken();

      const res = await fetch("/api/auth/login-2fa-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "send", channel: ch }),
      });

      const data = await res.json();
      if (res.ok) {
        if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
        if (data.maskedPhone) setMaskedPhone(data.maskedPhone);
        toast.success(`OTP sent via ${ch === "whatsapp" ? "WhatsApp" : "Email"}! 📩`);
      } else {
        toast.error(data.error || "Failed to send OTP code.");
      }
    } catch {
      toast.error("Failed to dispatch OTP code.");
    } finally {
      setIsSendingOtp(false);
    }
  };

  // OTP Box Inputs
  const handleOtpDigitPress = (digit: string) => {
    triggerHaptic();
    const emptyIdx = otpDigits.findIndex((d) => d === "");
    if (emptyIdx !== -1) {
      const updated = [...otpDigits];
      updated[emptyIdx] = digit;
      setOtpDigits(updated);

      if (emptyIdx === 5) {
        const fullOtp = updated.join("");
        executeVerifyOtpStage2(fullOtp);
      }
    }
  };

  const handleOtpBackspace = () => {
    triggerHaptic();
    const lastFilledIdx = otpDigits.map((d) => d !== "").lastIndexOf(true);
    if (lastFilledIdx !== -1) {
      const updated = [...otpDigits];
      updated[lastFilledIdx] = "";
      setOtpDigits(updated);
    }
  };

  const handleOtpClear = () => {
    triggerHaptic();
    setOtpDigits(["", "", "", "", "", ""]);
  };

  const executeVerifyOtpStage2 = async (submittedOtp: string) => {
    setIsVerifyingOtp(true);
    try {
      const res = await onToggle2faOtp(verifiedPin, submittedOtp);
      if (res.success) {
        handleCloseModal();
      } else {
        setOtpDigits(["", "", "", "", "", ""]);
      }
    } finally {
      setIsVerifyingOtp(false);
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

      {/* 2FA Verification Drawer Modal (Stage 1 & Stage 2) */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {isPinModalOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={handleCloseModal}
                className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99998]"
              />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[28px] border-t border-gray-200 p-6 pb-8 z-[100000] flex flex-col items-center shadow-2xl text-black font-hanken select-none max-h-[92vh] overflow-y-auto no-scrollbar"
              >
                {/* Drag bar indicator */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mb-4 shrink-0" />

                {/* Header */}
                <div className="w-full flex items-center justify-between border-b border-gray-100 pb-3 mb-4 shrink-0">
                  <div className="w-8" />
                  <h2 className="font-hanken font-bold text-sm sm:text-base text-black text-center uppercase tracking-wider">
                    {modalStage === 1 ? "Confirm 2FA Security" : "Verify 2FA OTP Code"}
                  </h2>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer active:scale-95"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                {modalStage === 1 ? (
                  /* ========================================================= */
                  /* STAGE 1: 4-DIGIT ACCESS PIN VERIFICATION                 */
                  /* ========================================================= */
                  <>
                    <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 text-[#FC7A00] flex items-center justify-center mb-3 shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[28px]">shield_person</span>
                    </div>

                    <div className="text-center space-y-1 mb-4">
                      <h4 className="font-extrabold text-sm uppercase text-gray-900">Enter Access PIN</h4>
                      <p className="text-[11px] text-gray-500 max-w-xs font-semibold leading-relaxed">
                        Enter your 4-digit Access PIN to {is2faOtpEnabled ? "disable" : "enable"} 2FA Login OTP verification.
                      </p>
                    </div>

                    {/* 4 Pin Boxes */}
                    <div className="flex justify-center gap-3 mb-5">
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

                    {/* Numeric Keypad Grid */}
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4">
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
                      onClick={handleCloseModal}
                      className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-2xl cursor-pointer active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  /* ========================================================= */
                  /* STAGE 2: 2FA OTP CHANNEL SELECTOR & 6-DIGIT CODE INPUT    */
                  /* ========================================================= */
                  <>
                    <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 text-[#FC7A00] flex items-center justify-center mb-3 shadow-xs shrink-0">
                      <span className="material-symbols-outlined text-[28px]">mark_email_read</span>
                    </div>

                    <div className="text-center space-y-1 mb-4">
                      <h4 className="font-extrabold text-sm uppercase text-gray-900">Enter Security OTP Code</h4>
                      <p className="text-[11px] text-gray-500 max-w-xs font-semibold leading-relaxed">
                        Enter the 6-digit OTP code sent to your {otpChannel === "whatsapp" ? `WhatsApp (${maskedPhone || "registered phone"})` : `Email (${maskedEmail || "registered email"})`} to finalize 2FA enabling.
                      </p>
                    </div>

                    {/* Channel Selector Pills */}
                    <div className="flex gap-2 p-1 bg-gray-100 rounded-2xl w-full max-w-xs mb-4">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpChannel("email");
                          handleResendOtp("email");
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          otpChannel === "email" ? "bg-white text-[#FC7A00] shadow-xs" : "text-gray-500 hover:text-black"
                        )}
                      >
                        <span className="material-symbols-outlined text-[16px]">mail</span>
                        Email
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setOtpChannel("whatsapp");
                          handleResendOtp("whatsapp");
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer",
                          otpChannel === "whatsapp" ? "bg-white text-[#FC7A00] shadow-xs" : "text-gray-500 hover:text-black"
                        )}
                      >
                        <span className="material-symbols-outlined text-[16px]">chat</span>
                        WhatsApp
                      </button>
                    </div>

                    {/* 6 OTP Boxes */}
                    <div className="flex justify-center gap-1.5 sm:gap-2 mb-4">
                      {[0, 1, 2, 3, 4, 5].map((idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "w-10 h-12 sm:w-11 sm:h-12 rounded-xl border-2 flex items-center justify-center font-mono font-black text-xl transition-all shadow-xs",
                            otpDigits[idx] ? "border-[#FC7A00] bg-orange-50/20 text-[#FC7A00]" : "border-gray-200 text-gray-400 bg-gray-50"
                          )}
                        >
                          {otpDigits[idx] || ""}
                        </div>
                      ))}
                    </div>

                    {/* Resend button */}
                    <div className="text-center mb-4">
                      <button
                        type="button"
                        disabled={isSendingOtp}
                        onClick={() => handleResendOtp()}
                        className="text-[11px] font-bold text-[#FC7A00] hover:underline disabled:opacity-50 cursor-pointer"
                      >
                        {isSendingOtp ? "Sending OTP Code..." : "Didn't receive code? Resend OTP"}
                      </button>
                    </div>

                    {/* Numeric Keypad Grid */}
                    <div className="grid grid-cols-3 gap-2 w-full max-w-xs mb-4">
                      {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={isVerifyingOtp}
                          onClick={() => handleOtpDigitPress(num)}
                          className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                        >
                          {num}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={isVerifyingOtp}
                        onClick={handleOtpClear}
                        className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-xs uppercase text-gray-600 active:scale-95 transition-all cursor-pointer"
                      >
                        CLEAR
                      </button>
                      <button
                        type="button"
                        disabled={isVerifyingOtp}
                        onClick={() => handleOtpDigitPress("0")}
                        className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                      >
                        0
                      </button>
                      <button
                        type="button"
                        disabled={isVerifyingOtp}
                        onClick={handleOtpBackspace}
                        className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                      >
                        <span className="material-symbols-outlined text-[20px]">backspace</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-2xl cursor-pointer active:scale-95 transition-all"
                    >
                      Cancel
                    </button>
                  </>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </section>
  );
}
