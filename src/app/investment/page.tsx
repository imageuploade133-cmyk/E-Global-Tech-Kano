"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

interface InvestmentProduct {
  id: string;
  name: string;
  type: "SAVINGS" | "FIXED_DEPOSIT";
  apr: number; // e.g. 0.085 for 8.5%
  durationDays: number;
  interestType: "SIMPLE" | "COMPOUND";
  status: "ACTIVE" | "INACTIVE";
}

interface ActiveInvestment {
  id: string;
  userId: string;
  type: "SAVINGS" | "FIXED_DEPOSIT";
  amount: number;
  currency: string;
  startDate: string;
  maturityDate: string;
  interestRate: number;
  interestType: "SIMPLE" | "COMPOUND";
  accumulatedInterest: number;
  totalValue: number;
  status: "ACTIVE" | "MATURED" | "CLAIMED" | "CANCELLED";
  optionId: string;
  optionName: string;
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_PRODUCTS: InvestmentProduct[] = [
  {
    id: "vault-flex",
    name: "Flexi Wealth Vault",
    type: "SAVINGS",
    apr: 0.085,
    durationDays: 30,
    interestType: "SIMPLE",
    status: "ACTIVE"
  },
  {
    id: "vault-pro",
    name: "Pro Yield Vault",
    type: "FIXED_DEPOSIT",
    apr: 0.125,
    durationDays: 90,
    interestType: "SIMPLE",
    status: "ACTIVE"
  },
  {
    id: "vault-elite",
    name: "Elite Compounder",
    type: "FIXED_DEPOSIT",
    apr: 0.18,
    durationDays: 365,
    interestType: "COMPOUND",
    status: "ACTIVE"
  }
];

export default function InvestmentPage() {
  const { userData, updateUserData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // DB-driven specs
  const [products, setProducts] = useState<InvestmentProduct[]>(DEFAULT_PRODUCTS);
  const [penaltyRate, setPenaltyRate] = useState<number>(0.10); // 10% Early Cancellation Penalty
  const [minInvestment, setMinInvestment] = useState<number>(1000);
  const [maxInvestment, setMaxInvestment] = useState<number>(10000000);

  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  // States for creation
  const [selectedProductId, setSelectedProductId] = useState<string>("vault-flex");
  const [amountStr, setAmountStr] = useState<string>("");
  const [maturityDate, setMaturityDate] = useState<string>("");
  const [walletTypeSelected, setWalletTypeSelected] = useState<"MAIN" | "BONUS">("MAIN");

  // Active holdings
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);

  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedCancelId, setSelectedCancelId] = useState<string>("");

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLiquidating, setIsLiquidating] = useState<boolean>(false);

  // Sync state with browser back history (device physical/swipe back button support)
  const hasPushedState = React.useRef(false);

  useEffect(() => {
    if (showConfirmModal || showCancelModal) {
      window.history.pushState({ modalOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        setShowConfirmModal(false);
        setShowCancelModal(false);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [showConfirmModal, showCancelModal]);

  // Prevent background scroll when investment confirm or cancel modals are open
  useEffect(() => {
    if (showConfirmModal || showCancelModal) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showConfirmModal, showCancelModal]);

  // Load specs and records from dynamic backend or sessionStorage fallback
  const loadInvestmentData = async () => {
    const isMock = sessionStorage.getItem("mock") === "true";

    if (isMock) {
      setIsLoadingProducts(false);
      setIsLoadingHistory(false);
      const saved = sessionStorage.getItem("active_investments");
      if (saved) {
        try {
          setInvestments(JSON.parse(saved));
        } catch (err) {
          console.error("Failed to parse investments from storage", err);
        }
      }
      return;
    }

    if (!user) return;

    try {
      setIsLoadingProducts(true);
      setIsLoadingHistory(true);

      const idToken = await user.getIdToken();

      // Fetch dynamic configuration
      const configRes = await fetch("/api/investments/settings", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (configRes.ok) {
        const configData = await configRes.json();
        if (configData.success && configData.settings) {
          setPenaltyRate(configData.settings.penaltyRate ?? 0.10);
          setMinInvestment(configData.settings.minInvestment ?? 1000);
          setMaxInvestment(configData.settings.maxInvestment ?? 10000000);
        }
      }

      // Fetch dynamic products and rates
      const productsRes = await fetch("/api/investments/interest-rates", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        if (productsData.success && Array.isArray(productsData.rates)) {
          setProducts(productsData.rates);
          if (productsData.rates.length > 0) {
            setSelectedProductId(productsData.rates[0].id);
          }
        }
      }
      setIsLoadingProducts(false);

      // Fetch dynamic active user holdings
      const holdingsRes = await fetch("/api/investments", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      if (holdingsRes.ok) {
        const holdingsData = await holdingsRes.json();
        if (holdingsData.success && Array.isArray(holdingsData.investments)) {
          setInvestments(holdingsData.investments);
        }
      }
      setIsLoadingHistory(false);
    } catch (err) {
      console.error("Failed to load backend investment records:", err);
      setIsLoadingProducts(false);
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadInvestmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const selectedProduct = products.find(p => p.id === selectedProductId) || products[0] || DEFAULT_PRODUCTS[0];
  const mainBalance = (userData?.balance as number) ?? 0;
  const bonusBalance = (userData?.bonusBalance as number) ?? 0;
  const userBalance = walletTypeSelected === "BONUS" ? bonusBalance : mainBalance;

  // Real-time server-side mimicking reward calculation for display
  const getEstimatedReward = () => {
    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0 || !maturityDate) return 0;

    const start = new Date();
    const end = new Date(maturityDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    if (selectedProduct.interestType === "SIMPLE") {
      const reward = amt * selectedProduct.apr * (diffDays / 365);
      return parseFloat(reward.toFixed(2));
    } else {
      const reward = amt * (Math.pow(1 + selectedProduct.apr / 365, diffDays) - 1);
      return parseFloat(reward.toFixed(2));
    }
  };

  const getInvestmentDays = () => {
    if (!maturityDate) return 0;
    const start = new Date();
    const end = new Date(maturityDate);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Form Prevalidation
  const handlePrevalidate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);

    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid investment amount");
      return;
    }

    if (amt < minInvestment) {
      toast.error(`Minimum investment limit is ₦${minInvestment.toLocaleString()}`);
      return;
    }

    if (amt > maxInvestment) {
      toast.error(`Maximum investment limit is ₦${maxInvestment.toLocaleString()}`);
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

    const minMaturity = new Date();
    minMaturity.setDate(minMaturity.getDate() + selectedProduct.durationDays);
    const chosenDate = new Date(maturityDate);

    if (chosenDate < minMaturity) {
      toast.error(`Maturity date must be at least ${selectedProduct.durationDays} days from today for this plan.`);
      return;
    }

    setShowConfirmModal(true);
  };

  // Confirm Lock Setup
  const handleConfirmInvestment = async () => {
    setIsSubmitting(true);
    const amt = parseFloat(amountStr);
    const estimatedReward = getEstimatedReward();

    try {
      const isMock = sessionStorage.getItem("mock") === "true";

      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 1500));

        const nextBalance = userBalance - amt;
        await updateUserData({ balance: nextBalance });

        const newInvest: ActiveInvestment = {
          id: "INV-" + Math.floor(100000 + Math.random() * 900000),
          userId: user?.uid || "mock-user",
          type: selectedProduct.type,
          amount: amt,
          currency: "NGN",
          startDate: new Date().toISOString(),
          maturityDate: new Date(maturityDate).toISOString(),
          interestRate: selectedProduct.apr,
          interestType: selectedProduct.interestType,
          accumulatedInterest: estimatedReward,
          totalValue: amt + estimatedReward,
          status: "ACTIVE",
          optionId: selectedProduct.id,
          optionName: selectedProduct.name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const updatedList = [newInvest, ...investments];
        setInvestments(updatedList);
        sessionStorage.setItem("active_investments", JSON.stringify(updatedList));

        toast.success("Investment Vault locked successfully!");
      } else {
        if (!user) {
          toast.error("Authentication required.");
          setIsSubmitting(false);
          return;
        }

        const idToken = await user.getIdToken();
        const endpoint = selectedProduct.type === "SAVINGS" ? "/api/investments/savings" : "/api/investments/fixed-deposit";

        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            amount: amt,
            currency: "NGN",
            productId: selectedProduct.id,
            walletType: walletTypeSelected,
          })
        });

        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(data.message || "Investment Vault locked successfully!");
          await loadInvestmentData();
        } else {
          toast.error(data.error || "Failed to establish secure vault lock.");
          setIsSubmitting(false);
          return;
        }
      }

      setAmountStr("");
      setMaturityDate("");
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Investment Error:", err);
      toast.error("Failed to secure vault nodes. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Claim Earnings
  const handleClaim = async (invId: string) => {
    const isMock = sessionStorage.getItem("mock") === "true";
    toast.loading("Processing your maturity claim payout on ledger rails...");

    try {
      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const matched = investments.find(inv => inv.id === invId);
        if (!matched) {
          toast.dismiss();
          toast.error("Investment lock not found.");
          return;
        }

        const payout = matched.amount + matched.accumulatedInterest;
        await updateUserData({ balance: userBalance + payout });

        const updated = investments.map(inv => {
          if (inv.id === invId) {
            return { ...inv, status: "CLAIMED" as const };
          }
          return inv;
        });

        setInvestments(updated);
        sessionStorage.setItem("active_investments", JSON.stringify(updated));

        toast.dismiss();
        toast.success(`Claim successful! ₦${payout.toLocaleString()} credited to wallet.`);
      } else {
        if (!user) return;
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/investments/${invId}/claim`, {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` }
        });

        const data = await res.json();
        toast.dismiss();

        if (res.ok && data.success) {
          toast.success(data.message);
          await loadInvestmentData();
        } else {
          toast.error(data.error || "Maturity claim processing failed.");
        }
      }
    } catch (err) {
      console.error("Claim Exception:", err);
      toast.dismiss();
      toast.error("Network error during payout claim execution.");
    }
  };

  // Open Cancel Penalty Confirmation Warning
  const triggerCancelPrompt = (invId: string) => {
    setSelectedCancelId(invId);
    setShowCancelModal(true);
  };

  // Early Cancel Execution
  const handleEarlyCancel = async () => {
    setIsLiquidating(true);
    const isMock = sessionStorage.getItem("mock") === "true";

    try {
      if (isMock) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        const matched = investments.find(inv => inv.id === selectedCancelId);
        if (!matched) {
          setIsLiquidating(false);
          setShowCancelModal(false);
          toast.error("Investment lock not found.");
          return;
        }

        const penalty = Number((matched.amount * penaltyRate).toFixed(2));
        const refund = Math.max(0, matched.amount - penalty);

        await updateUserData({ balance: userBalance + refund });

        const updated = investments.map(inv => {
          if (inv.id === selectedCancelId) {
            return { ...inv, status: "CANCELLED" as const, totalValue: refund };
          }
          return inv;
        });

        setInvestments(updated);
        sessionStorage.setItem("active_investments", JSON.stringify(updated));

        toast.success(`Early cancellation success! Penalty: ₦${penalty.toLocaleString()}. Refunded: ₦${refund.toLocaleString()}`);
      } else {
        if (!user) return;
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/investments/${selectedCancelId}/cancel`, {
          method: "POST",
          headers: { Authorization: `Bearer ${idToken}` }
        });

        const data = await res.json();
        if (res.ok && data.success) {
          toast.success(data.message);
          await loadInvestmentData();
        } else {
          toast.error(data.error || "Early cancellation request failed.");
        }
      }
      setShowCancelModal(false);
    } catch (err) {
      console.error("Cancel Exception:", err);
      toast.error("Network connection failure during early liquidation.");
    } finally {
      setIsLiquidating(false);
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Header Title Section */}
          <div className="flex items-center gap-3 mb-6 animate-fade-in">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                trending_up
              </span>
            </div>
            <div>
              <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black">
                Investment & Savings Center
              </h1>
              <p className="font-hanken text-[11px] text-gray-500 font-bold leading-none mt-1">
                Lock capital, grow earnings, compounding yield
              </p>
            </div>
          </div>

          {/* Current Available Balance */}
          <div className="bg-gradient-to-br from-[#111] to-[#222] rounded-[24px] p-5 text-white mb-6 border border-white/5 shadow-md animate-fade-in">
            <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider">
              Your Available {walletTypeSelected === "BONUS" ? "Bonus" : "Main"} Wallet Balance
            </p>
            <p className="font-bodoni text-[26px] font-bold mt-1 text-[#FC7A00]">
              ₦{userBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
            <div className="flex items-center gap-1.5 mt-2 bg-white/5 rounded-lg px-2 py-1 w-fit">
              <span className="material-symbols-outlined text-[13px] text-green-400">
                lock
              </span>
              <p className="font-hanken text-[9px] text-gray-300 font-semibold">
                Your money is completely safe and secure.
              </p>
            </div>
          </div>

          {/* Form Create Investment Container */}
          <form onSubmit={handlePrevalidate} className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] mb-6 animate-fade-in">
            <h2 className="font-bodoni text-[15px] font-bold text-black mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">
                add_task
              </span>
              Start Saving & Earning
            </h2>

            {/* Premium Wallet Selector */}
            <div className="mb-5">
              <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                Select Sourcing Wallet
              </label>
              <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                <button
                  type="button"
                  onClick={() => setWalletTypeSelected("MAIN")}
                  className={`py-3 rounded-xl font-hanken text-[11px] font-bold transition-all ${
                    walletTypeSelected === "MAIN"
                      ? "bg-black text-white shadow-md"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Main (₦{mainBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </button>
                <button
                  type="button"
                  onClick={() => setWalletTypeSelected("BONUS")}
                  className={`py-3 rounded-xl font-hanken text-[11px] font-bold transition-all ${
                    walletTypeSelected === "BONUS"
                      ? "bg-black text-white shadow-md"
                      : "text-gray-500 hover:text-black"
                  }`}
                >
                  Bonus (₦{bonusBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                </button>
              </div>
              {walletTypeSelected === "BONUS" && (
                <p className="font-hanken text-[9.5px] text-gray-500 mt-2 leading-relaxed">
                  * Investing with bonus funds requires a minimum of ₦3,000 NGN in your main wallet or cumulative deposits.
                </p>
              )}
            </div>

            {/* Select Options Scroll */}
            <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Choose Your Savings Plan
            </label>

            {isLoadingProducts ? (
              <div className="flex flex-col gap-2 mb-5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-shimmer h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mb-5">
                {products.map((opt) => {
                  const isSelected = selectedProductId === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setSelectedProductId(opt.id);
                        setAmountStr(""); // Clear so min check triggers accurately per scheme
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-[#FFF9F5] shadow-sm"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg bg-gradient-to-br from-[#FC7A00] to-[#FF9E43] text-white flex items-center justify-center shadow-inner`}>
                          <span className="material-symbols-outlined text-[18px]">
                            {opt.type === "SAVINGS" ? "savings" : "lock_clock"}
                          </span>
                        </div>
                        <div>
                          <h3 className="font-hanken text-[12.5px] font-bold text-black leading-snug">
                            {opt.name}
                          </h3>
                          <p className="font-hanken text-[10px] text-gray-500 font-semibold uppercase">
                            {opt.type} | {opt.interestType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block font-hanken text-[14.5px] font-extrabold text-primary">
                          {(opt.apr * 100).toFixed(1)}% APR
                        </span>
                        <span className="font-hanken text-[9px] text-gray-400 font-bold uppercase tracking-wider">
                          Interest Rate
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Selected Option Description */}
            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 mb-5">
              <p className="font-hanken text-[10.5px] text-gray-600 leading-relaxed font-medium">
                {selectedProduct.type === "SAVINGS"
                  ? "Standard Savings Vault with high-liquidity access. Earn interest based on your deposit duration with Simple Interest compounding configurations."
                  : "Fixed Deposit plan with highly secure locked-in yields. Perfect for long-term compounding growth."
                }
              </p>
            </div>

            {/* Form Fields: Amount */}
            <div className="mb-4">
              <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                How much do you want to save? (₦)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-hanken text-[14px] font-bold text-gray-400">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder={`Min ₦${minInvestment.toLocaleString()}`}
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-12 py-3.5 bg-white border border-black rounded-2xl text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
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
                When do you want to unlock your savings? (Pick a Date)
              </label>
              <input
                type="date"
                value={maturityDate}
                onChange={(e) => setMaturityDate(e.target.value)}
                min={new Date(Date.now() + selectedProduct.durationDays * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                className="w-full max-w-full box-border px-4 py-3.5 bg-white border border-black rounded-2xl text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
              />
            </div>

            {/* Live Reward Calculation Summary */}
            {amountStr && maturityDate && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-[#FFFBF7] to-[#FFF7EF] border border-[#FFECD8] animate-fade-in">
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                  Your Estimated Earnings
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-medium font-bold">Extra Interest You Earn</span>
                    <span className="font-hanken text-[15px] font-extrabold text-green-600">
                      +₦{getEstimatedReward().toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-medium font-bold">Time Locked</span>
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
              Confirm & Start Savings
            </button>
          </form>

          {/* Active Vault list */}
          <div className="animate-fade-in">
            <h2 className="font-bodoni text-[15px] font-bold text-black mb-3 flex items-center gap-1.5 px-0.5">
              <span className="material-symbols-outlined text-green-500 text-[18px]">
                lock_clock
              </span>
              My Active Savings ({investments.length})
            </h2>

            {isLoadingHistory ? (
              <div className="flex flex-col gap-3">
                {[1, 2].map((n) => (
                  <div key={n} className="skeleton-shimmer h-32 w-full rounded-2xl" />
                ))}
              </div>
            ) : investments.length === 0 ? (
              <div className="bg-white rounded-[24px] border border-gray-100 p-8 text-center flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                <span className="material-symbols-outlined text-gray-300 text-[36px] mb-2">
                  hourglass_empty
                </span>
                <p className="font-hanken text-[12px] font-bold text-black mb-1">
                  No Active Savings
                </p>
                <p className="font-hanken text-[10px] text-gray-400 leading-relaxed max-w-[220px]">
                  Pick a savings plan above to securely lock and grow your savings.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {investments.map((inv) => {
                  const isMatured = new Date() >= new Date(inv.maturityDate);
                  const isTerminal = inv.status === "CLAIMED" || inv.status === "CANCELLED";

                  return (
                    <div
                      key={inv.id}
                      className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-in"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded font-hanken text-[8px] font-extrabold uppercase tracking-wide mb-1.5 ${
                            inv.status === "CLAIMED"
                              ? "bg-blue-50 text-blue-600"
                              : inv.status === "CANCELLED"
                              ? "bg-red-50 text-red-600"
                              : isMatured
                              ? "bg-yellow-50 text-yellow-600 animate-pulse"
                              : "bg-green-50 text-green-600"
                          }`}>
                            <span className="material-symbols-outlined text-[10px]">
                              {inv.status === "CLAIMED" ? "check_circle" : inv.status === "CANCELLED" ? "cancel" : "lock"}
                            </span>
                            {inv.status}
                          </span>
                          <h3 className="font-hanken text-[12.5px] font-extrabold text-black leading-snug">
                            {inv.optionName}
                          </h3>
                          <span className="font-hanken text-[9px] text-gray-400 font-semibold">
                            {inv.id}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block font-hanken text-[13.5px] font-extrabold text-black">
                            ₦{inv.amount.toLocaleString()}
                          </span>
                          <span className="font-hanken text-[9.5px] text-green-600 font-extrabold">
                            +{(inv.interestRate * 100).toFixed(1)}% {inv.interestType}
                          </span>
                        </div>
                      </div>

                      <div className="border-t border-gray-50 pt-3 flex items-center justify-between">
                        <div>
                          <span className="block font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wide">
                            Start Date
                          </span>
                          <span className="font-hanken text-[10px] font-semibold text-gray-600">
                            {new Date(inv.startDate).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="block font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wide">
                            Maturity Date
                          </span>
                          <span className="font-hanken text-[10px] font-extrabold text-primary">
                            {new Date(inv.maturityDate).toLocaleDateString()}
                          </span>
                        </div>
                      </div>

                      {/* Interactive Payout/Cancel Buttons for Active Locks */}
                      {!isTerminal && (
                        <div className="mt-3 flex gap-2 pt-1">
                          {isMatured ? (
                            <button
                              type="button"
                              onClick={() => handleClaim(inv.id)}
                              className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-hanken text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                            >
                              <span className="material-symbols-outlined text-[14px]">payments</span>
                              Claim Matured Payout
                            </button>
                          ) : (
                            <>
                              <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 flex items-center gap-1 justify-center border border-gray-100">
                                <span className="material-symbols-outlined text-[11px] text-primary animate-spin">
                                  progress_activity
                                </span>
                                <p className="font-hanken text-[9px] text-gray-500 font-bold">
                                  Growing secure yields...
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => triggerCancelPrompt(inv.id)}
                                className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg font-hanken text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-1 active:scale-95 transition-all"
                              >
                                <span className="material-symbols-outlined text-[13px]">block</span>
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>

        <BottomNav />

        {/* Locked Agreement Confirmation Modal */}
        <AnimatePresence>
          {showConfirmModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => !isSubmitting && setShowConfirmModal(false)} />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="relative bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-gray-100 z-10 max-h-[92dvh] overflow-y-auto no-scrollbar touch-none select-none"
              >
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-red-50 border border-red-100 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-red-500 text-[28px] animate-pulse">
                      gavel
                    </span>
                  </div>
                  <h3 className="font-bodoni text-[18px] font-bold text-black">
                    Locked Savings Plan Rules
                  </h3>
                  <p className="font-hanken text-[11px] text-gray-500 max-w-[280px] mt-1 font-semibold leading-relaxed">
                    Please read these simple rules before you lock your savings.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-5">
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Savings Plan</span>
                    <span className="text-black font-bold">{selectedProduct.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Amount Saved</span>
                    <span className="text-black font-bold">₦{parseFloat(amountStr).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Withdrawal Date</span>
                    <span className="text-[#FC7A00] font-extrabold">{new Date(maturityDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Extra Interest You Earn</span>
                    <span className="text-green-600 font-extrabold">+{getEstimatedReward().toLocaleString()} ({(selectedProduct.apr * 100).toFixed(1)}%)</span>
                  </div>
                </div>

                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-6">
                  <h4 className="font-hanken text-[11px] font-extrabold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    SECURE SAVINGS RULES
                  </h4>
                  <ul className="list-disc list-inside space-y-1 font-hanken text-[10px] text-gray-600 font-semibold leading-relaxed">
                    <li>This savings plan is fully locked and automatic.</li>
                    <li>Early cancellations are allowed but carry a <strong>{(penaltyRate * 100).toFixed(0)}% liquidation penalty</strong>.</li>
                    <li>Your money and extra interest rewards will return directly to your main wallet balance on <strong className="text-black">{new Date(maturityDate).toLocaleDateString()}</strong>.</li>
                  </ul>
                </div>

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

        {/* Penalty Warning Cancel Confirmation Modal */}
        <AnimatePresence>
          {showCancelModal && (
            <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
              <div className="absolute inset-0" onClick={() => !isLiquidating && setShowCancelModal(false)} />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="relative bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-gray-100 z-10"
              >
                <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

                <div className="flex flex-col items-center text-center mb-5">
                  <div className="w-14 h-14 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mb-3">
                    <span className="material-symbols-outlined text-orange-500 text-[28px] animate-bounce">
                      warning
                    </span>
                  </div>
                  <h3 className="font-bodoni text-[18px] font-bold text-black">
                    Confirm Early Withdrawal
                  </h3>
                  <p className="font-hanken text-[11px] text-gray-500 max-w-[280px] mt-1 font-semibold leading-relaxed">
                    Withdrawing funds before the maturity date incurs an early-termination penalty.
                  </p>
                </div>

                <div className="bg-orange-50 border border-orange-100 rounded-xl p-4 mb-6">
                  <h4 className="font-hanken text-[11px] font-extrabold text-orange-700 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    PENALTY DETAILS
                  </h4>
                  <ul className="list-disc list-inside space-y-1 font-hanken text-[10px] text-gray-700 font-semibold leading-relaxed">
                    <li>An early withdrawal penalty of <strong>{(penaltyRate * 100).toFixed(0)}% of principal</strong> will be deducted.</li>
                    <li>Any accumulated interest will be forfeit.</li>
                    <li>The remaining refunded capital will be credited instantly back to your available wallet.</li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={isLiquidating}
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-3 border border-gray-200 text-gray-500 hover:text-black rounded-xl font-hanken text-[12.5px] font-bold tracking-wide active:scale-95 transition-all disabled:opacity-50"
                  >
                    Keep Savings locked
                  </button>
                  <button
                    type="button"
                    disabled={isLiquidating}
                    onClick={handleEarlyCancel}
                    className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-hanken text-[12.5px] font-bold tracking-wide active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                  >
                    {isLiquidating ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                        <span>Withdrawing...</span>
                      </>
                    ) : (
                      <>
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        <span>Accept & Liquidate</span>
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
