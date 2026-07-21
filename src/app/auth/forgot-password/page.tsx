"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { formatFirebaseError } from "@/lib/utils";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const router = useRouter();

  // Clean up old ripples after their animation finishes
  useEffect(() => {
    if (ripples.length > 0) {
      const timer = setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripples[0].id));
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [ripples]);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      toast.success("Reset link dispatched!");
      setSubmitted(true);
    } catch (error: unknown) {
      console.error("Password Reset Error:", error);
      toast.error(formatFirebaseError(error));
    } finally {
      setLoading(false);
    }
  };

  const createRipple = (e: React.MouseEvent<HTMLButtonElement>) => {
    const button = e.currentTarget;
    const rect = button.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);
  };

  return (
    <div className="min-h-screen bg-white text-black flex flex-col justify-between p-6 max-w-md mx-auto select-none">
      {/* Top Section */}
      <div className="w-full flex flex-col items-center pt-8">
        {/* Brand Header */}
        <div className="flex items-center gap-2 mb-10">
          <div className="relative w-8 h-8 flex-shrink-0 bg-gray-50 rounded-lg p-1 flex items-center justify-center border border-gray-100">
            <Image
              src="https://e-global-tech-kano.vercel.app/_next/image?url=https%3A%2F%2Fi.ibb.co%2FWWjZrtC7%2FE-Tech.png&w=640&q=75"
              alt="E-Tech Logo"
              width={24}
              height={24}
              className="object-contain"
              priority
            />
          </div>
          <span className="font-hanken font-extrabold text-sm uppercase tracking-[0.15em] text-black">
            E-TECH HUB
          </span>
        </div>

        <AnimatePresence mode="wait">
          {!submitted ? (
            <motion.div
              key="forgot-form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3 }}
              className="w-full text-center"
            >
              {/* Header Title */}
              <h1 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">
                Forgot Password?
              </h1>
              <p className="font-hanken text-xs text-gray-400 font-semibold leading-relaxed mt-2 max-w-[280px] mx-auto">
                No worries! Provide your registered email address below, and we will send you a secure link to recover your account.
              </p>

              {/* Input Form */}
              <form onSubmit={handleResetPassword} className="mt-8 space-y-6 text-left">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">
                    Email Address
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">
                      mail
                    </span>
                    <input
                      type="email"
                      required
                      placeholder="e.g. user@etechglobalhub.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-11 pr-4 py-4 font-mono font-medium text-sm text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={createRipple}
                    type="submit"
                    disabled={loading}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-50 relative overflow-hidden flex items-center justify-center shadow-none"
                  >
                    {/* Ripple container */}
                    <AnimatePresence>
                      {ripples.map((ripple) => (
                        <span
                          key={ripple.id}
                          className="absolute bg-white/30 rounded-full pointer-events-none -translate-x-1/2 -translate-y-1/2 animate-ripple"
                          style={{ left: ripple.x, top: ripple.y }}
                        />
                      ))}
                    </AnimatePresence>

                    {loading ? (
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined animate-spin text-[16px]">progress_activity</span>
                        Sending link...
                      </div>
                    ) : (
                      "Send Reset Link"
                    )}
                  </motion.button>
                </div>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success-message"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 0.98 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="w-full text-center space-y-5"
            >
              {/* Animated checkmark */}
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner animate-bounce">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
              </div>

              <div>
                <h1 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">
                  Check Your Inbox
                </h1>
                <p className="font-hanken text-xs text-gray-500 font-semibold leading-relaxed mt-2 max-w-[280px] mx-auto">
                  A secure reset link has been dispatched to <strong className="text-black">{email}</strong>. Follow the instructions in the email to set a new password.
                </p>
              </div>

              <div className="pt-4">
                <button
                  type="button"
                  onClick={() => router.push("/auth/login")}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                >
                  Proceed to Login
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom section links */}
      <div className="w-full text-center pb-8 pt-4">
        <Link
          href="/auth/login"
          className="font-hanken text-xs font-extrabold tracking-wide uppercase text-gray-400 hover:text-black transition-colors"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}
