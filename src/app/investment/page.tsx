"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { useAuth } from "@/lib/AuthContext";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import BannerSlideshow from "@/components/BannerSlideshow";
import { SavingsPlanData, DEFAULT_SAVINGS_PLANS } from "@/lib/savings-plans-types";

interface ActiveInvestment {
  id: string;
  investmentReference?: string;
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
  status: "ACTIVE" | "MATURED" | "CLAIM_REQUESTED" | "CLAIMED" | "CANCELLED";
  optionId: string;
  optionName: string;
  claimRequestedAt?: string;
  claimApprovedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export default function InvestmentPage() {
  const { userData, updateUserData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // DB-driven specs & Settings
  const [plans, setPlans] = useState<SavingsPlanData[]>(DEFAULT_SAVINGS_PLANS);
  const [penaltyRate, setPenaltyRate] = useState<number>(0.10); // Early Cancellation Penalty decimal (e.g. 0.10)
  const [penaltyPolicyText, setPenaltyPolicyText] = useState<string>(
    "Early liquidation of locked savings before the target unlock date incurs a 10% penalty on principal. The remaining 90% balance will be instantly refunded to your wallet."
  );
  const [allowBonusInvestment, setAllowBonusInvestment] = useState<boolean>(true);

  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState<boolean>(true);

  // Holding Navigation & Modal States
  const [activeHoldingTab, setActiveHoldingTab] = useState<"ACTIVE" | "HISTORY">("ACTIVE");
  const [historyFilter, setHistoryFilter] = useState<"ALL" | "CLAIMED" | "CANCELLED">("ALL");
  const [selectedDetailInv, setSelectedDetailInv] = useState<ActiveInvestment | null>(null);

  // States for creation
  const [selectedPlanId, setSelectedPlanId] = useState<string>("target-savings");
  const [amountStr, setAmountStr] = useState<string>("");
  const [walletTypeSelected, setWalletTypeSelected] = useState<"MAIN" | "BONUS">("MAIN");

  // UNLOCK DURATION STATES ("WHEN DO YOU WANT TO UNLOCK YOUR SAVINGS")
  const [unlockMode, setUnlockMode] = useState<"MONTHS" | "YEARS" | "CUSTOM">("MONTHS");
  const [selectedMonth, setSelectedMonth] = useState<number>(3);
  const [selectedYear, setSelectedYear] = useState<number>(1);
  const [customMaturityDate, setCustomMaturityDate] = useState<string>("");

  // Active holdings
  const [investments, setInvestments] = useState<ActiveInvestment[]>([]);

  // Modals
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [selectedCancelId, setSelectedCancelId] = useState<string>("");

  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());
  const [showCalendarModal, setShowCalendarModal] = useState<boolean>(false);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId) || plans[0] || DEFAULT_SAVINGS_PLANS[0];

  // Sync unlock options when selected plan changes
  useEffect(() => {
    if (selectedPlan) {
      if (selectedPlan.allowMonths && Array.isArray(selectedPlan.monthOptions) && selectedPlan.monthOptions.length > 0) {
        setUnlockMode("MONTHS");
        setSelectedMonth(selectedPlan.monthOptions[0]);
      } else if (selectedPlan.allowYears && Array.isArray(selectedPlan.yearOptions) && selectedPlan.yearOptions.length > 0) {
        setUnlockMode("YEARS");
        setSelectedYear(selectedPlan.yearOptions[0]);
      } else if (selectedPlan.allowCustom) {
        setUnlockMode("CUSTOM");
      }
    }
  }, [selectedPlanId, selectedPlan]);

  // Compute calculated lock days and maturity date
  const getCalculatedMaturityDate = (): Date => {
    const date = new Date();
    if (unlockMode === "MONTHS") {
      date.setMonth(date.getMonth() + (selectedMonth || 1));
    } else if (unlockMode === "YEARS") {
      date.setFullYear(date.getFullYear() + (selectedYear || 1));
    } else if (unlockMode === "CUSTOM" && customMaturityDate) {
      return new Date(customMaturityDate);
    } else {
      date.setDate(date.getDate() + (selectedPlan?.defaultDurationDays || 30));
    }
    return date;
  };

  const calculatedMaturityDateObj = getCalculatedMaturityDate();
  const calculatedMaturityDateStr = calculatedMaturityDateObj.toISOString().split("T")[0];

