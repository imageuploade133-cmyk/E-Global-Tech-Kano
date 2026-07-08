"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";
import { motion } from "framer-motion";
import Image from "next/image";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name });

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        uid: user.uid,
        createdAt: new Date().toISOString(),
        balance: 0,
        pin: null, // User will set PIN next
      });

      toast.success("Account created successfully!");
      router.push("/auth/pin-setup");
    } catch (error: unknown) {
      console.error("Signup Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create account";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6 justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
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
          <p className="text-gray-500 font-hanken mt-1">Create your secure hub account</p>
        </div>

        <form onSubmit={handleSignUp} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border-b border-gray-200 py-3 px-1 outline-none focus:border-black transition-colors text-black"
              placeholder="Captain John Doe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-b border-gray-200 py-3 px-1 outline-none focus:border-black transition-colors text-black"
              placeholder="captain@example.com"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-50 border-b border-gray-200 py-3 px-1 outline-none focus:border-black transition-colors text-black"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-black font-bold underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
