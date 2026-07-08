"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
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
  }).format(balance);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="relative mb-stack-lg overflow-hidden rounded-xl bg-surface-container-high p-6 border border-white/5"
    >
      <div className="absolute inset-0 gold-shimmer pointer-events-none"></div>
      <div className="relative z-10">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-sm">
              verified_user
            </span>
            <span className="font-label-sm text-label-sm text-on-surface-variant/80">
              Available Balance
            </span>
            <button
              onClick={() => setIsVisible(!isVisible)}
              className="text-on-surface-variant/60 hover:text-on-surface-variant transition-colors flex items-center"
            >
              <span className="material-symbols-outlined text-base">
                {isVisible ? "visibility" : "visibility_off"}
              </span>
            </button>
          </div>
          <a
            className="flex items-center gap-1 font-label-sm text-label-sm text-primary hover:underline"
            href="#"
          >
            Transaction History
            <span className="material-symbols-outlined text-sm">
              chevron_right
            </span>
          </a>
        </div>
        <AnimatePresence mode="wait">
          <motion.h2
            key={isVisible ? "visible" : "hidden"}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(4px)" }}
            transition={{ duration: 0.2 }}
            className="font-display-lg text-[40px] leading-tight text-primary mb-6 font-bold"
          >
            {isVisible ? formattedBalance : "₦ •••,•••.••"}
          </motion.h2>
        </AnimatePresence>
        <div className="flex gap-3">
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex-grow py-4 bg-secondary-container emerald-glow rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all group"
          >
            <span className="material-symbols-outlined text-secondary group-hover:rotate-90 transition-transform">
              add
            </span>
            <span className="font-label-sm text-label-sm text-secondary tracking-widest uppercase font-bold">
              Add Money
            </span>
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            className="flex-grow py-4 bg-surface-variant border border-primary/30 rounded-xl flex items-center justify-center gap-2 hover:opacity-90 transition-all group"
          >
            <span className="material-symbols-outlined text-primary">send</span>
            <span className="font-label-sm text-label-sm text-primary tracking-widest uppercase font-bold">
              Transfer
            </span>
          </motion.button>
        </div>
      </div>
    </motion.section>
  );
};
