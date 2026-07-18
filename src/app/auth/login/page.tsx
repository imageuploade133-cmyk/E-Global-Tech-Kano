"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";
import { formatFirebaseError } from "@/lib/utils";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      toast.success("Welcome back!");
      router.push("/auth/pin");
    } catch (error: unknown) {
      console.error("Login Error:", error);
      const friendlyMessage = formatFirebaseError(error);
      toast.error(friendlyMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleButtonClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev, newRipple]);
    setTimeout(() => {
      setRipples((prev) => prev.filter((r) => r.id !== newRipple.id));
    }, 600);
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F8FAFC] p-4 min-[375px]:p-6 justify-center text-black">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto bg-white rounded-3xl shadow-xl p-5 min-[375px]:p-8 border border-gray-100"
      >
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="relative w-20 h-20 mb-4">
            <Image
              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
              alt="E-Tech Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-hanken font-bold text-2xl tracking-tight text-black">E-TECH GLOBAL HUB</h1>
          <p className="text-gray-500 font-hanken mt-1 text-xs font-semibold">Welcome back to your secure hub</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-1.5 text-left">
            <label htmlFor="email" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Email Address</label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 px-4 outline-none focus:border-black focus:bg-white transition-all text-xs font-semibold text-black"
              placeholder="doe@example.com"
              aria-label="Email Address"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <div className="flex justify-between items-center">
              <label htmlFor="password" className="text-[10px] font-black uppercase tracking-widest text-gray-400">Password</label>
              <Link href="/auth/forgot-password" className="text-xs text-[#FC7A00] hover:underline font-bold">
                Forgot Password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl py-3 pl-4 pr-10 outline-none focus:border-black focus:bg-white transition-all text-xs font-semibold text-black"
                placeholder="••••••••"
                aria-label="Password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#FC7A00] cursor-pointer transition-colors p-1"
                aria-label={showPassword ? "Hide Password" : "Show Password"}
              >
                <span className="material-symbols-outlined text-[18px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between py-1 text-left">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#FC7A00] focus:ring-[#FC7A00] cursor-pointer"
              />
              <label htmlFor="rememberMe" className="text-xs text-gray-600 font-semibold select-none cursor-pointer">
                Remember Me
              </label>
            </div>
          </div>

          {/* Premium login button with ripple and subtle glow in project brand orange colors */}
          <div>
            <button
              type="submit"
              disabled={loading}
              onClick={handleButtonClick}
              className="relative overflow-hidden w-full bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 text-white py-4 rounded-2xl font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-[0_4px_20px_rgba(252,122,0,0.25)] hover:shadow-[0_4px_25px_rgba(252,122,0,0.4)] cursor-pointer flex items-center justify-center gap-2.5"
            >
              {/* Ripple Elements */}
              {ripples.map((ripple) => (
                <span
                  key={ripple.id}
                  className="absolute bg-white/30 rounded-full pointer-events-none animate-ripple"
                  style={{
                    left: ripple.x,
                    top: ripple.y,
                    width: 100,
                    height: 100,
                    transform: "translate(-50%, -50%)",
                  }}
                />
              ))}

              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}
                    className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white"
                  />
                  <span>Authenticating...</span>
                </>
              ) : (
                "Login"
              )}
            </button>
          </div>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-[#FC7A00] font-bold underline">
            Sign Up
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
