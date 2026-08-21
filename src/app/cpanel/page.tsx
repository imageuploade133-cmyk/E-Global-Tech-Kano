"use client";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";



import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function AdminDashboardPage() {
  const { config, syncRealFirebaseData } = useAppConfig();

  // Dark/Light Theme state
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const syncTheme = () => {
      if (typeof window !== "undefined") {
        const cached = localStorage.getItem("cpanel_theme");
        if (cached === "dark" || cached === "light") {
          setTheme(cached);
        }
      }
    };

    syncTheme();

    const handleThemeChange = () => syncTheme();
    window.addEventListener("cpanel_theme_change", handleThemeChange);
    window.addEventListener("storage", handleThemeChange);

    return () => {
      window.removeEventListener("cpanel_theme_change", handleThemeChange);
      window.removeEventListener("storage", handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("cpanel_theme", next);
        window.dispatchEvent(new Event("cpanel_theme_change"));
      }
      return next;
    });
  };

  const isDark = theme === "dark";
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);

  // Automatically sync metrics on mount
  useEffect(() => {
    syncRealFirebaseData();
  }, []);

  const handleRefreshFirebaseMetrics = async () => {
    setIsSyncingFirebase(true);
    toast.loading("Querying real-time Firestore database matrices...");
    try {
      await syncRealFirebaseData();
      toast.dismiss();
      toast.success("All counts and global pool balance aggregates recalculated!");
    } catch {
      toast.dismiss();
      toast.error("Failed to query live metrics.");
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  return (
    <div className={cn("min-h-full font-hanken transition-colors duration-300", isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-800")}>
      {/* Header Bar */}
      <div className={cn(
        "flex justify-between items-center px-6 md:px-8 py-5 border-b transition-colors duration-300",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div>
          <h2 className={cn("font-hanken font-extrabold text-lg", isDark ? "text-white" : "text-gray-800")}>
            Platform Operations & Metrics
          </h2>
          <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">
            Enterprise System Suite Dashboard
          </p>
        </div>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 duration-300",
            isDark
              ? "bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700"
              : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-black"
          )}
        >
          <span className="material-symbols-outlined text-[16px]">
            {isDark ? "light_mode" : "dark_mode"}
          </span>
          <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>

      {/* Main Workspace */}
      <div className="p-4 md:p-8 max-w-6xl w-full mx-auto space-y-6 pb-24 md:pb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Live Sync Banner */}
          <div className={cn(
            "flex flex-col sm:flex-row sm:items-center justify-between rounded-2xl p-4 md:p-5 gap-3 border transition-colors duration-300",
            isDark ? "bg-orange-950/20 border-orange-900/30 text-white" : "bg-orange-50 border-orange-200 text-black"
          )}>
            <div>
              <h4 className={cn("font-bold text-xs uppercase tracking-wider", isDark ? "text-orange-400" : "text-gray-900")}>
                Live Database Recalculation
              </h4>
              <p className={cn("text-[10px] font-semibold mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Recalculate total registered accounts and global pool balances directly from database rails.
              </p>
            </div>
            <button
              type="button"
              disabled={isSyncingFirebase}
              onClick={handleRefreshFirebaseMetrics}
              className="px-4 py-2.5 bg-[#FC7A00] hover:bg-[#e06600] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap self-start sm:self-auto shadow-sm"
            >
              {isSyncingFirebase ? <><ButtonSpinner /> Recalculating...</> : "Sync Firebase Data"}
            </button>
          </div>

          {/* Metrics Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
            {/* Card 1: Users */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-amber-500/90 to-orange-600/90 rounded-2xl p-6 border border-orange-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Registered Users</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    {(config.totalUsers || 0).toLocaleString()}
                  </p>
                  <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-3">Active Accounts</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">face</span>
                </div>
              </div>
            </div>

            {/* Card 2: NGN Holdings */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-500/90 to-teal-600/90 rounded-2xl p-6 border border-emerald-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Pool NGN Balance</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.globalNgnBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-3">Naira Reserve Liquidity</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">payments</span>
                </div>
              </div>
            </div>

            {/* Card 3: USD Holdings */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-indigo-500/90 to-violet-600/90 rounded-2xl p-6 border border-indigo-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-indigo-100 tracking-wider">Pool USD Reserves</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ${(config.globalUsdBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-3">Dollar Asset Pool</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">credit_card</span>
                </div>
              </div>
            </div>

            {/* Card 4: Total Fixed Deposit */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-cyan-500/90 to-blue-600/90 rounded-2xl p-6 border border-cyan-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-cyan-100 tracking-wider">Total Fixed Deposit</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.totalFixedDeposit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-cyan-200 font-bold uppercase tracking-wider mt-3">Active Savings Holdings</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">lock</span>
                </div>
              </div>
            </div>

            {/* Card 5: Today's Deposit */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-orange-500/90 to-[#E06600]/90 rounded-2xl p-6 border border-orange-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Today&apos;s Deposit</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.todayDeposit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-3">Sum Received Today</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">add_circle</span>
                </div>
              </div>
            </div>

            {/* Card 6: Today's Transfer */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-rose-500/90 to-red-600/90 rounded-2xl p-6 border border-rose-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-rose-100 tracking-wider">Today&apos;s Transfer</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.todayTransfer || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-rose-200 font-bold uppercase tracking-wider mt-3">Sum Dispatched Today</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">near_me</span>
                </div>
              </div>
            </div>

            {/* Card 7: Total Airtime Purchase */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-pink-500/90 to-purple-600/90 rounded-2xl p-6 border border-pink-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-pink-100 tracking-wider">Total Airtime Purchases</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.totalAirtimePurchase || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-pink-200 font-bold uppercase tracking-wider mt-3">Aggregated Airtime VTU</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">phone_iphone</span>
                </div>
              </div>
            </div>

            {/* Card 8: Total Bonus */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-teal-500/90 to-emerald-600/90 rounded-2xl p-6 border border-teal-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-teal-100 tracking-wider">Total Bonus Wallet</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.totalBonus || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-teal-200 font-bold uppercase tracking-wider mt-3">Aggregated Referral Bonuses</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">featured_play_list</span>
                </div>
              </div>
            </div>

            {/* Card 9: Total Transfer Profit */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-600/95 to-cyan-600/95 rounded-2xl p-6 border border-emerald-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Total Transfer Profit</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.totalTransferProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-3">Admin Transfer Markups</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">currency_exchange</span>
                </div>
              </div>
            </div>

            {/* Card 10: Total Data Profit */}
            <div className="relative group overflow-hidden bg-gradient-to-br from-fuchsia-500/90 to-pink-600/90 rounded-2xl p-6 border border-fuchsia-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
              <div className="flex justify-between items-start relative z-10">
                <div className="max-w-[75%] min-w-0">
                  <p className="text-[10px] font-black uppercase text-fuchsia-100 tracking-wider">Total Data Profit</p>
                  <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                    ₦{(config.totalDataProfit || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] text-fuchsia-200 font-bold uppercase tracking-wider mt-3">Admin Data Plan Markups</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                  <span className="material-symbols-outlined text-[24px]">database</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}