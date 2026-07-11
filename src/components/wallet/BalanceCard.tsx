"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";

interface BalanceCardProps {
  balance: number;
  currency: string;
  userName?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, currency, userName }) => {
  const [isVisible, setIsVisible] = useState(true);
  const { userData, user } = useAuth();

  const resolvedName = (
    userName ||
    userData?.name ||
    user?.displayName ||
    "THE CAPTAIN"
  ).toUpperCase();

  const formattedBalance = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(balance);

  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-stack-lg"
    >
      {/* Physical Card Design */}
      <div className="relative aspect-[1.586/1] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 group">
        {/* Card Background - Premium Obsidian Mesh */}
        <div className="absolute inset-0 bg-[#0c1324]">
            <div className="absolute inset-0 opacity-40"
                 style={{
                    backgroundImage: `radial-gradient(circle at 20% 30%, #FC7A00 0%, transparent 40%),
                                     radial-gradient(circle at 80% 70%, #95d3ba 0%, transparent 40%)`
                 }}
            />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            <div className="absolute inset-0 gold-shimmer opacity-20"></div>
        </div>

        <div className="relative h-full p-6 flex flex-col justify-between z-10">
          {/* Top Row: Label and Chip */}
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6">
                  <Image
                    src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                    alt="E-Tech Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="font-label-sm text-[10px] uppercase tracking-[0.2em] text-[#FFFFFF] font-bold">
                  E-TECH GLOBAL HUB
                </span>
              </div>
              <p className="font-label-sm text-[12px] text-[#FFFFFF] font-medium">Available Balance</p>
            </div>
            {/* SIM Chip Icon */}
            <div className="w-10 h-8 rounded-md bg-gradient-to-br from-[#FC7A00]/80 to-[#FFB870] border border-[#FC7A00]/20 flex flex-col justify-around p-1.5 overflow-hidden">
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
            </div>
          </div>

          {/* Middle: Balance */}
          <div className="space-y-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={isVisible ? "visible" : "hidden"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-baseline gap-3"
              >
                <h2 className="font-display-lg text-[32px] md:text-[40px] text-[#FFFFFF] font-bold tracking-tight">
                  {isVisible ? formattedBalance : "₦ •••,•••.••"}
                </h2>
                <button
                  onClick={() => setIsVisible(!isVisible)}
                  className="text-[#FFFFFF] hover:text-[#FFFFFF] transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-[20px] text-[#FFFFFF]">
                    {isVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Card Number Mockup */}
            <div className="flex gap-4 font-mono text-[14px] text-[#FFFFFF] tracking-[0.2em]">
                <span>4582</span>
                <span>••••</span>
                <span>••••</span>
                <span>8921</span>
            </div>
          </div>

          {/* Bottom: User Name and Type */}
          <div className="flex justify-between items-end">
            <div>
                <p className="font-label-sm text-[10px] uppercase tracking-wider text-[#FFFFFF] mb-1 font-medium">Account Holder</p>
                <p className="font-label-sm text-[14px] text-[#FFFFFF] uppercase tracking-widest font-bold">{resolvedName}</p>
            </div>
            <div className="flex flex-col items-end">
                 <span className="material-symbols-outlined text-[#FFFFFF] text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>diamond</span>
                 <p className="font-label-sm text-[10px] text-[#FFFFFF] font-bold uppercase tracking-tighter">Infinite</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Below Card - Shadow removed as requested */}
      <div className="mt-6 flex gap-4">
        {/* Add Money - Cool Teal-Cyan-Blue Premium Tri-Gradient */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -2 }}
          className="flex-grow py-4 bg-gradient-to-r from-[#00f2fe] via-[#4facfe] to-[#00c6ff] border border-white/10 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-white text-[18px] font-bold">add_card</span>
          </div>
          <span className="font-label-sm text-[13px] text-white tracking-widest uppercase font-bold">
            Add Money
          </span>
        </motion.button>

        {/* Transfer - Cool Brand Orange-Pink-Sunset Coral Premium Tri-Gradient */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -2 }}
          className="flex-grow py-4 bg-gradient-to-r from-[#ff0844] via-[#FC7A00] to-[#ffb199] border border-white/10 rounded-2xl flex items-center justify-center gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300">
            <span className="material-symbols-outlined text-white text-[18px] font-bold">send</span>
          </div>
          <span className="font-label-sm text-[13px] text-white tracking-widest uppercase font-bold">
            Transfer
          </span>
        </motion.button>
      </div>
    </motion.section>
  );
};
