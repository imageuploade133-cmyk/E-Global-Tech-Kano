"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";

interface BalanceCardProps {
  balance: number;
  currency: string;
  userName?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, currency, userName }) => {
  const [isVisible, setIsVisible] = useState(true);
  const { userData, user } = useAuth();
  const { config } = useAppConfig();
  const [totalInvestment, setTotalInvestment] = useState<number>(0);

  // Safely calculate active locked savings from sessionStorage
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("active_investments");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const sum = list.reduce((acc: number, curr: { amount: number }) => acc + (parseFloat(curr.amount.toString()) || 0), 0);
            setTotalInvestment(sum);
          }
        } catch {
          // ignore
        }
      }
    }

    // Set up custom listener/interval to sync investment updates in real-time
    const interval = setInterval(() => {
      const saved = sessionStorage.getItem("active_investments");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const sum = list.reduce((acc: number, curr: { amount: number }) => acc + (parseFloat(curr.amount.toString()) || 0), 0);
            setTotalInvestment(sum);
          }
        } catch {
          // ignore
        }
      } else {
        setTotalInvestment(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  const balanceStr = isVisible ? formattedBalance : "₦ •••,•••.••";

  // Highly robust dynamic font size scaling based on balance length to prevent any overflow
  let fontSizeClass = "text-[20px] min-[360px]:text-[24px] min-[400px]:text-[30px] md:text-[36px] lg:text-[40px]";
  if (balanceStr.length > 24) {
    fontSizeClass = "text-[12px] min-[360px]:text-[14px] min-[400px]:text-[16px]";
  } else if (balanceStr.length > 20) {
    fontSizeClass = "text-[14px] min-[360px]:text-[16px] min-[400px]:text-[18px]";
  } else if (balanceStr.length > 16) {
    fontSizeClass = "text-[16px] min-[360px]:text-[18px] min-[400px]:text-[20px]";
  } else if (balanceStr.length > 12) {
    fontSizeClass = "text-[18px] min-[360px]:text-[21px] min-[400px]:text-[24px]";
  }

  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [addAmount, setAddAmount] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);

  const handlePresetClick = (val: number) => {
    setAddAmount(val.toString());
  };

  const handleAddMoneySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(addAmount);

    if (isNaN(parsedAmount) || parsedAmount < 100) {
      toast.error("Minimum allowed funding amount is ₦100.00");
      return;
    }

    setIsInitializing(true);
    toast.loading("Contacting Flutterwave secure payment gateway...");

    try {
      const payload = {
        amount: parsedAmount,
        currency: "NGN",
        email: user?.email || "captain@example.com",
        name: userData?.name || user?.displayName || "Captain Wallet",
        userId: user?.uid || "anon",
        redirectUrl: `${window.location.origin}/?verify=flw`,
      };

      const res = await fetch("/api/flutterwave/initialize-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      toast.dismiss();

      if (data.success && data.paymentLink) {
        toast.success("Redirecting to Flutterwave checkout...");
        // Redirect browser to Flutterwave secure checkout portal
        window.location.href = data.paymentLink;
      } else {
        toast.error(data.error || "Failed to initialize Flutterwave transaction link.");
      }
    } catch {
      toast.dismiss();
      toast.error("Internal connection error while generating checkout page.");
    } finally {
      setIsInitializing(false);
    }
  };

  return (
    <>
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-stack-lg text-black w-full"
    >
      {/* Physical Card Design - optimized vertically and horizontally to prevent spilling */}
      <div className="relative aspect-[1.586/1] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 group min-h-[175px] min-[360px]:min-h-[195px]">
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

        <div className="relative h-full p-3.5 min-[360px]:p-5 md:p-6 flex flex-col justify-between z-10 w-full overflow-hidden">
          {/* Top Row: Label and Chip */}
          <div className="flex justify-between items-start gap-2 w-full overflow-hidden flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="relative w-4.5 h-4.5 min-[360px]:w-5 min-[360px]:h-5 flex-shrink-0 bg-white/10 rounded-sm p-0.5">
                  <img
                    src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
                    alt="E-Tech Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-label-sm text-[8px] min-[360px]:text-[10px] uppercase tracking-[0.12em] text-[#FFFFFF] font-bold truncate">
                  E-TECH GLOBAL HUB
                </span>
              </div>
            </div>
            {/* SIM Chip Icon */}
            <div className="w-7 h-5 min-[360px]:w-9 min-[360px]:h-7 rounded-md bg-gradient-to-br from-[#FC7A00]/80 to-[#FFB870] border border-[#FC7A00]/20 flex flex-col justify-around p-1 overflow-hidden flex-shrink-0">
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
            </div>
          </div>

          {/* Middle: Balance & Available Label */}
          <div className="flex flex-col justify-center gap-0.5 w-full overflow-hidden my-auto py-1 flex-grow">
            <div className="flex justify-between items-center w-full">
              <p className="font-label-sm text-[8px] min-[360px]:text-[10px] text-[#FFFFFF]/70 font-medium">Available Balance</p>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[9px] text-[#FC7A00] font-bold">lock_clock</span>
                <span className="font-label-sm text-[7.5px] min-[360px]:text-[8.5px] text-[#FFFFFF]/95 font-bold uppercase tracking-wider">
                  Savings: ₦{isVisible ? totalInvestment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "•••,•••"}
                </span>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={isVisible ? "visible" : "hidden"}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center justify-between gap-1.5 w-full overflow-hidden"
              >
                <div className="flex-1 min-w-0">
                  <h2 className={`${fontSizeClass} font-display-lg text-[#FFFFFF] font-bold tracking-tight truncate leading-none`} title={formattedBalance}>
                    {balanceStr}
                  </h2>
                </div>
                <button
                  onClick={() => setIsVisible(!isVisible)}
                  className="text-[#FFFFFF]/80 hover:text-[#FFFFFF] transition-colors p-1 flex-shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] min-[360px]:text-[18px] text-[#FFFFFF] block leading-none">
                    {isVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom section: Card Number, User Name, Expiry/infinite badge */}
          <div className="space-y-1.5 w-full overflow-hidden flex-shrink-0">
            {/* Card Number Mockup - using ACCOUNT HOLDER name as the number */}
            <div className="font-mono text-[9px] min-[360px]:text-[11px] text-[#FFFFFF]/80 tracking-[0.15em] uppercase truncate max-w-full" title={resolvedName}>
              {resolvedName}
            </div>

            {/* Bottom: User Name and Type */}
            <div className="flex justify-between items-end gap-2 w-full overflow-hidden">
              <div className="flex-1 min-w-0">
                  <p className="font-label-sm text-[7px] min-[360px]:text-[8px] uppercase tracking-wider text-[#FFFFFF]/60 mb-0.5 font-medium truncate">Account Holder</p>
                  <p className="font-label-sm text-[10px] min-[360px]:text-[12px] text-[#FFFFFF] uppercase tracking-widest font-bold truncate leading-none" title={resolvedName}>
                    {resolvedName}
                  </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 bg-white/10 px-2 py-0.5 rounded border border-white/15 backdrop-blur-xs select-none">
                   <span className="font-mono text-[9px] min-[360px]:text-[11px] text-[#FFFFFF] font-black tracking-wider leading-none">NGN</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Below Card - Shadow removed as requested */}
      <div className="mt-4 min-[360px]:mt-5 flex gap-2.5 min-[360px]:gap-4">
        {/* Add Money - Deep Emerald Gradient based on #07B038 */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          onClick={() => setIsAddMoneyOpen(true)}
          className="flex-grow py-2.5 min-[360px]:py-3.5 px-2 bg-gradient-to-r from-[#045C1D] via-[#07B038] to-[#034A17] border border-white/10 rounded-xl min-[360px]:rounded-2xl flex items-center justify-center gap-1 min-[360px]:gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none min-w-0"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-5.5 h-5.5 min-[360px]:w-7 min-[360px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[12px] min-[360px]:text-[16px] font-bold block">add_card</span>
          </div>
          <span className="font-label-sm text-[10px] min-[360px]:text-[12px] text-white tracking-wide uppercase font-bold truncate">
            Add Money
          </span>
        </motion.button>

        {/* Transfer - Deep Sunset Orange Gradient based on #FC7A00 */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          className="flex-grow py-2.5 min-[360px]:py-3.5 px-2 bg-gradient-to-r from-[#B35200] via-[#FC7A00] to-[#8C4000] border border-white/10 rounded-xl min-[360px]:rounded-2xl flex items-center justify-center gap-1 min-[360px]:gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none min-w-0"
        >
          {/* Shine effect overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />

          <div className="w-5.5 h-5.5 min-[360px]:w-7 min-[360px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[12px] min-[360px]:text-[16px] font-bold block">send</span>
          </div>
          <span className="font-label-sm text-[10px] min-[360px]:text-[12px] text-white tracking-wide uppercase font-bold truncate">
            Transfer
          </span>
        </motion.button>
      </div>
    </motion.section>

    {/* Add Money Bottom Sheet Overlay Modal */}
    <AnimatePresence>
      {isAddMoneyOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsAddMoneyOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
          />

          {/* Bottom Sheet form */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 450 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={(event, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) {
                setIsAddMoneyOpen(false);
              }
            }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 shadow-none text-black overflow-hidden touch-none"
          >
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto cursor-grab" />

            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              <div className="w-8" />
              <h3 className="font-hanken font-bold text-base text-black text-center">
                Fund Wallet (Flutterwave)
              </h3>
              <button
                type="button"
                onClick={() => setIsAddMoneyOpen(false)}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
              </button>
            </div>

            <form onSubmit={handleAddMoneySubmit} className="space-y-5">
              {/* Amount input */}
              <div className="space-y-1.5 text-left">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Amount to Fund (NGN)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg text-gray-500">₦</span>
                  <input
                    type="number"
                    value={addAmount}
                    onChange={(e) => setAddAmount(e.target.value)}
                    placeholder="Enter amount (e.g. 5000)"
                    required
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-4 font-mono font-black text-lg text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
                  />
                </div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-1">Minimum funding threshold is ₦100.00</p>
              </div>

              {/* Preset Quick select buttons */}
              <div className="grid grid-cols-4 gap-2">
                {[1000, 5000, 10000, 20000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handlePresetClick(preset)}
                    className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-xs font-mono font-bold text-gray-800 rounded-xl transition-all cursor-pointer text-center"
                  >
                    +₦{preset / 1000}K
                  </button>
                ))}
              </div>

              {/* Action submission buttons */}
              <div className="flex flex-col gap-2.5 pt-3">
                <button
                  type="submit"
                  disabled={isInitializing}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
                >
                  {isInitializing ? "Initializing Gateway..." : "Continue to Checkout"}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMoneyOpen(false)}
                  className="w-full py-4 bg-white hover:bg-gray-50 border border-gray-200 text-black text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer active:scale-98 transition-all"
                >
                  Cancel
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
};
