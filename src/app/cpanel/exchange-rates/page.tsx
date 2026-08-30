"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  DEFAULT_FULL_EXCHANGE_RATES_CONFIG,
  FullExchangeRatesConfig,
  NON_NGN_CURRENCIES,
  SUPPORTED_CURRENCIES,
  calculateDirectionalCustomerRate,
  getCurrencyAdjustments,
} from "@/lib/exchange-pricing";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export interface SwapRangeTier {
  id: string;
  pair: string;
  minAmount: number;
  maxAmount: number;
  markupFee: number;
}

function CpanelExchangeRatesContent() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useCpanelTheme();

  const [config, setConfig] = useState<FullExchangeRatesConfig>(DEFAULT_FULL_EXCHANGE_RATES_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Live Provider Rates State
  const [flwDollarRate, setFlwDollarRate] = useState<number | null>(null);
  const [flwXofRate, setFlwXofRate] = useState<number | null>(null);
  const [liveWorldDollarRate, setLiveWorldDollarRate] = useState<number | null>(null);
  const [liveWorldXofRate, setLiveWorldXofRate] = useState<number | null>(null);

  // Range Tier Creator Modal/Form State
  const [newPair, setNewPair] = useState<string>("ngnToUsd");
  const [newMin, setNewMin] = useState<number>(1000);
  const [newMax, setNewMax] = useState<number>(5000);
  const [newFee, setNewFee] = useState<number>(1);

  // Simulator States
  const [simFromCurrency, setSimFromCurrency] = useState<string>("NGN");
  const [simToCurrency, setSimToCurrency] = useState<string>("USD");
  const [simAmount, setSimAmount] = useState<number>(3000);

  const fetchConfig = async () => {
    setIsLoading(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch("/api/admin/exchange-rates", { headers });
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig(data.config);

        // Fetch live active rates to auto-fill inputs
        try {
          const publicRes = await fetch("/api/exchange-rates");
          const publicData = await publicRes.json();
          if (publicRes.ok && publicData.success && publicData.rates) {
            const usdPair = publicData.rates.usdToNgn;
            const xofPair = publicData.rates.xofToNgn;

            if (usdPair?.available && typeof usdPair.baseRate === "number") {
              setFlwDollarRate(usdPair.baseRate);
            }
            if (xofPair?.available && typeof xofPair.baseRate === "number") {
              setFlwXofRate(xofPair.baseRate);
            }

            const fetchedDollar = Number(publicData.rates.baseDollarRate);
            const fetchedXof = Number(publicData.rates.baseXofRate);

            if (!isNaN(fetchedDollar) && fetchedDollar > 0) {
              setLiveWorldDollarRate(fetchedDollar);
              if (data.config.useFlutterwaveRate || data.config.useLiveWorldDollarRate) {
                setConfig((prev) => ({ ...prev, manualDollarRate: fetchedDollar }));
              }
            }
            if (!isNaN(fetchedXof) && fetchedXof > 0) {
              setLiveWorldXofRate(fetchedXof);
              if (data.config.useFlutterwaveXofRate || data.config.useLiveWorldXofRate) {
                setConfig((prev) => ({ ...prev, manualXofRate: fetchedXof }));
              }
            }
          }
        } catch {
          // ignore background fetch error
        }
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

  const handleAddTier = () => {
    if (newMax <= newMin) {
      toast.error(`Invalid range! Max amount (${newMax}) must be strictly greater than Min amount (${newMin}).`);
      return;
    }
    if (newFee < 0) {
      toast.error("Markup fee cannot be negative.");
      return;
    }

    const newTier: SwapRangeTier = {
      id: `tier-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      pair: newPair,
      minAmount: newMin,
      maxAmount: newMax,
      markupFee: newFee,
    };

    setConfig((prev) => ({
      ...prev,
      swapRangeTiers: [...(prev.swapRangeTiers || []), newTier],
    }));

    toast.success(`Added range markup tier for ${newPair.toUpperCase()} (${newMin} - ${newMax})!`);
  };

  const handleDeleteTier = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      swapRangeTiers: prev.swapRangeTiers.filter((t) => t.id !== id),
    }));
    toast.success("Removed custom range markup tier.");
  };

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
        toast.success(data.message || "Exchange rates, Bid/Ask spreads, and swap fees saved successfully!");
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

  const activeBaseDollarRate = config.useFlutterwaveRate
    ? (flwDollarRate || liveWorldDollarRate || config.manualDollarRate)
    : (config.useLiveWorldDollarRate ? (liveWorldDollarRate || config.manualDollarRate) : config.manualDollarRate);

  const activeBaseXofRate = config.useFlutterwaveXofRate
    ? (flwXofRate || liveWorldXofRate || config.manualXofRate)
    : (config.useLiveWorldXofRate ? (liveWorldXofRate || config.manualXofRate) : config.manualXofRate);

  const getPairKey = (from: string, to: string): string | null => {
    if (from === "NGN" && to === "USD") return "ngnToUsd";
    if (from === "USD" && to === "NGN") return "usdToNgn";
    if (from === "NGN" && to === "XOF") return "ngnToXof";
    if (from === "XOF" && to === "NGN") return "xofToNgn";
    if (from === "USD" && to === "XOF") return "usdToXof";
    if (from === "XOF" && to === "USD") return "xofToUsd";
    return null;
  };

  const calculateSimSwap = () => {
    if (simFromCurrency === simToCurrency) return { output: simAmount, fee: 0, appliedTier: null };

    const pairKey = getPairKey(simFromCurrency, simToCurrency);
    let fee = 0;
    let appliedTier: SwapRangeTier | null = null;

    if (pairKey) {
      const matchingTier = (config.swapRangeTiers || []).find(
        (t) => t.pair === pairKey && simAmount >= t.minAmount && simAmount <= t.maxAmount
      );

      if (matchingTier) {
        fee = matchingTier.markupFee;
        appliedTier = matchingTier;
      } else {
        fee = config.swapFees?.[pairKey] || 0;
      }
    }

    const net = Math.max(0, simAmount - fee);
    let converted = 0;

    if (simFromCurrency === "NGN" && simToCurrency !== "NGN") {
      const baseRate = simToCurrency === "USD" ? activeBaseDollarRate : (simToCurrency === "XOF" ? activeBaseXofRate : 1000);
      const calc = calculateDirectionalCustomerRate({ sourceCurrency: simFromCurrency, destinationCurrency: simToCurrency, baseRate, config });
      converted = net * calc.unitExchangeRate;
    } else if (simFromCurrency !== "NGN" && simToCurrency === "NGN") {
      const baseRate = simFromCurrency === "USD" ? activeBaseDollarRate : (simFromCurrency === "XOF" ? activeBaseXofRate : 1000);
      const calc = calculateDirectionalCustomerRate({ sourceCurrency: simFromCurrency, destinationCurrency: simToCurrency, baseRate, config });
      converted = net * calc.unitExchangeRate;
    } else {
      const fromBaseRate = simFromCurrency === "USD" ? activeBaseDollarRate : activeBaseXofRate;
      const toBaseRate = simToCurrency === "USD" ? activeBaseDollarRate : activeBaseXofRate;
      const fromCalc = calculateDirectionalCustomerRate({ sourceCurrency: simFromCurrency, destinationCurrency: "NGN", baseRate: fromBaseRate, config });
      const toCalc = calculateDirectionalCustomerRate({ sourceCurrency: "NGN", destinationCurrency: simToCurrency, baseRate: toBaseRate, config });
      converted = (net * fromCalc.unitExchangeRate) * toCalc.unitExchangeRate;
    }

    return { output: Math.max(0, converted), fee, appliedTier };
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
                Configure Customer Buy & Customer Sell directional adjustments for all 13 supported currencies.
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

        {/* Currency Directional Adjustments Grid */}
        <div className="space-y-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-orange-500 flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px]">tune</span>
            Supported Currencies Directional Pricing Adjustments
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {NON_NGN_CURRENCIES.map((curr) => {
              const buyKey = `${curr.toLowerCase()}SellMarkup` as keyof FullExchangeRatesConfig;
              const sellKey = `${curr.toLowerCase()}BuyMarkup` as keyof FullExchangeRatesConfig;
              const buyVal = Number(config[buyKey] ?? 0);
              const sellVal = Number(config[sellKey] ?? 0);

              return (
                <div key={curr} className="bg-[#0b1329] text-white rounded-2xl p-5 border border-slate-800 space-y-4 shadow-lg">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase bg-[#FC7A00]/20 text-[#FC7A00] border border-[#FC7A00]/30 tracking-wider">
                        {curr}
                      </span>
                      <h3 className="text-xs font-extrabold tracking-tight">{curr} Directional Pricing</h3>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">
                        Customer Buy {curr} Adjustment (NGN ➔ {curr})
                      </span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">+₦</span>
                        <input
                          type="number"
                          step="any"
                          value={buyVal}
                          onChange={(e) => setConfig({ ...config, [buyKey]: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs font-mono font-bold text-amber-400 outline-none focus:border-amber-500"
                        />
                      </div>
                    </div>

                    <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <span className="text-[9.5px] font-black uppercase text-slate-400 block">
                        Customer Sell {curr} Adjustment ({curr} ➔ NGN)
                      </span>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">-₦</span>
                        <input
                          type="number"
                          step="any"
                          value={sellVal}
                          onChange={(e) => setConfig({ ...config, [sellKey]: Math.max(0, parseFloat(e.target.value) || 0) })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CONFIGURE CUSTOM RANGE MARKUP FEES */}
        <div className={cn("p-6 rounded-2xl border space-y-6", panelClass)}>
          <div className="border-b pb-3.5 flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-purple-500 text-[24px]">price_change</span>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-purple-500">
                  Configure Custom Range Markup Fees
                </h3>
              </div>
              <p className="text-[11px] text-gray-400 font-bold uppercase mt-0.5">
                Set custom swap fees based on user swap amount ranges (e.g. NGN 1,000 to 5,000 ➔ 1 NGN fee).
              </p>
            </div>
            <span className="px-2.5 py-0.5 rounded text-[8.5px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
              Tiered Fee Engine
            </span>
          </div>

          {/* Form to Add New Range Tier */}
          <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-500/5 space-y-3">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-400 block">
              Add New Custom Range Tier
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 block">Currency Pair</label>
                <select
                  value={newPair}
                  onChange={(e) => setNewPair(e.target.value)}
                  className={cn(inputClass, "cursor-pointer font-bold")}
                >
                  <option value="ngnToUsd">NGN ➔ USD</option>
                  <option value="usdToNgn">USD ➔ NGN</option>
                  <option value="ngnToXof">NGN ➔ XOF</option>
                  <option value="xofToNgn">XOF ➔ NGN</option>
                  <option value="usdToXof">USD ➔ XOF</option>
                  <option value="xofToUsd">XOF ➔ USD</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 block">Min Amount</label>
                <input
                  type="number"
                  value={newMin}
                  onChange={(e) => setNewMin(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 block">Max Amount</label>
                <input
                  type="number"
                  value={newMax}
                  onChange={(e) => setNewMax(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase text-gray-400 block">Markup Fee</label>
                <input
                  type="number"
                  value={newFee}
                  onChange={(e) => setNewFee(Math.max(0, parseFloat(e.target.value) || 0))}
                  className={inputClass}
                />
              </div>

              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAddTier}
                  className="w-full h-10 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer shadow-md"
                >
                  <span className="material-symbols-outlined text-[16px]">add_circle</span> Add Tier
                </button>
              </div>
            </div>
          </div>

          {/* Configured Range Tiers List */}
          <div className="space-y-2">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
              Active Custom Range Tiers ({config.swapRangeTiers?.length || 0})
            </span>

            {(!config.swapRangeTiers || config.swapRangeTiers.length === 0) ? (
              <div className="p-4 rounded-xl border border-dashed text-center text-xs text-gray-400 font-medium">
                No custom range tiers configured. Standard default swap fees will apply.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {config.swapRangeTiers.map((tier) => (
                  <div
                    key={tier.id}
                    className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 flex items-center justify-between gap-2 shadow-3xs"
                  >
                    <div className="space-y-0.5">
                      <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-purple-500/20 text-purple-400 border border-purple-500/30">
                        {tier.pair.toUpperCase()}
                      </span>
                      <p className="text-xs font-bold text-gray-900 dark:text-white font-mono mt-1">
                        {tier.minAmount.toLocaleString()} ➔ {tier.maxAmount.toLocaleString()}
                      </p>
                      <p className="text-[10px] font-bold text-emerald-500">
                        Custom Fee: {tier.markupFee} {tier.pair.startsWith("usd") ? "$" : tier.pair.startsWith("xof") ? "FCFA" : "₦"}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-500 transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Multi-Currency Standard Default Swap Fees Grid */}
        <form onSubmit={handleSave} className="space-y-6">
          <div className={cn("p-6 rounded-2xl border space-y-4", panelClass)}>
            <div className="border-b pb-3.5 flex items-center justify-between flex-wrap gap-2">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-[#FC7A00] flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]">swap_horiz</span>
                  <span>Default Fallback Swap Fees</span>
                </h3>
                <p className="text-[10.5px] text-gray-400 font-bold uppercase mt-0.5">
                  Fallback transaction swap fees applied when user amount does not fall into a custom range tier.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">NGN ➔ USD Swap Fee (₦)</span>
                <input
                  type="number"
                  value={config.swapFees?.ngnToUsd ?? 50}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, ngnToUsd: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">USD ➔ NGN Swap Fee ($)</span>
                <input
                  type="number"
                  value={config.swapFees?.usdToNgn ?? 1.5}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, usdToNgn: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">NGN ➔ XOF Swap Fee (₦)</span>
                <input
                  type="number"
                  value={config.swapFees?.ngnToXof ?? 30}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, ngnToXof: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">XOF ➔ NGN Swap Fee (FCFA)</span>
                <input
                  type="number"
                  value={config.swapFees?.xofToNgn ?? 10}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, xofToNgn: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">USD ➔ XOF Swap Fee ($)</span>
                <input
                  type="number"
                  value={config.swapFees?.usdToXof ?? 2.0}
                  onChange={(e) => setConfig({ ...config, swapFees: { ...config.swapFees, usdToXof: Math.max(0, parseFloat(e.target.value) || 0) } })}
                  className={inputClass}
                />
              </div>

              <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/40 space-y-1">
                <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">XOF ➔ USD Swap Fee (FCFA)</span>
                <input
                  type="number"
                  value={config.swapFees?.xofToUsd ?? 15}
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
                    Test exact user conversions across all 14 supported currencies in real-time
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">From Currency</label>
                <select
                  value={simFromCurrency}
                  onChange={(e) => setSimFromCurrency(e.target.value)}
                  className={cn(inputClass, "cursor-pointer font-bold")}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">To Currency</label>
                <select
                  value={simToCurrency}
                  onChange={(e) => setSimToCurrency(e.target.value)}
                  className={cn(inputClass, "cursor-pointer font-bold")}
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
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

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                <span className="text-[9px] font-black uppercase text-gray-400 block">Simulated User Receives</span>
                <strong className="text-base font-black text-emerald-500 font-mono block">
                  {simResult.output.toLocaleString(undefined, { maximumFractionDigits: 2 })} {simToCurrency}
                </strong>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isSaving ? <><ButtonSpinner /> Saving Configurations...</> : "Save All Currency Exchange Rates & Spread Markups"}
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
