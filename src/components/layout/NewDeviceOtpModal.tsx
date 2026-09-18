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
  const [otp, setOtp] = useState<string[]>(Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  useModalBackHandler(isOpen, onCancel, "new-device-otp-modal");

  useEffect(() => {
    setActiveChannel(initialChannel);
    setActiveDestination(maskedDestination);
    setOtp(Array(6).fill(""));
    setCooldown(60);
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

  const handleResendOrSwitchChannel = async (targetChannel: "whatsapp" | "email") => {
    if (cooldown > 0 && targetChannel === activeChannel) {
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
      setOtp(Array(6).fill(""));
      toast.success(data.message || "New verification code sent!");
      inputRefs.current[0]?.focus();

    } catch (err: any) {
      toast.error(err.message || "Failed to resend code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200000] w-full h-full bg-slate-900/95 backdrop-blur-xl flex flex-col justify-between overflow-y-auto p-4 sm:p-6 text-white"
      >
        <div className="max-w-md w-full mx-auto my-auto flex flex-col items-center text-center py-6">
          {/* Header Icon Badge */}
          <div className="w-16 h-16 rounded-2xl bg-[#FC7A00]/15 border border-[#FC7A00]/30 flex items-center justify-center text-[#FC7A00] mb-5 shadow-lg shadow-[#FC7A00]/10">
            <span className="material-symbols-outlined text-3xl">verified_user</span>
          </div>

          <span className="px-3 py-0.5 rounded-full text-[10px] font-bold bg-[#FC7A00]/20 text-[#FC7A00] border border-[#FC7A00]/30 uppercase tracking-widest mb-2">
            Verify It&apos;s You
          </span>

          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mb-2">
            New Device Login Security
          </h2>

          <p className="text-xs text-slate-300 leading-relaxed mb-6">
            A new device is logging into your account. We sent a 6-digit verification code to your verified channel:
          </p>

          {/* Explicit Full-Width Channel Selector Cards */}
          <div className="w-full space-y-2.5 mb-6">
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-wider text-left pl-1">
              Select Verification Method
            </p>
            <div className="grid grid-cols-1 gap-2.5 w-full">
              {/* Phone Number OTP Option */}
              {channels.some(c => c.type === "whatsapp") && (
                <button
                  type="button"
                  onClick={() => handleResendOrSwitchChannel("whatsapp")}
                  disabled={resending}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    activeChannel === "whatsapp"
                      ? "bg-[#FC7A00]/15 border-[#FC7A00] text-white shadow-lg shadow-[#FC7A00]/10 ring-1 ring-[#FC7A00]"
                      : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeChannel === "whatsapp" ? "bg-[#FC7A00] text-white" : "bg-slate-700 text-slate-300"
                    }`}>
                      <span className="material-symbols-outlined text-xl">smartphone</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Phone Number OTP</p>
                      <p className="text-[11px] text-slate-300 font-mono">
                        {channels.find(c => c.type === "whatsapp")?.masked || activeDestination}
                      </p>
                    </div>
                  </div>
                  {activeChannel === "whatsapp" && (
                    <span className="material-symbols-outlined text-[#FC7A00] text-xl">check_circle</span>
                  )}
                </button>
              )}

              {/* Email OTP Option */}
              {channels.some(c => c.type === "email") && (
                <button
                  type="button"
                  onClick={() => handleResendOrSwitchChannel("email")}
                  disabled={resending}
                  className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                    activeChannel === "email"
                      ? "bg-[#FC7A00]/15 border-[#FC7A00] text-white shadow-lg shadow-[#FC7A00]/10 ring-1 ring-[#FC7A00]"
                      : "bg-slate-800/80 border-slate-700/80 text-slate-300 hover:bg-slate-800"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      activeChannel === "email" ? "bg-[#FC7A00] text-white" : "bg-slate-700 text-slate-300"
                    }`}>
                      <span className="material-symbols-outlined text-xl">mail</span>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Email OTP</p>
                      <p className="text-[11px] text-slate-300 font-mono">
                        {channels.find(c => c.type === "email")?.masked || activeDestination}
                      </p>
                    </div>
                  </div>
                  {activeChannel === "email" && (
                    <span className="material-symbols-outlined text-[#FC7A00] text-xl">check_circle</span>
                  )}
                </button>
              )}
            </div>
          </div>

          {/* Active Status Callout */}
          <div className="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 w-full mb-6 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#FC7A00] text-lg">
                {activeChannel === "whatsapp" ? "smartphone" : "mail"}
              </span>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                  Active Channel: {activeChannel === "whatsapp" ? "Phone Number OTP" : "Email OTP"}
                </p>
                <p className="text-xs font-bold text-white font-mono">{activeDestination}</p>
              </div>
            </div>
            {cooldown > 0 ? (
              <span className="text-[11px] text-slate-400 font-mono font-semibold">
                Resend in {cooldown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={() => handleResendOrSwitchChannel(activeChannel)}
                disabled={resending}
                className="text-xs font-bold text-[#FC7A00] hover:underline cursor-pointer bg-transparent border-0"
              >
                {resending ? "Sending..." : "Resend Code"}
              </button>
            )}
          </div>

          {/* 6-Digit OTP Box Grid */}
          <div className="flex items-center justify-center gap-2 sm:gap-3 w-full mb-6">
            {otp.map((digit, idx) => (
              <input
                key={idx}
                ref={(el) => {
                  inputRefs.current[idx] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleKeyDown(idx, e)}
                onPaste={handlePaste}
                className="w-11 h-12 sm:w-13 sm:h-14 rounded-xl bg-slate-800 border-2 border-slate-700 text-center font-mono font-bold text-xl text-white outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/30 transition-all shadow-inner"
              />
            ))}
          </div>

          {/* Verify Action Button */}
          <button
            type="button"
            disabled={loading || otp.join("").length !== 6}
            onClick={handleVerifyOtp}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:opacity-95 text-white font-bold text-sm shadow-lg shadow-[#FC7A00]/25 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mb-3"
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                  className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                />
                <span>Verifying Security Code...</span>
              </>
            ) : (
              <span>Authorize & Activate Device</span>
            )}
          </button>

          {/* Report Support Button */}
          <button
            type="button"
            onClick={() => {
              if (typeof window !== "undefined") {
                window.location.href = "/support";
              }
            }}
            className="w-full py-2.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 font-semibold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <span className="material-symbols-outlined text-sm">gavel</span>
            <span>Didn&apos;t attempt login? Report to Support</span>
          </button>
        </div>

        {/* Footer Security Notice */}
        <div className="max-w-md w-full mx-auto text-center pt-3 border-t border-slate-800">
          <p className="text-[11px] text-slate-400 flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-emerald-400 text-xs">shield</span>
            E-Global Pay Enterprise Security Guard • Device Isolation
          </p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
