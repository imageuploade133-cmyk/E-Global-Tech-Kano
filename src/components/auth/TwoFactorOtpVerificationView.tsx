"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { User } from "firebase/auth";
import { triggerHaptic } from "@/lib/haptics";

interface TwoFactorOtpVerificationViewProps {
  user: User | null;
  title?: string;
  description?: string;
  onVerifiedSuccess: () => void;
  onCancel?: () => void;
}

export function TwoFactorOtpVerificationView({
  user,
  title = "2FA Security Verification",
  description = "Please select a channel to send your 6-digit security OTP code.",
  onVerifiedSuccess,
  onCancel,
}: TwoFactorOtpVerificationViewProps) {
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [hasOtpBeenSent, setHasOtpBeenSent] = useState(false);
  const [otpDigits, setOtpDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [cooldown, setCooldown] = useState(0);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [maskedEmail, setMaskedEmail] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const updated = [...otpDigits];
    updated[index] = digit;
    setOtpDigits(updated);

    if (digit && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    if (updated.join("").length === 6) {
      executeVerifyOtp(updated.join(""));
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasteData = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasteData) return;
    const updated = ["", "", "", "", "", ""];
    for (let i = 0; i < pasteData.length; i++) {
      updated[i] = pasteData[i];
    }
    setOtpDigits(updated);
    const targetIdx = Math.min(pasteData.length, 5);
    inputRefs.current[targetIdx]?.focus();

    if (updated.join("").length === 6) {
      executeVerifyOtp(updated.join(""));
    }
  };

  const dispatchOtp = async (selectedChannel: "email" | "whatsapp" = channel) => {
    if (!user) {
      toast.error("User session missing. Please log in.");
      return;
    }

    triggerHaptic();
    setIsSending(true);
    toast.loading(`Sending 2FA OTP code via ${selectedChannel === "email" ? "Email" : "WhatsApp"}...`);

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/login-2fa-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "send", channel: selectedChannel }),
      });

      toast.dismiss();
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "2FA OTP code sent successfully!");
        if (data.maskedEmail) setMaskedEmail(data.maskedEmail);
        if (data.maskedPhone) setMaskedPhone(data.maskedPhone);
        if (data.devOtp) toast.info(`Dev Mode OTP: ${data.devOtp}`);
        setHasOtpBeenSent(true);
        setCooldown(60);
      } else {
        toast.error(data.error || "Failed to send 2FA OTP code.");
      }
    } catch {
      toast.dismiss();
      toast.error("Network communication error sending OTP.");
    } finally {
      setIsSending(false);
    }
  };

  const executeVerifyOtp = async (code: string) => {
    if (!user || code.length !== 6) return;

    triggerHaptic();
    setIsVerifying(true);
    toast.loading("Verifying 2FA Security OTP...");

    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/auth/login-2fa-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "verify", otpCode: code }),
      });

      toast.dismiss();
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("2FA OTP code verified successfully!");
        onVerifiedSuccess();
      } else {
        toast.error(data.error || data.message || "Invalid or expired OTP code.");
        setOtpDigits(["", "", "", "", "", ""]);
      }
    } catch {
      toast.dismiss();
      toast.error("Error verifying 2FA OTP code.");
      setOtpDigits(["", "", "", "", "", ""]);
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="w-full max-w-sm mx-auto flex flex-col items-center text-center space-y-4 font-hanken select-none">
      {/* Icon Badge */}
      <div className="w-14 h-14 rounded-full bg-orange-50 border-2 border-orange-100 flex items-center justify-center text-[#FC7A00] shadow-2xs">
        <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: '"FILL" 1' }}>
          shield_lock
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="font-bodoni font-bold text-lg text-black">{title}</h3>
        <p className="font-hanken text-[11px] text-gray-500 font-semibold leading-relaxed max-w-xs mx-auto">
          {description}
        </p>
      </div>

      {/* Channel Selector Pills */}
      <div className="space-y-1.5 w-full">
        <div className="flex items-center justify-between px-1">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Delivery Channel</span>
          {cooldown > 0 && (
            <span className="text-[9.5px] font-bold text-amber-600 uppercase tracking-wider">
              Locked ({cooldown}s)
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl w-full border border-gray-200">
          <button
            type="button"
            disabled={isSending || cooldown > 0}
            onClick={() => {
              if (cooldown > 0) return;
              setChannel("email");
            }}
            className={cn(
              "py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              channel === "email" ? "bg-[#FC7A00] text-white shadow-xs" : "bg-transparent text-gray-500 hover:text-black",
              cooldown > 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">mail</span>
            <span>Email</span>
          </button>

          <button
            type="button"
            disabled={isSending || cooldown > 0}
            onClick={() => {
              if (cooldown > 0) return;
              setChannel("whatsapp");
            }}
            className={cn(
              "py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5",
              channel === "whatsapp" ? "bg-emerald-600 text-white shadow-xs" : "bg-transparent text-gray-500 hover:text-black",
              cooldown > 0 ? "cursor-not-allowed opacity-60" : "cursor-pointer"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">chat</span>
            <span>WhatsApp</span>
          </button>
        </div>
      </div>

      {/* Send OTP / Resend Button */}
      <div className="w-full">
        {!hasOtpBeenSent ? (
          <button
            type="button"
            disabled={isSending}
            onClick={() => dispatchOtp(channel)}
            className="w-full py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white text-xs font-black uppercase tracking-wider rounded-xl cursor-pointer disabled:opacity-50 transition-all shadow-xs"
          >
            {isSending ? "Sending 2FA OTP Code..." : `Send OTP Code via ${channel === "email" ? "Email" : "WhatsApp"}`}
          </button>
        ) : cooldown > 0 ? (
          <div className="p-2 bg-orange-50/50 border border-orange-100 rounded-xl text-center">
            <p className="text-[11px] text-gray-600 font-bold">
              Code sent to {channel === "email" ? (maskedEmail || "registered email") : (maskedPhone || "registered WhatsApp")}.
            </p>
            <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Resend available in {cooldown}s</p>
          </div>
        ) : (
          <button
            type="button"
            disabled={isSending}
            onClick={() => dispatchOtp(channel)}
            className="text-xs font-bold text-[#FC7A00] hover:underline cursor-pointer disabled:opacity-50 flex items-center gap-1.5 justify-center mx-auto uppercase tracking-wider"
          >
            {isSending ? "Dispatching New Code..." : "Resend OTP Code"}
          </button>
        )}
      </div>

      {/* 6-Digit OTP Boxes */}
      {hasOtpBeenSent && (
        <div className="space-y-3 w-full pt-1">
          <p className="text-[10.5px] font-bold text-gray-500 uppercase tracking-wider">Enter 6-Digit Security OTP</p>
          <div className="flex gap-2 justify-center w-full">
            {[0, 1, 2, 3, 4, 5].map((idx) => (
              <input
                key={idx}
                ref={(el) => { inputRefs.current[idx] = el; }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={otpDigits[idx]}
                disabled={isVerifying || isSending}
                onChange={(e) => handleOtpChange(idx, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                onPaste={handleOtpPaste}
                className={cn(
                  "w-11 h-12 bg-white border-2 rounded-xl text-center font-mono font-black text-xl text-black transition-all outline-none shadow-xs",
                  otpDigits[idx]
                    ? "border-[#FC7A00] bg-orange-50/20 ring-2 ring-[#FC7A00]/20"
                    : "border-gray-200 focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20"
                )}
              />
            ))}
          </div>

          <button
            type="button"
            disabled={isVerifying || otpDigits.join("").length !== 6}
            onClick={() => executeVerifyOtp(otpDigits.join(""))}
            className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer hover:brightness-105 active:scale-95 transition-all shadow-xs disabled:opacity-50 mt-2"
          >
            {isVerifying ? "Verifying 2FA Code..." : "Authenticate & Proceed"}
          </button>
        </div>
      )}

      {onCancel && (
        <button
          type="button"
          disabled={isVerifying || isSending}
          onClick={onCancel}
          className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs font-bold uppercase rounded-xl cursor-pointer active:scale-95 transition-all mt-2"
        >
          Cancel
        </button>
      )}
    </div>
  );
}
