"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const { user, userData, setPinVerified, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
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
      <div className="w-full text-center mt-10">
        <h1 className="font-bodoni text-3xl mb-4 text-black">AUREUS</h1>
        <p className="text-gray-500 font-hanken tracking-widest uppercase text-xs">Enter your Access PIN</p>
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
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
          <button
            key={num}
            onClick={() => handleKeyPress(num.toString())}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-100 active:bg-black active:text-white transition-colors text-black"
          >
            {num}
          </button>
        ))}
        <div />
        <button
          onClick={() => handleKeyPress("0")}
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-100 active:bg-black active:text-white transition-colors text-black"
        >
          0
        </button>
        <button
          onClick={handleDelete}
          className="w-20 h-20 rounded-full flex items-center justify-center text-black active:text-red-500"
        >
          <span className="material-symbols-outlined text-3xl">backspace</span>
        </button>
      </div>
    </div>
  );
}
