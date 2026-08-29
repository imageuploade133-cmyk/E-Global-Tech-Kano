"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

interface ExchangeConfig {
  useLiveWorldDollarRate: boolean;
  manualDollarRate: number;
  dollarCommissionFee: number;
  xofToNgnRate: number;
  swapFees: {
    ngnToUsd: number;
    usdToNgn: number;
    ngnToXof: number;
    xofToNgn: number;
    usdToXof: number;
    xofToUsd: number;
  };
}

const DEFAULT_CONFIG: ExchangeConfig = {
  useLiveWorldDollarRate: false,
  manualDollarRate: 1550,
  dollarCommissionFee: 15,
  xofToNgnRate: 2.5,
  swapFees: {
    ngnToUsd: 50,
    usdToNgn: 1.5,
    ngnToXof: 30,
    xofToNgn: 10,
    usdToXof: 2.0,
    xofToUsd: 15,
  },
};

function CpanelExchangeRatesContent() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useCpanelTheme();

  const [config, setConfig] = useState<ExchangeConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Simulator States
  const [simFromCurrency, setSimFromCurrency] = useState<"NGN" | "USD" | "XOF">("NGN");
  const [simToCurrency, setSimToCurrency] = useState<"NGN" | "USD" | "XOF">("USD");
  const [simAmount, setSimAmount] = useState<number>(10000);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch("/api/admin/exchange-rates", { headers });
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig(data.config);
      }
    } catch {
      toast.error("Failed to load exchange rates configuration.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(isMock ? { Authorization: "Bearer mock-admin-token" } : {}),
      };

      const res = await fetch("/api/admin/exchange-rates", {
        method: "POST",
        headers,
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Exchange rates and swap fees saved successfully!");
        if (data.config) setConfig(data.config);
      } else {
        toast.error(data.error || "Failed to save exchange rates.");
      }
    } catch {
      toast.error("Network communication error saving settings.");
    } finally {
      setIsSaving(false);
    }
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full";

  const effectiveDollarRate = config.manualDollarRate + config.dollarCommissionFee;

  // Simulator calculation
  const calculateSimSwap = () => {
    if (simFromCurrency === simToCurrency) return { output: simAmount, fee: 0 };

    let feeKey = "ngnToUsd";
    let fee = 0;
    let converted = 0;

    if (simFromCurrency === "NGN" && simToCurrency === "USD") {
      fee = config.swapFees.ngnToUsd;
      const net = Math.max(0, simAmount - fee);
      converted = net / effectiveDollarRate;
    } else if (simFromCurrency === "USD" && simToCurrency === "NGN") {
      fee = config.swapFees.usdToNgn;
      const net = Math.max(0, simAmount - fee);
      converted = net * effectiveDollarRate;
    } else if (simFromCurrency === "NGN" && simToCurrency === "XOF") {
      fee = config.swapFees.ngnToXof;
      const net = Math.max(0, simAmount - fee);
      converted = net / config.xofToNgnRate;
    } else if (simFromCurrency === "XOF" && simToCurrency === "NGN") {
      fee = config.swapFees.xofToNgn;
      const net = Math.max(0, simAmount - fee);
      converted = net * config.xofToNgnRate;
    } else if (simFromCurrency === "USD" && simToCurrency === "XOF") {
      fee = config.swapFees.usdToXof;
      const net = Math.max(0, simAmount - fee);
      const ngnEquivalent = net * effectiveDollarRate;
      converted = ngnEquivalent / config.xofToNgnRate;
    } else if (simFromCurrency === "XOF" && simToCurrency === "USD") {
      fee = config.swapFees.xofToUsd;
      const net = Math.max(0, simAmount - fee);
      const ngnEquivalent = net * config.xofToNgnRate;
      converted = ngnEquivalent / effectiveDollarRate;
    }

    return { output: Math.max(0, converted), fee };
  };

  const simResult = calculateSimSwap();

  if (isLoading) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
        <div className="flex flex-col items-center gap-3">
          <ButtonSpinner />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Exchange Rate Configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Bar */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[24px]">currency_exchange</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Exchange Rates & Swap Fees Manager</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Configure USD sell rates, admin commission fees, live world market rate mode, and multi-currency swap fees.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={cn("px-3 h-10 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer", isDark ? "bg-gray-900 border-gray-800 text-yellow-400" : "bg-gray-100 border-gray-200 text-gray-700")}
            >
              <span className="material-symbols-outlined text-[18px]">{isDark ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSave}
              className="px-5 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shadow-md cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <><ButtonSpinner /> Saving...</> : <><span className="material-symbols-outlined text-[18px]">save</span> Save Settings</>}
            </button>
          </div>
        </div>

        {/* Live World Rate vs Manual Dollar Rate Toggle Card */}
        <div className="bg-[#0b1329] text-white rounded-2xl p-6 border border-slate-800 space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FC7A00]/20 text-[#FC7A00] border border-[#FC7A00]/30 tracking-wider">
                CURRENCY RATE ENGINE
              </span>
              <h2 className="text-lg md:text-xl font-extrabold tracking-tight mt-2">World Live Dollar Rate Mode (ON / OFF)</h2>
              <p className="text-xs text-slate-400 mt-1 font-medium">
                When Live Rate is ON, rates fetch dynamically from live FX market APIs + your configured commission fee.
              </p>
            </div>

            {/* Toggle Switch */}
            <div className="flex items-center gap-3 bg-slate-900 p-3 rounded-2xl border border-slate-800">
              <span className="text-xs font-bold text-slate-300">
                {config.useLiveWorldDollarRate ? "Live World Rate: ON" : "Manual Rate Mode: ON"}
              </span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.useLiveWorldDollarRate}
                  onChange={(e) => setConfig({ ...config, useLiveWorldDollarRate: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-12 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Manual Dollar Rate Override</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                <input
                  type="number"
                  value={config.manualDollarRate}
                  onChange={(e) => setConfig({ ...config, manualDollarRate: Math.max(1, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-white outline-none focus:border-[#FC7A00]"
                />
              </div>
              <span className="text-[9px] text-slate-400 block mt-1">Base rate per 1 USD when Live Mode is OFF.</span>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Administrator Commission Fee</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                <input
                  type="number"
                  value={config.dollarCommissionFee}
                  onChange={(e) => setConfig({ ...config, dollarCommissionFee: Math.max(0, parseFloat(e.target.value) || 0) })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                />
              </div>
              <span className="text-[9px] text-slate-400 block mt-1">Added directly onto dollar sell rate for profit margin.</span>
            </div>

            <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Effective Customer Sell Rate</span>
              <strong className="text-xl font-black text-emerald-400 block font-mono mt-2">
                ₦{effectiveDollarRate.toLocaleString()} / USD
              </strong>
              <span className="text-[9px] text-slate-400 block">
                {config.useLiveWorldDollarRate ? "Live Market Rate + Admin Commission" : "Manual Rate + Admin Commission"}
              </span>
            </div>
          </div>
        </div>

        {/* Multi-Currency Swap Fees Grid */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className={cn("p-6 rounded-2xl border space-y-4", panelClass)}>
            <div className="border-b pb-3.5 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#FC7A00] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  <span>Multi-Pair Currency Swap Fees</span>
                </h3>
                <p className="text-[10.5px] text-gray-400 font-bold uppercase mt-0.5">
                  Set fixed transaction swap fees charged when users convert balances between NGN, USD, and XOF.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">NGN ➔ USD Swap Fee (₦)</span>
                <input
                  type="number"
                  value={config.swapFees.ngnToUsd}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, ngnToUsd: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">USD ➔ NGN Swap Fee ($)</span>
                <input
                  type="number"
                  value={config.swapFees.usdToNgn}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, usdToNgn: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">NGN ➔ XOF Swap Fee (₦)</span>
                <input
                  type="number"
                  value={config.swapFees.ngnToXof}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, ngnToXof: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">XOF ➔ NGN Swap Fee (FCFA)</span>
                <input
                  type="number"
                  value={config.swapFees.xofToNgn}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, xofToNgn: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">USD ➔ XOF Swap Fee ($)</span>
                <input
                  type="number"
                  value={config.swapFees.usdToXof}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, usdToXof: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">XOF ➔ USD Swap Fee (FCFA)</span>
                <input
                  type="number"
                  value={config.swapFees.xofToUsd}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, xofToUsd: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>
            </div>
          </div>

          {/* Currency Swap Real-Time Simulator */}
          <div className={cn("p-6 rounded-2xl border space-y-4", panelClass)}>
            <div className="border-b pb-3.5 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-[22px]">calculate</span>
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wider text-gray-900 dark:text-white">
                    Real-Time Currency Swap Simulator & Diagnostic Tool
                  </h4>
                  <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">
                    Test exact user conversions, effective rates, and deducted swap fees in real-time
                  </p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Diagnostic Tool
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">From Currency</label>
                <select
                  value={simFromCurrency}
                  onChange={(e) => setSimFromCurrency(e.target.value as any)}
                  className={cn(inputClass, "cursor-pointer font-bold")}
                >
                  <option value="NGN">NGN (Naira)</option>
                  <option value="USD">USD (Dollar)</option>
                  <option value="XOF">XOF (FCFA)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">To Currency</label>
                <select
                  value={simToCurrency}
                  onChange={(e) => setSimToCurrency(e.target.value as any)}
                  className={cn(inputClass, "cursor-pointer font-bold")}
                >
                  <option value="USD">USD (Dollar)</option>
                  <option value="NGN">NGN (Naira)</option>
                  <option value="XOF">XOF (FCFA)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Swap Input Amount</label>
                <input
                  type="number"
                  value={simAmount}
                  onChange={(e) => setSimAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-0.5">
                <span className="text-[9px] font-black uppercase text-gray-400 block">Simulated User Receives</span>
                <strong className="text-base font-black text-emerald-500 font-mono block">
                  {simToCurrency === "USD" ? "$" : simToCurrency === "XOF" ? "FCFA " : "₦"}
                  {simResult.output.toLocaleString(undefined, { maximumFractionDigits: 2 })} {simToCurrency}
                </strong>
                <span className="text-[9px] text-gray-400 font-bold block">
                  Fee Deducted: {simResult.fee} {simFromCurrency}
                </span>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isSaving ? <><ButtonSpinner /> Saving Configurations...</> : "Save Exchange Rates & Swap Fees"}
          </button>
        </form>

      </div>
    </div>
  );
}

export default function CpanelExchangeRatesPage() {
  return (
    <CpanelRouteGuard requiredPermission="exchange_rates.manage">
      <CpanelExchangeRatesContent />
    </CpanelRouteGuard>
  );
}
