"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface InvestmentOption {
  id: string;
  name: string;
  apr: number; // Annual Percentage Rate in %
  icon: string;
  minAmount: number;
  description: string;
  bgGradient: string;
}

interface ActiveInvestment {
  id: string;
  optionName: string;
  amount: number;
  apr: number;
  reward: number;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "COMPLETED";
}

const INVESTMENT_OPTIONS: InvestmentOption[] = [
  {
    id: "premium_yield",
    name: "E-Tech Premium Yield",
    apr: 18.5,
    icon: "trending_up",
    minAmount: 5000,
    description: "High-yield compounding returns backed by diversified green-infrastructure assets.",
    bgGradient: "from-[#FC7A00] to-[#FF9E43]"
  },
  {
    id: "secure_crypto",
    name: "Secure Crypto Yield",
    apr: 24.0,
    icon: "currency_bitcoin",
    minAmount: 15000,
    description: "Premium locked liquidity rewards utilizing low-risk stablecoin market markers.",
    bgGradient: "from-[#111] to-[#333]"
  },
  {
    id: "green_bond",
    name: "Green Energy Bond",
    apr: 14.2,
    icon: "eco",
    minAmount: 2000,
    description: "Eco-friendly fixed income funding solar and local sustainable development grids.",
    bgGradient: "from-[#11998e] to-[#38ef7d]"
  }
];

