"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface BalanceCardProps {
  balance: number;
  currency: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, currency }) => {
  const [isVisible, setIsVisible] = useState(true);

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
                    backgroundImage: `radial-gradient(circle at 20% 30%, #f2ca50 0%, transparent 40%),
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
                <span className="material-symbols-outlined text-primary text-[14px]">verified_user</span>
                <span className="font-label-sm text-[10px] uppercase tracking-[0.2em] text-on-surface-variant/70 font-bold">
                  Obsidian Priority
                </span>
              </div>
              <p className="font-label-sm text-[12px] text-on-surface-variant/60">Available Balance</p>
            </div>
            {/* SIM Chip Icon */}
            <div className="w-10 h-8 rounded-md bg-gradient-to-br from-primary/80 to-primary-container border border-primary/20 flex flex-col justify-around p-1.5 overflow-hidden">
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
                <h2 className="font-display-lg text-[32px] md:text-[40px] text-primary font-bold tracking-tight">
                  {isVisible ? formattedBalance : "₦ •••,•••.••"}
                </h2>
                <button
                  onClick={() => setIsVisible(!isVisible)}
                  className="text-primary/40 hover:text-primary transition-colors p-1"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    {isVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </motion.div>
            </AnimatePresence>

            {/* Card Number Mockup */}
            <div className="flex gap-4 font-mono text-[14px] text-on-surface-variant/40 tracking-[0.2em]">
                <span>4582</span>
                <span>••••</span>
                <span>••••</span>
                <span>8921</span>
            </div>
          </div>

          {/* Bottom: User Name and Type */}
          <div className="flex justify-between items-end">
            <div>
                <p className="font-label-sm text-[10px] uppercase tracking-wider text-on-surface-variant/40 mb-1">Card Holder</p>
                <p className="font-label-sm text-[14px] text-on-surface uppercase tracking-widest font-bold">THE CAPTAIN</p>
            </div>
            <div className="flex flex-col items-end">
                 <span className="material-symbols-outlined text-primary text-[28px] opacity-80" style={{ fontVariationSettings: '"FILL" 1' }}>diamond</span>
                 <p className="font-label-sm text-[10px] text-primary/60 font-bold uppercase tracking-tighter">Infinite</p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Below Card */}
      <div className="mt-6 flex gap-3">
        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-grow py-4 bg-secondary-container/30 border border-secondary/20 backdrop-blur-md rounded-2xl flex items-center justify-center gap-2 hover:bg-secondary-container/40 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-secondary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-secondary text-[18px]">add</span>
          </div>
          <span className="font-label-sm text-[12px] text-secondary tracking-widest uppercase font-bold">
            Add Money
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.95 }}
          className="flex-grow py-4 bg-surface-variant/30 border border-primary/20 backdrop-blur-md rounded-2xl flex items-center justify-center gap-2 hover:bg-surface-variant/40 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <span className="material-symbols-outlined text-primary text-[18px]">send</span>
          </div>
          <span className="font-label-sm text-[12px] text-primary tracking-widest uppercase font-bold">
            Transfer
          </span>
        </motion.button>
      </div>
    </motion.section>
  );
};
