"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import { motion } from "framer-motion";

export default function PinPage() {
  const [pin, setPin] = useState("");
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([]);
  const { user, userData, setPinVerified, loading } = useAuth();
  const router = useRouter();

  const shuffleKeypad = () => {
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    setKeypadNumbers(numbers);
  };

  useEffect(() => {
    shuffleKeypad();
  }, []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [user, loading, router]);

  const handleKeyPress = (num: string) => {
    if (pin.length < 4) {
      const newPin = pin + num;
      setPin(newPin);
      // Reshuffle after key press for maximum security
      shuffleKeypad();

      if (newPin.length === 4) {
        verifyPin(newPin);
      }
    }
  };

  const handleDelete = () => {
    setPin(pin.slice(0, -1));
    shuffleKeypad();
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
      <div className="w-full flex flex-col items-center text-center mt-10">
        <div className="relative w-16 h-16 mb-4">
          <Image
            src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
            alt="E-Tech Logo"
            fill
            className="object-contain"
          />
        </div>
        <h1 className="font-hanken font-bold text-xl tracking-tight text-black mb-1">E-TECH GLOBAL HUB</h1>
        <p className="text-gray-500 font-hanken tracking-widest uppercase text-xs">Enter Access PIN</p>
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
        {keypadNumbers.slice(0, 9).map((num) => (
          <motion.button
            whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
            whileHover={{ scale: 1.05 }}
            key={num}
            onClick={() => handleKeyPress(num)}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-200 text-black cursor-pointer transition-colors"
          >
            {num}
          </motion.button>
        ))}
        <div className="w-20 h-20" />
        {keypadNumbers[9] !== undefined && (
          <motion.button
            whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
            whileHover={{ scale: 1.05 }}
            onClick={() => handleKeyPress(keypadNumbers[9])}
            className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-hanken border border-gray-200 text-black cursor-pointer transition-colors"
          >
            {keypadNumbers[9]}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.9 }}
          whileHover={{ scale: 1.05 }}
          onClick={handleDelete}
          className="w-20 h-20 rounded-full flex items-center justify-center text-black active:text-red-500 cursor-pointer"
        >
          <span className="material-symbols-outlined text-3xl">backspace</span>
        </motion.button>
      </div>
    </div>
  );
}
