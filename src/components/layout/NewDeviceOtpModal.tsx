"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { toast } from "sonner";

export interface NewDeviceOtpModalProps {
  isOpen: boolean;
  challengeId: string;
  initialChannel: "whatsapp" | "email";
  maskedDestination: string;
  channels: Array<{ type: "whatsapp" | "email"; label: string; masked: string }>;
  onVerifiedSuccess: (sessionId: string) => void;
  onCancel: () => void;
}

export function NewDeviceOtpModal({
  isOpen,
  challengeId,
  initialChannel,
  maskedDestination,
  channels,
  onVerifiedSuccess,
  onCancel,
}: NewDeviceOtpModalProps) {
  const [activeChannel, setActiveChannel] = useState<"whatsapp" | "email">(initialChannel);
  const [activeDestination, setActiveDestination] = useState<string>(maskedDestination);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useModalBackHandler(isOpen, onCancel, "new-device-otp-modal");

  useEffect(() => {
    setActiveChannel(initialChannel);
    setActiveDestination(maskedDestination);
    setOtp(Array(6).fill(""));
    setOtpSent(false);
    setCooldown(0);
  }, [challengeId, initialChannel, maskedDestination]);

  // Cooldown countdown timer
  useEffect(() => {
    if (!isOpen || cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isOpen, cooldown]);

  if (!isOpen) return null;

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const newOtp = [...otp];
    newOtp[index] = digit;
    setOtp(newOtp);

    // Auto-advance to next input cell
    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted) {
      const newOtp = Array(6).fill("");
      for (let i = 0; i < pasted.length; i++) {
        newOtp[i] = pasted[i];
      }
      setOtp(newOtp);
      const targetIdx = Math.min(pasted.length, 5);
      inputRefs.current[targetIdx]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const fullOtp = otp.join("").trim();
    if (fullOtp.length !== 6) {
      toast.error("Please enter the complete 6-digit verification code.");
      return;
    }

    setLoading(true);

    try {
      const { auth } = await import("@/lib/firebase");
      const user = auth.currentUser;
      if (!user) {
        toast.error("User authentication session expired. Please sign in again.");
        onCancel();
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "verify_challenge",
          challengeId,
          otpCode: fullOtp,
          deviceName: typeof window !== "undefined" && (window as any).flutter_inappwebview ? "Mobile Native App" : "Web Browser",
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        toast.error(data.error || "Verification failed. Please check the code and try again.");
        setOtp(Array(6).fill(""));
        inputRefs.current[0]?.focus();
        return;
      }

      toast.success("New device successfully verified!");
      onVerifiedSuccess(data.sessionId);

    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred during verification.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendOrSwitchChannel = async (targetChannel: "whatsapp" | "email") => {
    if (cooldown > 0 && targetChannel === activeChannel && otpSent) {
      toast.info(`Please wait ${cooldown} seconds before requesting a new code.`);
      return;
    }

    setResending(true);

    try {
      const { auth } = await import("@/lib/firebase");
      const user = auth.currentUser;
      if (!user) {
        toast.error("Authentication expired.");
        onCancel();
        return;
      }

      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "resend_challenge",
          challengeId,
          selectedChannel: targetChannel,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        toast.error(data.error || "Failed to send code.");
        return;
      }

      setActiveChannel(data.channel || targetChannel);
      setActiveDestination(data.maskedDestination || maskedDestination);
      setCooldown(data.cooldownSeconds || 60);
      setOtpSent(true);
      setOtp(Array(6).fill(""));
      toast.success(data.message || `Verification code sent via ${targetChannel === "whatsapp" ? "WhatsApp" : "Email"}!`);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);

    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 15 }}
        className="fixed inset-0 z-[200000] w-full h-full bg-white flex flex-col justify-between overflow-y-auto p-4 sm:p-6 text-black"
      >
        <div className="max-w-md w-full mx-auto my-auto flex flex-col items-center text-center py-6">
          {/* Header Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-[#FC7A00]/10 border border-[#FC7A00]/30 flex items-center justify-center text-[#FC7A00] mb-4 shadow-sm">
            <span className="material-symbols-outlined text-3xl font-bold">verified_user</span>
          </div>

          <span className="px-3 py-0.5 rounded-full text-[10px] font-black bg-[#FC7A00]/15 text-[#FC7A00] border border-[#FC7A00]/30 uppercase tracking-widest mb-2">
            Verify It&apos;s You
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight mb-2">
            New Device Login Security
          </h2>

          <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
            A new device is logging into your account. Please select your verification method and click Send Code to receive your 6-digit OTP:
          </p>

          {/* Select Verification Method Cards (Economized & Styled exactly like Forgot PIN) */}
          <div className="w-full flex flex-col gap-3 mb-6">
            {/* Email OTP Option Card */}
            {channels.some(c => c.type === "email") && (
              <button
                type="button"
                onClick={() => {
                  setActiveChannel("email");
                  const ch = channels.find(c => c.type === "email");
                  if (ch) setActiveDestination(ch.masked);
                }}
                className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  activeChannel === "email"
                    ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  activeChannel === "email" ? "bg-[#FC7A00]/20 text-[#FC7A00]" : "bg-gray-100 text-gray-500"
                }`}>
                  <span className="material-symbols-outlined text-[20px]">mail</span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-hanken font-bold text-xs text-black truncate">Email OTP Code</p>
                    <span className="font-mono font-bold text-[10px] text-[#FC7A00] bg-[#FC7A00]/10 px-2 py-0.5 rounded-full shrink-0">
                      {channels.find(c => c.type === "email")?.masked || activeDestination}
                    </span>
                  </div>
                  <p className="font-hanken text-[11px] text-gray-400 mt-0.5">Send 6-digit secure code to registered email</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  activeChannel === "email" ? "border-[#FC7A00]" : "border-gray-300"
                }`}>
                  {activeChannel === "email" && <div className="w-2.5 h-2.5 rounded-full bg-[#FC7A00]" />}
                </div>
              </button>
            )}

            {/* WhatsApp / Phone Number OTP Option Card */}
            {channels.some(c => c.type === "whatsapp") && (
              <button
                type="button"
                onClick={() => {
                  setActiveChannel("whatsapp");
                  const ch = channels.find(c => c.type === "whatsapp");
                  if (ch) setActiveDestination(ch.masked);
                }}
                className={`w-full p-4 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                  activeChannel === "whatsapp"
                    ? "border-[#FC7A00] bg-[#FC7A00]/5 ring-1 ring-[#FC7A00]"
                    : "border-gray-200 bg-white hover:bg-gray-50"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  activeChannel === "whatsapp" ? "bg-[#FC7A00]/20 text-[#FC7A00]" : "bg-gray-100 text-gray-500"
                }`}>
                  <span className="material-symbols-outlined text-[20px]">chat</span>
                </div>
                <div className="flex-grow min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="font-hanken font-bold text-xs text-black truncate">WhatsApp OTP Code</p>
                    <span className="font-mono font-bold text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full shrink-0">
                      {channels.find(c => c.type === "whatsapp")?.masked || activeDestination}
                    </span>
                  </div>
                  <p className="font-hanken text-[11px] text-gray-400 mt-0.5">Send 6-digit secure code on WhatsApp</p>
                </div>
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  activeChannel === "whatsapp" ? "border-[#FC7A00]" : "border-gray-300"
                }`}>
                  {activeChannel === "whatsapp" && <div className="w-2.5 h-2.5 rounded-full bg-[#FC7A00]" />}
                </div>
              </button>
            )}
          </div>

          {/* Send Verification Code Action Box */}
          <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200/80 w-full mb-6 text-left">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-lg">
                  {activeChannel === "whatsapp" ? "smartphone" : "mail"}
                </span>
                <div>
                  <p className="text-[10px] text-gray-400 font-black uppercase tracking-wider">
                    {activeChannel === "whatsapp" ? "Phone Verification" : "Email Verification"}
                  </p>
                  <p className="text-xs font-bold text-black font-mono">{activeDestination}</p>
                </div>
              </div>
              {otpSent && cooldown > 0 && (
                <span className="text-[10px] text-gray-500 font-mono font-bold bg-gray-200/80 px-2.5 py-1 rounded-full">
                  Resend in {cooldown}s
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={resending || (otpSent && cooldown > 0)}
              onClick={() => handleSendOrSwitchChannel(activeChannel)}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-98 text-white font-black text-xs uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-xs"
            >
              {resending ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Dispatching Security Code...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-base">send</span>
                  <span>{otpSent ? "Resend Code" : "Send Verification Code"}</span>
                </>
              )}
            </button>
          </div>

          {/* 6-Digit OTP Input Grid */}
          <div className="space-y-2 w-full mb-6">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 text-left pl-1">
              Enter 6-Digit OTP Code
            </p>
            <div className="flex items-center justify-between gap-1.5 sm:gap-2 w-full">
              {otp.map((digit, idx) => (
                <div key={idx} className="p-[1.5px] rounded-xl bg-gradient-to-r from-[#FC7A00] via-[#FF9022] to-[#70AC00] focus-within:ring-2 focus-within:ring-[#FC7A00]/30 transition-all shadow-xs flex-1">
                  <input
                    ref={(el) => {
                      inputRefs.current[idx] = el;
                    }}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={digit}
                    disabled={!otpSent || loading}
                    onChange={(e) => handleOtpChange(idx, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(idx, e)}
                    onPaste={handlePaste}
                    className="w-full h-12 sm:h-13 bg-white rounded-[10px] text-center font-mono font-black text-xl text-black outline-none border-0 disabled:bg-gray-100 disabled:opacity-60"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Verify & Activate Device Action Button */}
          <button
            type="button"
            disabled={loading || !otpSent || otp.join("").length !== 6}
            onClick={handleVerifyOtp}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-98 text-white font-black text-xs uppercase tracking-widest transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-2 shadow-xs mb-3"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Verifying Security Code...</span>
              </>
            ) : (
              <span>Authorize & Activate Device</span>
            )}
          </button>

          {/* Report to Support Button */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/support";
              }
            }}
            className="w-full py-3 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 font-bold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">gavel</span>
            <span>Didn&apos;t attempt login? Report to Support</span>
          </button>
        </div>

        {/* Footer Security Notice */}
        <div className="max-w-md w-full mx-auto text-center pt-3 border-t border-gray-200">
          <p className="text-[11px] text-gray-500 font-semibold flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-emerald-600 text-xs font-bold">shield</span>
            E-Global Pay Enterprise Security Guard • Device Isolation
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