export default function InvestmentPage() {
  const { userData, updateUserData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // States for creation
  const [selectedOptionId, setSelectedOptionId] = useState<string>(INVESTMENT_OPTIONS[0].id);
  const [amountStr, setAmountStr] = useState<string>("");
  const [maturityDate, setMaturityDate] = useState<string>("");

  // Active state lists from sessionStorage
  const [activeInvestments, setActiveInvestments] = useState<ActiveInvestment[]>([]);

  // Agreement Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Submitting Loader
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load investments from local storage
  useEffect(() => {
    const saved = sessionStorage.getItem("active_investments");
    if (saved) {
      try {
        setActiveInvestments(JSON.parse(saved));
      } catch (err) {
        console.error("Failed to parse investments from storage", err);
      }
    }
  }, []);

  // Sync to Storage
  const saveInvestments = (items: ActiveInvestment[]) => {
    setActiveInvestments(items);
    sessionStorage.setItem("active_investments", JSON.stringify(items));
  };

  const selectedOption = INVESTMENT_OPTIONS.find(o => o.id === selectedOptionId) || INVESTMENT_OPTIONS[0];
  const userBalance = (userData?.balance as number) ?? 0;

  // Real-time Reward Calculator
  const getEstimatedReward = () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0 || !maturityDate) return 0;

    const start = new Date();
    const end = new Date(maturityDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    // APR Reward = Principal * (APR / 100) * (Days / 365)
    const reward = amt * (selectedOption.apr / 100) * (diffDays / 365);
    return parseFloat(reward.toFixed(2));
  };

  // Days Duration calculated
  const getInvestmentDays = () => {
    if (!maturityDate) return 0;
    const start = new Date();
    const end = new Date(maturityDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const handlePrevalidate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);

    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid investment amount");
      return;
    }

    if (amt < selectedOption.minAmount) {
      toast.error(`Minimum investment limit for this vault is ₦${selectedOption.minAmount.toLocaleString()}`);
      return;
    }

    if (amt > userBalance) {
      toast.error("Insufficient wallet balance for this investment amount");
      return;
    }

    if (!maturityDate) {
      toast.error("Please select a target maturity date");
      return;
    }

    // Minimum 7 days lockout lock restriction check
    const minMaturity = new Date();
    minMaturity.setDate(minMaturity.getDate() + 7);
    const chosenDate = new Date(maturityDate);

    if (chosenDate < minMaturity) {
      toast.error("The selected date must be at least 7 days from today to locked-in yield options.");
      return;
    }

    // Pass verification check, trigger native-fidelity confirmation agreement modal
    setShowConfirmModal(true);
  };

  const handleConfirmInvestment = async () => {
    setIsSubmitting(true);
    const amt = parseFloat(amountStr);
    const estimatedReward = getEstimatedReward();

    try {
      // Simulate high-fidelity ledger ledger locks
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Update local wallet balance state securely
      const nextBalance = userBalance - amt;
      await updateUserData({
        balance: nextBalance
      });

      // Construct lock item
      const newInvest: ActiveInvestment = {
        id: "INV-" + Math.floor(100000 + Math.random() * 900000),
        optionName: selectedOption.name,
        amount: amt,
        apr: selectedOption.apr,
        reward: estimatedReward,
        startDate: new Date().toLocaleDateString(),
        endDate: new Date(maturityDate).toLocaleDateString(),
        status: "ACTIVE"
      };

      const updatedList = [newInvest, ...activeInvestments];
      saveInvestments(updatedList);

      // Trigger success notifications
      toast.success("Locked-in Investment created successfully!");

      // Clear forms
      setAmountStr("");
      setMaturityDate("");
      setShowConfirmModal(false);
    } catch {
      toast.error("Failed to secure vault nodes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto px-margin-mobile pt-5">
          {/* Header Title Section */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                trending_up
              </span>
            </div>
            <div>
              <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black">
                Vault Yield
              </h1>
              <p className="font-hanken text-[11px] text-gray-500 font-medium">
                Locked-in high yield wealth compounds
              </p>
            </div>
          </div>

          {/* Balance card indicator */}
          <div className="bg-gradient-to-br from-[#111] to-[#222] rounded-[24px] p-5 text-white mb-6 border border-white/5 shadow-md">
            <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Available Investment Wallet Capital
            </p>
            <p className="font-bodoni text-[26px] font-bold mt-1 text-[#FC7A00]">
              ₦{userBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2 bg-white/5 rounded-lg px-2 py-1 w-fit">
              <span className="material-symbols-outlined text-[13px] text-green-400">
                lock
              </span>
              <p className="font-hanken text-[9px] text-gray-300 font-semibold">
                Protected and fully secured by Ledger Node contracts.
              </p>
            </div>
          </div>

          {/* Form Create Investment Container */}
          <form onSubmit={handlePrevalidate} className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] mb-6">
            <h2 className="font-bodoni text-[15px] font-bold text-black mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">
                add_task
              </span>
              Start New Fixed Vault
            </h2>

            {/* Select Options Scroll */}
            <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Choose Premium Growth Portfolio
            </label>
            <div className="flex flex-col gap-2.5 mb-5">
              {INVESTMENT_OPTIONS.map((opt) => {
                const isSelected = selectedOptionId === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      setSelectedOptionId(opt.id);
                      setAmountStr(""); // Clear so min check triggers accurately per scheme
                    }}
                    className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                      isSelected
                        ? "border-primary bg-[#FFF9F5] shadow-sm"
                        : "border-gray-100 hover:border-gray-200"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${opt.bgGradient} text-white flex items-center justify-center shadow-inner`}>
                        <span className="material-symbols-outlined text-[18px]">
                          {opt.icon}
                        </span>
                      </div>
                      <div>
                        <h3 className="font-hanken text-[12.5px] font-bold text-black leading-snug">
                          {opt.name}
                        </h3>
                        <p className="font-hanken text-[10px] text-gray-500 font-medium">
                          Min amount: ₦{opt.minAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="block font-hanken text-[14.5px] font-extrabold text-primary">
                        {opt.apr}% APR
                      </span>
                      <span className="font-hanken text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                        Growth Rate
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Selected Option Description */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 mb-5">
              <p className="font-hanken text-[10.5px] text-gray-600 leading-relaxed font-medium">
                {selectedOption.description}
              </p>
            </div>

            {/* Form Fields: Amount */}
            <div className="mb-4">
              <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Capital Amount to Invest (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-hanken text-[14px] font-bold text-gray-400">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder={`Min ₦${selectedOption.minAmount.toLocaleString()}`}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-12 py-3 bg-gray-50 border border-gray-200 rounded-xl font-hanken text-[14px] font-bold text-black focus:outline-none focus:border-primary focus:bg-white transition-all placeholder:text-gray-300 placeholder:font-medium"
                />
                <button
                  type="button"
                  onClick={() => setAmountStr(userBalance.toFixed(0))}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 font-hanken text-[10px] font-extrabold text-primary bg-[#FFF0E0] px-2 py-1 rounded-md active:scale-95 transition-all"
                >
                  MAX
                </button>
              </div>
            </div>

            {/* Maturity end date selectpicker */}
            <div className="mb-5">
              <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Target maturity end date (Locked term)
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                min={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]} // enforce 7 day min lockout dynamically
                className="w-full px-3.5 py-3 bg-gray-50 border border-gray-200 rounded-xl font-hanken text-[13px] font-semibold text-black focus:outline-none focus:border-primary focus:bg-white transition-all"
              />
            </div>

            {/* Live Reward Calculation Summary */}
            {amountStr && maturityDate && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-[#FFFBF7] to-[#FFF7EF] border border-[#FFECD8] animate-fade-in">
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                  Growth Reward Forecast
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-medium">Estimated Reward</span>
                    <span className="font-hanken text-[15px] font-extrabold text-green-600">
                      +₦{getEstimatedReward().toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-medium">Duration Locked</span>
                    <span className="font-hanken text-[13px] font-extrabold text-black">
                      {getInvestmentDays()} Days
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Trigger Button */}
            <button
              type="submit"
              className="w-full py-3.5 bg-primary text-white rounded-xl font-hanken text-[13px] font-bold tracking-wide active:scale-98 transition-all hover:bg-primary-dark shadow-[0_4px_15px_rgba(252,122,0,0.15)] flex items-center justify-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">
                verified
              </span>
              Initiate Yield Growth Lock
            </button>
          </form>

          {/* Active Vault list */}
          <div>
            <h2 className="font-bodoni text-[15px] font-bold text-black mb-3 flex items-center gap-1.5 px-0.5">
              <span className="material-symbols-outlined text-green-500 text-[18px]">
                lock_clock
              </span>
              Active Vaults ({activeInvestments.length})
            </h2>

            {activeInvestments.length === 0 ? (
              <div className="bg-white rounded-[24px] border border-gray-100 p-8 text-center flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                <span className="material-symbols-outlined text-gray-300 text-[36px] mb-2">
                  hourglass_empty
                </span>
                <p className="font-hanken text-[12px] font-bold text-black mb-1">
                  No Active Growth Locks
                </p>
                <p className="font-hanken text-[10px] text-gray-400 leading-relaxed max-w-[220px]">
                  Select a growth vault structure above to protect your capital and generate robust yield.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {activeInvestments.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#E8F8F0] font-hanken text-[8px] font-extrabold text-green-600 uppercase tracking-wide mb-1.5">
                          <span className="material-symbols-outlined text-[10px]">lock</span>
                          Locked
                        </span>
                        <h3 className="font-hanken text-[12.5px] font-extrabold text-black">
                          {inv.optionName}
                        </h3>
                        <span className="font-hanken text-[9px] text-gray-400 font-bold">
                          {inv.id}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-hanken text-[13.5px] font-extrabold text-black">
                          ₦{inv.amount.toLocaleString()}
                        </span>
                        <span className="font-hanken text-[9.5px] text-green-600 font-extrabold">
                          +{inv.apr}% APR
                        </span>
                      </div>
                    </div>

                    <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                      <div>
                        <span className="block font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wide">
                          Lock Start
                        </span>
                        <span className="font-hanken text-[10px] font-semibold text-gray-600">
                          {inv.startDate}
                        </span>
                      </div>
                      <div className="text-right">
                        <span className="block font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wide">
                          Unlocks On
                        </span>
                        <span className="font-hanken text-[10px] font-extrabold text-primary">
                          {inv.endDate}
                        </span>
                      </div>
                    </div>

                    {/* Pending unlock countdown indicator */}
                    <div className="mt-3 bg-gray-50 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 justify-center border border-gray-100">
                      <span className="material-symbols-outlined text-[12px] text-primary animate-spin">
                        progress_activity
                      </span>
                      <p className="font-hanken text-[9px] text-gray-500 font-bold">
                        Yield capital locked-in secure escrow node.
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        <BottomNav />

        {/* Locked Agreement Confirmation Modal (No withdrawal/cancel restriction) */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
              {/* Tap backdrop to close */}
              <div className="absolute inset-0" onClick={() => !isSubmitting && setShowConfirmModal(false)} />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="relative bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-gray-100 z-10 max-h-[92dvh] overflow-y-auto no-scrollbar"
              >
                {/* Drag handle line */}
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                {/* Secure warning emblem */}
                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-red-500 text-[28px] animate-pulse">
                      gavel
                    </span>
                  </div>
                  <h3 className="font-bodoni text-[18px] font-bold text-black">
                    Strict Vault Lock Agreement
                  </h3>
                  <p className="font-hanken text-[11px] text-gray-500 max-w-[280px] mt-1 font-semibold leading-relaxed">
                    Please read and verify the lock-in terms carefully before securing your yield vault.
                  </p>
                </div>

                {/* Investment specific lock bounds details */}
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-5">
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Growth Portfolio</span>
                    <span className="text-black font-bold">{selectedOption.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Locked Capital</span>
                    <span className="text-black font-bold">₦{parseFloat(amountStr).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Lock End Date</span>
                    <span className="text-[#FC7A00] font-extrabold">{new Date(maturityDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Growth Reward (Yield)</span>
                    <span className="text-green-600 font-extrabold">+{getEstimatedReward().toLocaleString()} ({selectedOption.apr}%)</span>
                  </div>
                </div>

                {/* Explicit Legal-Fidelity Terms Box */}
                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-6">
                  <h4 className="font-hanken text-[11px] font-extrabold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    LEGAL BINDING ESCROW TERMS
                  </h4>
                  <ul className="list-disc list-inside space-y-1 font-hanken text-[10px] text-gray-600 font-semibold leading-relaxed">
                    <li>This growth vault operates under cryptographic strict automated locks.</li>
                    <li><strong className="text-black">No early withdrawals or cancellations</strong> are allowed under any circumstances.</li>
                    <li>This growth structure ends precisely on <strong className="text-black">{new Date(maturityDate).toLocaleDateString()}</strong>. Your locked balance and generated rewards will return to your balance then.</li>
                  </ul>
                </div>

                {/* Action CTA with loading feedback */}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => setShowConfirmModal(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-500 hover:text-black rounded-xl font-hanken text-[12.5px] font-bold tracking-wide active:scale-95 transition-all disabled:opacity-50"
                  >
                    Cancel / Exit
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmInvestment}
                    className="flex-1 py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-hanken text-[12.5px] font-bold tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-[0_4px_15px_rgba(252,122,0,0.15)]"
                  >
                    {isSubmitting ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Securing Vault...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">verified</span>
                        <span>I Agree & Secure</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </RouteGuard>
  );
}
