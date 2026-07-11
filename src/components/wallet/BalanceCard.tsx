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
      className="mb-stack-lg text-black"
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

        <div className="relative h-full p-4 min-[375px]:p-5 md:p-6 flex flex-col justify-between z-10">
          {/* Top Row: Label and Chip */}
          <div className="flex justify-between items-start gap-3 w-full overflow-hidden">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="relative w-5 h-5 min-[375px]:w-6 min-[375px]:h-6 flex-shrink-0">
                  <Image
                    src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                    alt="E-Tech Logo"
                    fill
                    className="object-contain"
                  />
                </div>
                <span className="font-label-sm text-[8px] min-[375px]:text-[10px] uppercase tracking-[0.15em] text-[#FFFFFF] font-bold truncate">
                  E-TECH GLOBAL HUB
                </span>
              </div>
              <p className="font-label-sm text-[10px] min-[375px]:text-[12px] text-[#FFFFFF]/80 font-medium mt-0.5">Available Balance</p>
            </div>
            {/* SIM Chip Icon */}
            <div className="w-8 h-6 min-[375px]:w-10 min-[375px]:h-8 rounded-md bg-gradient-to-br from-[#FC7A00]/80 to-[#FFB870] border border-[#FC7A00]/20 flex flex-col justify-around p-1 min-[375px]:p-1.5 overflow-hidden flex-shrink-0">
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
            </div>
          </div>

          {/* Middle: Balance */}
          <div className="space-y-1.5 min-[375px]:space-y-2 w-full overflow-hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={isVisible ? "visible" : "hidden"}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center justify-between gap-2 w-full overflow-hidden"
              >
                <div className="flex-1 min-w-0">
                  <h2 className="font-display-lg text-[20px] min-[360px]:text-[24px] min-[400px]:text-[30px] md:text-[36px] lg:text-[40px] text-[#FFFFFF] font-bold tracking-tight truncate" title={formattedBalance}>
                    {isVisible ? formattedBalance : "₦ •••,•••.••"}
                  </h2>
                </div>
                <button
                  onClick={() => setIsVisible(!isVisible)}
                  className="text-[#FFFFFF] hover:text-[#FFFFFF] transition-colors p-1 flex-shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] min-[375px]:text-[20px] text-[#FFFFFF] block">
                    {isVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Card Number Mockup */}
            <div className="flex gap-2 min-[375px]:gap-4 font-mono text-[11px] min-[375px]:text-[13px] md:text-[14px] text-[#FFFFFF]/80 tracking-[0.15em] min-[375px]:tracking-[0.2em]">
                <span>4582</span>
                <span>••••</span>
                <span>••••</span>
                <span>8921</span>
            </div>
          </div>

          {/* Bottom: User Name and Type */}
          <div className="flex justify-between items-end gap-3 w-full overflow-hidden">
            <div className="flex-1 min-w-0">
                <p className="font-label-sm text-[8px] min-[375px]:text-[9px] uppercase tracking-wider text-[#FFFFFF]/70 mb-0.5 font-medium truncate">Account Holder</p>
                <p className="font-label-sm text-[11px] min-[375px]:text-[13px] md:text-[14px] text-[#FFFFFF] uppercase tracking-widest font-bold truncate" title={resolvedName}>{resolvedName}</p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
                 <span className="material-symbols-outlined text-[#FFFFFF] text-[22px] min-[375px]:text-[26px]" style={{ fontVariationSettings: '"FILL" 1' }}>diamond</span>
                 <p className="font-label-sm text-[8px] min-[375px]:text-[9px] text-[#FFFFFF] font-bold uppercase tracking-tighter">Infinite</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Below Card - Shadow removed as requested */}
      <div className="mt-5 min-[375px]:mt-6 flex gap-3 min-[375px]:gap-4">
        {/* Add Money - Deep Emerald Gradient based on #07B038 */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          className="flex-grow py-3 min-[375px]:py-3.5 px-2 min-[375px]:px-4 bg-gradient-to-r from-[#045C1D] via-[#07B038] to-[#034A17] border border-white/10 rounded-xl min-[375px]:rounded-2xl flex items-center justify-center gap-1.5 min-[375px]:gap-2.5 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[14px] min-[375px]:text-[16px] font-bold block">add_card</span>
          </div>
          <span className="font-label-sm text-[11px] min-[375px]:text-[12px] md:text-[13px] text-white tracking-wider min-[375px]:tracking-widest uppercase font-bold truncate">
            Add Money
          </span>
        </motion.button>

        {/* Transfer - Deep Sunset Orange Gradient based on #FC7A00 */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          className="flex-grow py-3 min-[375px]:py-3.5 px-2 min-[375px]:px-4 bg-gradient-to-r from-[#B35200] via-[#FC7A00] to-[#8C4000] border border-white/10 rounded-xl min-[375px]:rounded-2xl flex items-center justify-center gap-1.5 min-[375px]:gap-2.5 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[14px] min-[375px]:text-[16px] font-bold block">send</span>
          </div>
          <span className="font-label-sm text-[11px] min-[375px]:text-[12px] md:text-[13px] text-white tracking-wider min-[375px]:tracking-widest uppercase font-bold truncate">
            Transfer
          </span>
        </motion.button>
      </div>
    </motion.section>
  );
};