  const getCalculatedLockDays = (): number => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(calculatedMaturityDateObj);
    end.setHours(0, 0, 0, 0);
    const diffTime = end.getTime() - start.getTime();
    return Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  };

  const calculatedLockDays = getCalculatedLockDays();

  // Load plans and records
  const loadInvestmentData = async () => {
    try {
      setIsLoadingPlans(true);
      setIsLoadingHistory(true);

      // Fetch dynamic savings plans and global penalty policy
      const [plansRes, settingsRes] = await Promise.all([
        fetch("/api/investments/plans"),
        fetch("/api/investments/settings")
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        if (plansData.success && Array.isArray(plansData.plans) && plansData.plans.length > 0) {
          setPlans(plansData.plans);
          setSelectedPlanId(plansData.plans[0].id);
        }
      }

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.success && settingsData.settings) {
          if (settingsData.settings.penaltyRate !== undefined) {
            setPenaltyRate(Number(settingsData.settings.penaltyRate));
          }
          if (settingsData.settings.penaltyPolicyText) {
            setPenaltyPolicyText(settingsData.settings.penaltyPolicyText);
          }
          if (settingsData.settings.allowBonusInvestment !== undefined) {
            setAllowBonusInvestment(Boolean(settingsData.settings.allowBonusInvestment));
          }
        }
      }
      setIsLoadingPlans(false);

      if (user) {
        const idToken = await user.getIdToken();
        // Fetch user holdings
        const holdingsRes = await fetch("/api/investments", {
          headers: { Authorization: `Bearer ${idToken}` }
        });
        if (holdingsRes.ok) {
          const holdingsData = await holdingsRes.json();
          if (holdingsData.success && Array.isArray(holdingsData.investments)) {
            setInvestments(holdingsData.investments);
          }
        }
      }
      setIsLoadingHistory(false);
    } catch (err) {
      console.error("Failed to load backend investment records:", err);
      setIsLoadingPlans(false);
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadInvestmentData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const mainBalance = (userData?.balance as number) ?? 0;
  const bonusBalance = (userData?.bonusBalance as number) ?? 0;
  const userBalance = walletTypeSelected === "BONUS" ? bonusBalance : mainBalance;

  // Calculate active investments balance & daily yield income
  const activeInvestmentsList = investments.filter((i) => i.status === "ACTIVE");
  const totalActiveInvestmentBalance = activeInvestmentsList.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);

  // Calculate daily income generated across all active savings locks
  const totalDailyIncome = activeInvestmentsList.reduce((sum, inv) => {
    const principal = Number(inv.amount) || 0;
    const rate = Number(inv.interestRate) || 0;
    // Daily return = Principal * APR / 365
    const dailyReturn = (principal * rate) / 365;
    return sum + dailyReturn;
  }, 0);

  // Real-time server-side reward calculation
  const getEstimatedReward = () => {
    const amt = parseFloat(amountStr) || 0;
    if (amt <= 0) return 0;

    const aprDecimal = (selectedPlan.apr || 10) / 100;
    const diffDays = calculatedLockDays;

    if (selectedPlan.interestType === "SIMPLE") {
      const reward = amt * aprDecimal * (diffDays / 365);
      return parseFloat(reward.toFixed(2));
    } else {
      const reward = amt * (Math.pow(1 + aprDecimal / 365, diffDays) - 1);
      return parseFloat(reward.toFixed(2));
    }
  };

  // Form Prevalidation
  const handlePrevalidate = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amountStr);

    if (selectedPlan.isAmountRequired) {
      if (isNaN(amt) || amt <= 0) {
        toast.error("Please enter a valid investment amount");
        return;
      }

      if (amt < selectedPlan.minInvestment) {
        toast.error(`Minimum investment limit for ${selectedPlan.name} is ₦${selectedPlan.minInvestment.toLocaleString()}`);
        return;
      }

      if (amt > selectedPlan.maxInvestment) {
        toast.error(`Maximum investment limit for ${selectedPlan.name} is ₦${selectedPlan.maxInvestment.toLocaleString()}`);
        return;
      }

      if (amt > userBalance) {
        toast.error("Insufficient wallet balance for this investment amount");
        return;
      }
    }

    if (unlockMode === "CUSTOM") {
      if (!customMaturityDate) {
        toast.error("Please pick a custom unlock date from the calendar");
        return;
      }
      if (calculatedLockDays < selectedPlan.minCustomDays) {
        toast.error(`Custom lock duration must be at least ${selectedPlan.minCustomDays} days for this plan.`);
        return;
      }
      if (calculatedLockDays > selectedPlan.maxCustomDays) {
        toast.error(`Custom lock duration cannot exceed ${selectedPlan.maxCustomDays} days for this plan.`);
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isLiquidating, setIsLiquidating] = useState<boolean>(false);

  // Confirm Lock Setup
  const handleConfirmInvestment = async () => {
    setIsSubmitting(true);
    const amt = parseFloat(amountStr) || 0;

    try {
      if (!user) {
        toast.error("Authentication required.");
        setIsSubmitting(false);
        return;
      }

      const idToken = await user.getIdToken();
      const endpoint = selectedPlan.type === "SAVINGS" ? "/api/investments/savings" : "/api/investments/fixed-deposit";
      const idempotencyKey = `inv-${user.uid}-${Date.now()}`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
          "Idempotency-Key": idempotencyKey
        },
        body: JSON.stringify({
          amount: amt,
          currency: "NGN",
          productId: selectedPlan.id,
          walletType: walletTypeSelected,
          durationDays: calculatedLockDays,
          idempotencyKey,
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Savings locked successfully under ${selectedPlan.name}!`);
        await loadInvestmentData();
      } else {
        toast.error(data.error || "Failed to establish savings lock.");
        setIsSubmitting(false);
        return;
      }

      setAmountStr("");
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Investment Error:", err);
      toast.error("Failed to process savings lock. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Claim Earnings Request
  const handleClaim = async (invId: string) => {
    toast.loading("Submitting payout claim request...");

    try {
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
        toast.error(data.error || "Claim request submission failed.");
      }
    } catch {
      toast.dismiss();
      toast.error("Network error during payout claim execution.");
    }
  };

  // Early Cancel Execution
  const handleEarlyCancel = async () => {
    if (!selectedCancelId) return;
    setIsLiquidating(true);

    try {
      if (!user) {
        toast.error("Authentication required.");
        setIsLiquidating(false);
        return;
      }

      const idToken = await user.getIdToken();

      const res = await fetch(`/api/investments/${selectedCancelId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Savings lock liquidated successfully!");
        setShowCancelModal(false);
        await loadInvestmentData();
      } else {
        toast.error(data.error || "Early cancellation request failed.");
      }
    } catch {
      toast.error("Network connection failure during early liquidation.");
    } finally {
      setIsLiquidating(false);
    }
  };

  // Custom Calendar Modal Renderer
  const renderCalendarModal = () => {
    if (!showCalendarModal) return null;

    const minAllowedDate = new Date();
    minAllowedDate.setDate(minAllowedDate.getDate() + (selectedPlan.minCustomDays || 1));
    minAllowedDate.setHours(0, 0, 0, 0);

    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const startDayOfWeek = firstDayOfMonth.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const daysArray: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      daysArray.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      daysArray.push(new Date(year, month, day));
    }

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={() => setShowCalendarModal(false)} />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-gray-100 z-10"
        >
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-4" />

          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bodoni text-[16px] font-bold text-black flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[20px]">
                calendar_month
              </span>
              Pick Unlock Date
            </h3>
            <button
              type="button"
              onClick={() => setShowCalendarModal(false)}
              className="w-8 h-8 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          <div className="flex items-center justify-between mb-4 px-1">
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(year, month - 1, 1))}
              className="w-8 h-8 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_left</span>
            </button>
            <span className="font-hanken text-sm font-extrabold text-black">
              {monthNames[month]} {year}
            </span>
            <button
              type="button"
              onClick={() => setCalendarMonth(new Date(year, month + 1, 1))}
              className="w-8 h-8 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-1">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((dayName) => (
              <span key={dayName} className="font-hanken text-[10px] font-extrabold text-gray-400 uppercase tracking-wider py-1">
                {dayName}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-6">
            {daysArray.map((dayDate, idx) => {
              if (!dayDate) {
                return <div key={`empty-${idx}`} className="aspect-square" />;
              }

              const compareDate = new Date(dayDate);
              compareDate.setHours(0, 0, 0, 0);

              const isBeforeMin = compareDate < minAllowedDate;
              const formattedValue = dayDate.toISOString().split("T")[0];
              const isSelected = customMaturityDate === formattedValue;

              return (
                <button
                  key={formattedValue}
                  type="button"
                  disabled={isBeforeMin}
                  onClick={() => {
                    setCustomMaturityDate(formattedValue);
                    setShowCalendarModal(false);
                  }}
                  className={`aspect-square rounded-xl font-hanken text-xs font-bold transition-all flex flex-col items-center justify-center relative cursor-pointer ${
                    isSelected
                      ? "bg-primary text-white shadow-sm"
                      : isBeforeMin
                      ? "text-gray-300 bg-gray-50/50 cursor-not-allowed line-through"
                      : "text-black hover:bg-gray-100 active:scale-95"
                  }`}
                >
                  <span>{dayDate.getDate()}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => setShowCalendarModal(false)}
            className="w-full py-3.5 border border-gray-200 text-gray-500 hover:text-black rounded-xl font-hanken text-[12.5px] font-bold tracking-wide active:scale-95 transition-all"
          >
            Close Calendar
          </button>
        </motion.div>
      </div>
    );
  };

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Header Title Section with back button */}
          <div className="flex items-center gap-4 mb-5 animate-fade-in">
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  trending_up
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bodoni text-[18px] min-[375px]:text-[20px] font-bold tracking-tight text-black truncate">
                  CHOOSE YOUR SAVINGS PLAN
                </h1>
                <p className="font-hanken text-[11px] text-gray-500 font-bold leading-none mt-1 truncate">
                  Select a savings plan, unlock duration & earn high returns
                </p>
              </div>
            </div>
          </div>

          <BannerSlideshow page="investment" />

          {/* Current Available Balance & Active Investment Portfolio Card */}
          <div className="bg-gradient-to-br from-[#111] to-[#222] rounded-[24px] p-5 text-white mb-6 border border-white/5 shadow-md animate-fade-in space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Available {walletTypeSelected === "BONUS" ? "Bonus" : "Main"} Wallet Balance
                </p>
                <p className="font-bodoni text-[22px] font-bold mt-0.5 text-[#FC7A00]">
                  ₦{userBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="text-right">
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                  Active Investment Balance
                </p>
                <p className="font-bodoni text-[22px] font-bold mt-0.5 text-emerald-400 font-mono">
                  ₦{totalActiveInvestmentBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-orange-500/20 text-[#FC7A00] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[18px]">trending_up</span>
                </div>
                <div>
                  <p className="font-hanken text-[10px] text-gray-300 font-bold uppercase">Estimated Daily Income</p>
                  <p className="font-hanken text-[13px] font-extrabold text-green-400 font-mono">
                    +₦{totalDailyIncome.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / day
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 bg-green-500/10 px-2.5 py-1 rounded-lg border border-green-500/20">
                <span className="material-symbols-outlined text-[13px] text-green-400">
                  lock
                </span>
                <p className="font-hanken text-[9px] text-green-300 font-bold uppercase tracking-wider">
                  100% Secured
                </p>
              </div>
            </div>
          </div>

          {/* Form Create Investment Container */}
          <form onSubmit={handlePrevalidate} className="bg-white rounded-[24px] border border-gray-100 p-5 shadow-[0_8px_30px_rgb(0,0,0,0.015)] mb-6 animate-fade-in">
            <h2 className="font-bodoni text-[15px] font-bold text-black mb-4 flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">
                savings
              </span>
              CHOOSE YOUR SAVINGS PLAN
            </h2>

            {/* Sourcing Wallet */}
            {allowBonusInvestment && (
              <div className="mb-5">
                <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  Select Sourcing Wallet
                </label>
                <div className="grid grid-cols-2 gap-2 bg-gray-50 p-1 rounded-2xl border border-gray-100">
                  <button
                    type="button"
                    onClick={() => setWalletTypeSelected("MAIN")}
                    className={`py-3 rounded-xl font-hanken text-[11px] font-bold transition-all cursor-pointer ${
                      walletTypeSelected === "MAIN"
                        ? "bg-black text-white shadow-md"
                        : "text-gray-500 hover:text-black"
                    }`}
                  >
                    Main (₦{mainBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!allowBonusInvestment) {
                        toast.error("Bonus wallet investment is currently Unavailable at this time");
                        return;
                      }
                      setWalletTypeSelected("BONUS");
                    }}
                    className={`py-3 rounded-xl font-hanken text-[11px] font-bold transition-all cursor-pointer ${
                      walletTypeSelected === "BONUS"
                        ? "bg-black text-white shadow-md"
                        : "text-gray-500 hover:text-black"
                    }`}
                  >
                    Bonus (₦{bonusBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })})
                  </button>
                </div>
              </div>
            )}

            {/* Dynamic Plans Grid */}
            <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2.5">
              Savings Plans
            </label>

            {isLoadingPlans ? (
              <div className="flex flex-col gap-2 mb-5">
                {[1, 2, 3].map((n) => (
                  <div key={n} className="skeleton-shimmer h-16 w-full rounded-xl" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 mb-5">
                {plans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  return (
                    <button
                      key={plan.id}
                      type="button"
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setAmountStr("");
                      }}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border text-left transition-all ${
                        isSelected
                          ? "border-primary bg-[#FFF9F5] shadow-sm"
                          : "border-gray-100 hover:border-gray-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl border border-gray-200 bg-white p-1 flex items-center justify-center overflow-hidden flex-shrink-0 relative shadow-2xs">
                          <img
                            src={plan.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
                            alt={plan.name}
                            className="w-full h-full object-contain p-0.5"
                          />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-hanken text-[12.5px] font-bold text-black leading-snug">
                              {plan.name}
                            </h3>
                            {plan.badgeTag && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">
                                {plan.badgeTag}
                              </span>
                            )}
                          </div>
                          <p className="font-hanken text-[10px] text-gray-500 font-semibold uppercase mt-0.5">
                            {plan.type} • {plan.interestType}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="block font-hanken text-[14.5px] font-extrabold text-primary">
                          {plan.apr}% APR
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

            {/* Plan Description */}
            {selectedPlan && (
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 mb-5">
                <p className="font-hanken text-[10.5px] text-gray-600 leading-relaxed font-medium">
                  {selectedPlan.description || "Lock capital securely and earn high guaranteed interest."}
                </p>
              </div>
            )}

            {/* "WHEN DO YOU WANT TO UNLOCK YOUR SAVINGS" CONFIGURABLE SECTION */}
            <div className="mb-5 p-4 rounded-2xl bg-orange-50/40 border border-orange-100 space-y-3">
              <label className="block font-hanken text-[11px] font-black text-black uppercase tracking-wider">
                WHEN DO YOU WANT TO UNLOCK YOUR SAVINGS?
              </label>

              {/* Mode Toggle Tabs */}
              <div className="grid grid-cols-3 gap-1.5 p-1 bg-white rounded-xl border border-gray-200/80">
                {selectedPlan?.allowMonths && (
                  <button
                    type="button"
                    onClick={() => setUnlockMode("MONTHS")}
                    className={`py-2 text-[10.5px] font-extrabold uppercase rounded-lg transition-all ${
                      unlockMode === "MONTHS" ? "bg-primary text-white shadow-2xs" : "text-gray-500 hover:text-black"
                    }`}
                  >
                    By Month
                  </button>
                )}

                {selectedPlan?.allowYears && (
                  <button
                    type="button"
                    onClick={() => setUnlockMode("YEARS")}
                    className={`py-2 text-[10.5px] font-extrabold uppercase rounded-lg transition-all ${
                      unlockMode === "YEARS" ? "bg-primary text-white shadow-2xs" : "text-gray-500 hover:text-black"
                    }`}
                  >
                    By Year
                  </button>
                )}

                {selectedPlan?.allowCustom && (
                  <button
                    type="button"
                    onClick={() => setUnlockMode("CUSTOM")}
                    className={`py-2 text-[10.5px] font-extrabold uppercase rounded-lg transition-all ${
                      unlockMode === "CUSTOM" ? "bg-primary text-white shadow-2xs" : "text-gray-500 hover:text-black"
                    }`}
                  >
                    Custom Date
                  </button>
                )}
              </div>

              {/* MODE 1: MONTHS PRESETS */}
              {unlockMode === "MONTHS" && selectedPlan?.allowMonths && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Month Duration:</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(selectedPlan.monthOptions || [1, 3, 6, 9]).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setSelectedMonth(m)}
                        className={`py-2.5 rounded-xl text-xs font-extrabold font-mono transition-all border ${
                          selectedMonth === m
                            ? "bg-black border-black text-white shadow-2xs"
                            : "bg-white border-gray-200 text-gray-700 hover:border-black"
                        }`}
                      >
                        {m} {m === 1 ? "Month" : "Months"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MODE 2: YEARS PRESETS */}
              {unlockMode === "YEARS" && selectedPlan?.allowYears && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Select Year Duration:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(selectedPlan.yearOptions || [1, 2, 3]).map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setSelectedYear(y)}
                        className={`py-2.5 rounded-xl text-xs font-extrabold font-mono transition-all border ${
                          selectedYear === y
                            ? "bg-black border-black text-white shadow-2xs"
                            : "bg-white border-gray-200 text-gray-700 hover:border-black"
                        }`}
                      >
                        {y} {y === 1 ? "Year" : "Years"}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* MODE 3: CUSTOM CALENDAR */}
              {unlockMode === "CUSTOM" && selectedPlan?.allowCustom && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">
                    Custom Date (Min {selectedPlan.minCustomDays || 7} Days - Max {selectedPlan.maxCustomDays || 1095} Days):
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      const minDays = selectedPlan.minCustomDays || 7;
                      const initialDate = new Date();
                      initialDate.setDate(initialDate.getDate() + minDays);
                      setCalendarMonth(initialDate);
                      setShowCalendarModal(true);
                    }}
                    className="w-full text-left px-4 py-3 bg-white border border-black rounded-xl flex items-center justify-between shadow-2xs active:scale-98 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">
                        calendar_month
                      </span>
                      <span className="font-hanken text-xs font-semibold text-black">
                        {customMaturityDate
                          ? new Date(customMaturityDate).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
                          : "Tap to Select Custom Unlock Date"
                        }
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-gray-400">
                      chevron_right
                    </span>
                  </button>
                </div>
              )}

              <div className="flex justify-between items-center text-xs font-bold pt-1 border-t border-orange-200/60">
                <span className="text-gray-500">Target Unlock Date:</span>
                <span className="text-primary font-mono font-black">{calculatedMaturityDateObj.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })} ({calculatedLockDays} Days)</span>
              </div>
            </div>

            {/* Form Fields: Amount */}
            <div className="mb-4">
              <label className="block font-hanken text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                How much do you want to save? (₦) {selectedPlan.isAmountRequired ? "*" : "(Optional)"}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-hanken text-[14px] font-bold text-gray-400">
                  ₦
                </span>
                <input
                  type="number"
                  placeholder={`Min ₦${selectedPlan.minInvestment?.toLocaleString()} - Max ₦${selectedPlan.maxInvestment?.toLocaleString()}`}
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

            {/* Live Reward Calculation Summary */}
            {amountStr && (
              <div className="mb-5 p-4 rounded-xl bg-gradient-to-r from-[#FFFBF7] to-[#FFF7EF] border border-[#FFECD8] animate-fade-in">
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase tracking-wider mb-2">
                  Estimated Yield Calculation
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-bold">Extra Interest You Earn</span>
                    <span className="font-hanken text-[15px] font-extrabold text-green-600">
                      +₦{getEstimatedReward().toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="block font-hanken text-[9px] text-gray-500 font-bold">Time Locked</span>
                    <span className="font-hanken text-[13px] font-extrabold text-black">
                      {calculatedLockDays} Days
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

          {/* Active Vault & History Tab Section */}
          <div className="animate-fade-in space-y-4">
            {/* Navigation Pills */}
            <div className="flex items-center justify-between bg-gray-100 p-1.5 rounded-2xl border border-gray-200">
              <button
                type="button"
                onClick={() => setActiveHoldingTab("ACTIVE")}
                className={`flex-1 py-2.5 rounded-xl font-hanken text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeHoldingTab === "ACTIVE"
                    ? "bg-white text-black shadow-xs border border-gray-200"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">lock_clock</span>
                <span>Active Savings ({investments.filter((i) => i.status === "ACTIVE").length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveHoldingTab("HISTORY")}
                className={`flex-1 py-2.5 rounded-xl font-hanken text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeHoldingTab === "HISTORY"
                    ? "bg-white text-black shadow-xs border border-gray-200"
                    : "text-gray-500 hover:text-black"
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">history</span>
                <span>Savings History ({investments.filter((i) => i.status !== "ACTIVE").length})</span>
              </button>
            </div>

            {/* VIEW 1: ACTIVE SAVINGS */}
            {activeHoldingTab === "ACTIVE" && (
              <div className="space-y-3">
                {isLoadingHistory ? (
                  <div className="flex flex-col gap-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="skeleton-shimmer h-32 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : investments.filter((i) => i.status === "ACTIVE").length === 0 ? (
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
                    {investments
                      .filter((inv) => inv.status === "ACTIVE")
                      .map((inv) => {
                        const isMatured = new Date() >= new Date(inv.maturityDate);

                        return (
                          <div
                            key={inv.id}
                            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-in hover:border-gray-300 transition-all cursor-pointer"
                            onClick={() => setSelectedDetailInv(inv)}
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded font-hanken text-[8px] font-extrabold uppercase tracking-wide mb-1.5 bg-green-50 text-green-600">
                                  <span className="material-symbols-outlined text-[10px]">lock</span>
                                  {isMatured ? "MATURED - READY" : "ACTIVE"}
                                </span>
                                <h3 className="font-hanken text-[13px] font-extrabold text-black leading-snug">
                                  {inv.optionName}
                                </h3>
                              </div>
                              <div className="text-right">
                                <span className="block font-hanken text-[14px] font-extrabold text-black font-mono">
                                  ₦{inv.amount.toLocaleString()}
                                </span>
                                <span className="font-hanken text-[9.5px] text-green-600 font-extrabold font-mono">
                                  +{(inv.interestRate * 100).toFixed(1)}% {inv.interestType}
                                </span>
                              </div>
                            </div>

                            <div className="border-t border-gray-50 pt-2.5 flex items-center justify-between">
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
                                <span className="font-hanken text-[10px] font-extrabold text-[#FC7A00]">
                                  {new Date(inv.maturityDate).toLocaleDateString()}
                                </span>
                              </div>
                            </div>

                            <div className="mt-3 flex gap-2 pt-1" onClick={(e) => e.stopPropagation()}>
                              {inv.status === "CLAIM_REQUESTED" ? (
                                <div className="w-full py-2 bg-amber-500/10 border border-amber-500/30 text-amber-600 rounded-xl font-hanken text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-1.5">
                                  <span className="material-symbols-outlined text-[14px] animate-spin">hourglass_empty</span>
                                  Payout Requested • Awaiting Admin Approval
                                </div>
                              ) : isMatured ? (
                                <button
                                  type="button"
                                  onClick={() => handleClaim(inv.id)}
                                  className="w-full py-2 bg-green-600 hover:bg-green-700 text-white rounded-xl font-hanken text-[11px] font-bold tracking-wider uppercase flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                                >
                                  <span className="material-symbols-outlined text-[14px]">payments</span>
                                  Request Matured Payout
                                </button>
                              ) : (
                                <>
                                  <div className="flex-1 bg-gray-50 rounded-xl px-2 py-1.5 flex items-center gap-1 justify-center border border-gray-100">
                                    <span className="material-symbols-outlined text-[11px] text-[#FC7A00] animate-spin">
                                      progress_activity
                                    </span>
                                    <p className="font-hanken text-[9px] text-gray-500 font-bold">
                                      Growing yield...
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedCancelId(inv.id);
                                      setShowCancelModal(true);
                                    }}
                                    className="px-3 py-1.5 border border-red-200 text-red-600 hover:bg-red-50 rounded-xl font-hanken text-[10px] font-bold tracking-wider uppercase flex items-center justify-center gap-1 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Liquidate Early
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            )}

            {/* VIEW 2: SAVINGS HISTORY */}
            {activeHoldingTab === "HISTORY" && (
              <div className="space-y-3">
                {/* Filter Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                  {(["ALL", "CLAIMED", "CANCELLED"] as const).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setHistoryFilter(chip)}
                      className={`px-3 py-1 rounded-full font-hanken text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                        historyFilter === chip
                          ? "bg-black text-white"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                {isLoadingHistory ? (
                  <div className="flex flex-col gap-3">
                    {[1, 2].map((n) => (
                      <div key={n} className="skeleton-shimmer h-28 w-full rounded-2xl" />
                    ))}
                  </div>
                ) : investments.filter((i) => {
                    if (i.status === "ACTIVE") return false;
                    if (historyFilter === "CLAIMED") return i.status === "CLAIMED";
                    if (historyFilter === "CANCELLED") return i.status === "CANCELLED";
                    return true;
                  }).length === 0 ? (
                  <div className="bg-white rounded-[24px] border border-gray-100 p-8 text-center flex flex-col items-center justify-center min-h-[160px] shadow-sm">
                    <span className="material-symbols-outlined text-gray-300 text-[36px] mb-2">
                      history
                    </span>
                    <p className="font-hanken text-[12px] font-bold text-black mb-1">
                      No Investment History Found
                    </p>
                    <p className="font-hanken text-[10px] text-gray-400 leading-relaxed max-w-[220px]">
                      Completed payouts and early cancellations will appear here.
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {investments
                      .filter((inv) => {
                        if (inv.status === "ACTIVE") return false;
                        if (historyFilter === "CLAIMED") return inv.status === "CLAIMED";
                        if (historyFilter === "CANCELLED") return inv.status === "CANCELLED";
                        return true;
                      })
                      .map((inv) => {
                        const isClaimed = inv.status === "CLAIMED";
                        const isCancelled = inv.status === "CANCELLED";

                        return (
                          <div
                            key={inv.id}
                            onClick={() => setSelectedDetailInv(inv)}
                            className="bg-white rounded-2xl border border-gray-200 p-4 shadow-sm animate-fade-in hover:border-gray-300 transition-all cursor-pointer"
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div>
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-hanken text-[8.5px] font-black uppercase tracking-wider mb-1.5 border ${
                                  isClaimed
                                    ? "bg-blue-50 text-blue-600 border-blue-200"
                                    : isCancelled
                                    ? "bg-red-50 text-red-600 border-red-200"
                                    : "bg-gray-50 text-gray-600 border-gray-200"
                                }`}>
                                  <span className="material-symbols-outlined text-[10px]">
                                    {isClaimed ? "check_circle" : "cancel"}
                                  </span>
                                  {inv.status}
                                </span>
                                <h3 className="font-hanken text-[13px] font-extrabold text-black leading-snug">
                                  {inv.optionName}
                                </h3>
                              </div>
                              <div className="text-right">
                                <span className="block font-hanken text-[14px] font-extrabold text-black font-mono">
                                  ₦{inv.amount.toLocaleString()}
                                </span>
                                <span className={`font-hanken text-[9.5px] font-extrabold font-mono ${isCancelled ? "text-red-500 line-through" : "text-blue-600"}`}>
                                  {isCancelled ? "Canceled Lock" : `Settled: ₦${inv.totalValue?.toLocaleString() || inv.amount.toLocaleString()}`}
                                </span>
                              </div>
                            </div>

                            <div className="border-t border-gray-50 pt-2 flex items-center justify-between text-[9.5px] font-hanken text-gray-500 font-semibold">
                              <span>Locked: {new Date(inv.startDate).toLocaleDateString()}</span>
                              <span className="text-[#FC7A00] font-extrabold flex items-center gap-1">
                                <span>View Details</span>
                                <span className="material-symbols-outlined text-[12px]">chevron_right</span>
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
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
                    Confirm Savings Lock Rules
                  </h3>
                  <p className="font-hanken text-[11px] text-gray-500 max-w-[280px] mt-1 font-semibold leading-relaxed">
                    Please review rules before locking your capital.
                  </p>
                </div>

                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 mb-5">
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Savings Plan</span>
                    <span className="text-black font-bold">{selectedPlan.name}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Amount Saved</span>
                    <span className="text-black font-bold">₦{parseFloat(amountStr || "0").toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100/60 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Withdrawal Date</span>
                    <span className="text-[#FC7A00] font-extrabold">{calculatedMaturityDateObj.toLocaleDateString()}</span>
                  </div>
                  <div className="flex justify-between py-2 font-hanken text-[12px]">
                    <span className="text-gray-500 font-semibold">Extra Interest You Earn</span>
                    <span className="text-green-600 font-extrabold">+{getEstimatedReward().toLocaleString()} ({selectedPlan.apr}%)</span>
                  </div>
                </div>

                <div className="bg-red-50/50 border border-red-100 rounded-xl p-4 mb-6">
                  <h4 className="font-hanken text-[11px] font-extrabold text-red-600 uppercase tracking-wide mb-1.5 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">warning</span>
                    SECURE SAVINGS RULES
                  </h4>
                  <ul className="list-disc list-inside space-y-1 font-hanken text-[10px] text-gray-600 font-semibold leading-relaxed">
                    <li>This savings plan is locked until maturity.</li>
                    <li>Early cancellations carry a <strong>{(penaltyRate * 100).toFixed(0)}% liquidation penalty</strong>.</li>
                    <li>Your money and extra interest rewards will return directly to your wallet balance on <strong className="text-black">{calculatedMaturityDateObj.toLocaleDateString()}</strong>.</li>
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
                    PENALTY & POLICY DISCLOSURE
                  </h4>
                  <p className="font-hanken text-[10.5px] text-gray-700 font-semibold leading-relaxed mb-2">
                    {penaltyPolicyText}
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-hanken text-[10px] text-gray-700 font-semibold leading-relaxed border-t border-orange-200/60 pt-2">
                    <li>An early withdrawal penalty of <strong>{(penaltyRate * 100).toFixed(0)}% of principal</strong> will be deducted.</li>
                    <li>Any accumulated interest will be forfeit upon early liquidation.</li>
                    <li>The remaining refunded capital will be credited instantly back to your wallet.</li>
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

        {/* Custom Calendar Picker Modal */}
        <AnimatePresence>
          {renderCalendarModal()}
        </AnimatePresence>

        {/* FULL SCREEN INVESTMENT TRANSACTION DETAILS MODAL */}
        <AnimatePresence>
          {selectedDetailInv && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4"
            >
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 25, stiffness: 220 }}
                className="bg-white w-full max-w-lg rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">savings</span>
                    <h3 className="font-bodoni font-bold text-base text-black uppercase tracking-tight">
                      Investment Transaction Details
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedDetailInv(null)}
                    className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 text-center space-y-1">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border mb-1 ${
                    selectedDetailInv.status === "CLAIMED"
                      ? "bg-blue-50 text-blue-600 border-blue-200"
                      : selectedDetailInv.status === "CANCELLED"
                      ? "bg-red-50 text-red-600 border-red-200"
                      : "bg-green-50 text-green-600 border-green-200"
                  }`}>
                    {selectedDetailInv.status}
                  </span>
                  <p className="text-xs font-bold text-gray-400 font-hanken uppercase">{selectedDetailInv.optionName}</p>
                  <p className="font-mono font-black text-2xl text-black">
                    ₦{selectedDetailInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>

                <div className="space-y-2 text-xs font-hanken">
                  {/* Public Customer-Facing Reference */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Investment Reference</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-black text-black text-sm">
                        {selectedDetailInv.investmentReference || `INV-${selectedDetailInv.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8)}`}
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const refToCopy = selectedDetailInv.investmentReference || `INV-${selectedDetailInv.id.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-8)}`;
                          navigator.clipboard.writeText(refToCopy);
                          toast.success("Reference copied to clipboard!");
                        }}
                        className="px-2 py-0.5 rounded bg-gray-100 hover:bg-gray-200 text-gray-700 font-extrabold text-[9px] uppercase tracking-wider transition-all active:scale-95 cursor-pointer flex items-center gap-1"
                      >
                        <span className="material-symbols-outlined text-[12px]">content_copy</span>
                        <span>Copy</span>
                      </button>
                    </div>
                  </div>

                  {/* Masked Customer Support ID */}
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Transaction ID</span>
                    <span className="font-mono font-semibold text-gray-500 text-[10.5px]">
                      {selectedDetailInv.id.length > 20
                        ? `${selectedDetailInv.id.slice(0, 8)}...${selectedDetailInv.id.slice(-6)}`
                        : selectedDetailInv.id}
                    </span>
                  </div>

                  {/* Principal Capital / Settled Value depending on status */}
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">
                      {selectedDetailInv.status === "CLAIMED"
                        ? "Payout Amount / Settled Value"
                        : "Principal Amount"}
                    </span>
                    <span className="font-mono font-bold text-black text-sm">
                      ₦{selectedDetailInv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Annual Interest APR</span>
                    <span className="font-mono font-bold text-green-600">+{(selectedDetailInv.interestRate * 100).toFixed(1)}% ({selectedDetailInv.interestType})</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Lock Start Date</span>
                    <span className="font-semibold text-gray-800">{new Date(selectedDetailInv.startDate).toLocaleString()}</span>
                  </div>

                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-400 font-semibold uppercase text-[10px]">Maturity / Unlock Date</span>
                    <span className="font-bold text-[#FC7A00]">{new Date(selectedDetailInv.maturityDate).toLocaleDateString()}</span>
                  </div>

                  {selectedDetailInv.status === "CANCELLED" ? (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl space-y-1 mt-2">
                      <div className="flex justify-between text-red-600 font-bold">
                        <span>Early Penalty Deducted ({(penaltyRate * 100).toFixed(0)}%):</span>
                        <span className="font-mono">-₦{(selectedDetailInv.amount * penaltyRate).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-black font-extrabold border-t border-red-200/60 pt-1">
                        <span>Net Refunded to Wallet:</span>
                        <span className="font-mono text-emerald-600">₦{selectedDetailInv.totalValue?.toLocaleString() || (selectedDetailInv.amount * (1 - penaltyRate)).toLocaleString()}</span>
                      </div>
                    </div>
                  ) : selectedDetailInv.status === "CLAIMED" && (
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-400 font-semibold uppercase text-[10px]">Total Settled Value</span>
                      <span className="font-mono font-bold text-emerald-600">₦{selectedDetailInv.totalValue?.toLocaleString() || selectedDetailInv.amount.toLocaleString()}</span>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => setSelectedDetailInv(null)}
                  className="w-full py-3 bg-[#FC7A00] text-white rounded-2xl font-bold uppercase text-xs tracking-wider cursor-pointer shadow-sm active:scale-95 transition-all"
                >
                  Close Details
                </button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </RouteGuard>
  );
}
