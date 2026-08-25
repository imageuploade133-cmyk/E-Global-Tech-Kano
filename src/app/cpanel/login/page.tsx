"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function CpanelLoginPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Reset Password states
  const [isResetPasswordMode, setIsResetPasswordMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetPhone, setResetPhone] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [isRequestingOtp, setIsRequestingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isDispatchingResetEmail, setIsDispatchingResetEmail] = useState(false);
  const [otpDevCode, setOtpDevCode] = useState<string | null>(null);

  // Pre-fill email from auth context if available
  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email);
    }
  }, [user, adminEmail]);

  // Check if session is already unlocked on mount
  useEffect(() => {
    const checkCPanelSession = async () => {
      if (typeof window !== "undefined" && sessionStorage.getItem("admin_session_unlocked") === "true") {
        router.push("/cpanel");
        return;
      }
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          if (typeof window !== "undefined") {
            sessionStorage.setItem("admin_session_unlocked", "true");
          }
          router.push("/cpanel");
        }
      } catch (err) {
        console.warn("[CPanel Login] Session check failed:", err);
      }
    };
    checkCPanelSession();
  }, [router]);

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);

    const cleanEmail = adminEmail.trim().toLowerCase();

    if (!cleanEmail) {
      toast.error("Please enter your administrator email address.");
      setIsVerifyingPin(false);
      return;
    }

    if (!adminPassword) {
      toast.error("Please enter your administrator password.");
      setIsVerifyingPin(false);
      return;
    }

    try {
      const { signInWithEmailAndPassword } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");

      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, adminPassword);
      const firebaseUser = userCredential.user;
      const idToken = await firebaseUser.getIdToken(true);

      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ email: cleanEmail, idToken }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (typeof window !== "undefined") {
          sessionStorage.setItem("admin_session_unlocked", "true");
        }
        toast.success(data.message || "Firebase Admin Authentication Granted!");
        router.push("/cpanel");
      } else {
        toast.error(data.error || "Access Denied: Account is not an authorized administrator.");
      }
    } catch (err: any) {
      console.error("[CPanel Firebase Auth Error]:", err);
      let errMsg = "Firebase Authentication Failed.";
      if (err.code === "auth/invalid-credential" || err.code === "auth/wrong-password" || err.code === "auth/user-not-found") {
        errMsg = "Invalid administrator Email or Password.";
      } else if (err.code === "auth/too-many-requests") {
        errMsg = "Too many failed attempts. Please try again later.";
      } else if (err.message) {
        errMsg = err.message;
      }
      toast.error(errMsg);
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleRequestResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanPhone = resetPhone.trim();

    if (!cleanEmail || !cleanPhone) {
      toast.error("Please enter both email and phone number.");
      return;
    }

    setIsRequestingOtp(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_otp",
          email: cleanEmail,
          phoneNumber: cleanPhone,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Phone OTP sent successfully!");
        if (data.devOtp) setOtpDevCode(data.devOtp);
        setResetStep(2);
      } else {
        toast.error(data.error || "Failed to request password reset OTP.");
      }
    } catch {
      toast.error("Network communication failure requesting OTP.");
    } finally {
      setIsRequestingOtp(false);
    }
  };

  const handleVerifyResetOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = adminEmail.trim().toLowerCase();
    const cleanOtp = resetOtp.trim();

    if (!cleanOtp || cleanOtp.length !== 6) {
      toast.error("Please enter the 6-digit OTP code.");
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "verify_otp",
          email: cleanEmail,
          otp: cleanOtp,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Phone OTP verified!");
        setResetStep(3);
      } else {
        toast.error(data.error || "Invalid or expired OTP code.");
      }
    } catch {
      toast.error("Network communication failure verifying OTP.");
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleDispatchResetEmail = async () => {
    const cleanEmail = adminEmail.trim().toLowerCase();
    setIsDispatchingResetEmail(true);

    try {
      const res = await fetch("/api/admin/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "send_reset_email", email: cleanEmail }),
      });
      const data = await res.json();

      const { sendPasswordResetEmail } = await import("firebase/auth");
      const { auth } = await import("@/lib/firebase");

      await sendPasswordResetEmail(auth, cleanEmail);

      toast.success(data.message || "Official password recovery email sent! Check your inbox.");
      setIsResetPasswordMode(false);
      setResetStep(1);
      setResetPhone("");
      setResetOtp("");
      setOtpDevCode(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to send password recovery email.");
    } finally {
      setIsDispatchingResetEmail(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800 font-hanken">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 flex flex-col items-center text-center space-y-6 shadow-xl"
      >
        <div className="w-16 h-16 rounded-2xl bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00]">
          <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>admin_panel_settings</span>
        </div>

        <div>
          <h2 className="font-hanken font-black text-2xl tracking-tight text-gray-900 leading-tight">
            {isResetPasswordMode ? "Reset Admin Password" : "CPanel Administrator Login"}
          </h2>
          <p className="font-hanken text-xs text-gray-500 mt-1.5 font-semibold leading-relaxed">
            {isResetPasswordMode
              ? "Enter your administrator email address to receive a secure Firebase password recovery link."
              : "Welcome to the E-Tech Enterprise Control Panel. Authenticate using your Firebase Administrator credentials."}
          </p>
        </div>

        {isResetPasswordMode ? (
          <div className="w-full space-y-4 text-left">
            <div className="flex items-center justify-between gap-2 px-2 py-1 bg-gray-100 rounded-xl text-[10px] font-black uppercase tracking-wider">
              <span className={cn("px-2 py-1 rounded-lg transition-all", resetStep === 1 ? "bg-[#FC7A00] text-white" : "text-gray-400")}>1. Phone Verification</span>
              <span className={cn("px-2 py-1 rounded-lg transition-all", resetStep === 2 ? "bg-[#FC7A00] text-white" : "text-gray-400")}>2. OTP Check</span>
              <span className={cn("px-2 py-1 rounded-lg transition-all", resetStep === 3 ? "bg-emerald-600 text-white" : "text-gray-400")}>3. Reset Link</span>
            </div>

            {resetStep === 1 && (
              <form onSubmit={handleRequestResetOtp} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Administrator Email</label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="e.g. abdulkadir123shaba@gmail.com"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Registered Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={resetPhone}
                    onChange={(e) => setResetPhone(e.target.value)}
                    placeholder="e.g. +2348033123456 or 08033123456"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isRequestingOtp}
                  className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isRequestingOtp ? <><ButtonSpinner /> Requesting Phone OTP...</> : "Verify Phone & Request OTP"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetPasswordMode(false);
                    setResetStep(1);
                  }}
                  className="w-full text-center text-xs font-bold text-gray-500 hover:text-black uppercase tracking-wider cursor-pointer"
                >
                  ← Back to Login
                </button>
              </form>
            )}

            {resetStep === 2 && (
              <form onSubmit={handleVerifyResetOtp} className="space-y-4">
                <div className="p-3 bg-orange-50 border border-orange-100 rounded-2xl text-center space-y-1">
                  <p className="text-[11px] font-bold text-gray-700">OTP code dispatched via SMS/WhatsApp</p>
                  <p className="text-[10px] text-gray-500">Sent to: <span className="font-mono font-black">{resetPhone}</span></p>
                  {otpDevCode && (
                    <p className="text-[10px] font-mono font-bold text-[#FC7A00] bg-white p-1 rounded border border-orange-200 mt-1 select-all">
                      DEV OTP: {otpDevCode}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Enter 6-Digit OTP Code</label>
                  <input
                    type="text"
                    maxLength={6}
                    required
                    value={resetOtp}
                    onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 123456"
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-center font-mono text-lg tracking-widest text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isVerifyingOtp}
                  className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isVerifyingOtp ? <><ButtonSpinner /> Verifying OTP Code...</> : "Confirm OTP Code"}
                </button>

                <div className="flex justify-between items-center text-xs font-bold text-gray-500">
                  <button
                    type="button"
                    onClick={() => setResetStep(1)}
                    className="hover:text-black uppercase tracking-wider cursor-pointer"
                  >
                    ← Re-enter Phone
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRequestResetOtp({ preventDefault: () => {} } as any)}
                    className="text-[#FC7A00] hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    Resend OTP
                  </button>
                </div>
              </form>
            )}

            {resetStep === 3 && (
              <div className="space-y-4 text-center">
                <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>mark_email_read</span>
                </div>

                <div>
                  <h3 className="font-black text-sm text-gray-900 uppercase">Phone Identity Verified</h3>
                  <p className="text-[11px] text-gray-500 mt-1 font-semibold leading-relaxed">
                    Click below to dispatch the official password reset recovery link to <span className="font-bold text-black">{adminEmail}</span>.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={isDispatchingResetEmail}
                  onClick={handleDispatchResetEmail}
                  className="w-full py-4 bg-emerald-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-emerald-700 active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
                >
                  {isDispatchingResetEmail ? <><ButtonSpinner /> Sending Password Reset Email...</> : "Dispatch Reset Link to Email"}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsResetPasswordMode(false);
                    setResetStep(1);
                  }}
                  className="text-xs font-bold text-gray-500 hover:text-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleAdminVerify} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Administrator Email</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="e.g. abdulkadir123shaba@gmail.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <div className="flex justify-between items-center">
                <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Administrator Password</label>
                <button
                  type="button"
                  onClick={() => setIsResetPasswordMode(true)}
                  className="text-[10px] font-bold text-gray-400 hover:text-[#FC7A00] uppercase"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative w-full">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Enter Password"
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-4 pr-11 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FC7A00] transition-colors p-1 flex items-center justify-center cursor-pointer"
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {showPassword ? "visibility_off" : "visibility"}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isVerifyingPin}
              className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer disabled:opacity-50 shadow-md"
            >
              {isVerifyingPin ? <><ButtonSpinner /> Authenticating Firebase Token...</> : "Authenticate Administrator"}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  );
}
