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

export interface SwapRangeTier {
  id: string;
  pair: "ngnToUsd" | "usdToNgn" | "ngnToXof" | "xofToNgn" | "usdToXof" | "xofToUsd";
  minAmount: number;
  maxAmount: number;
  markupFee: number;
}

interface ExchangeConfig {
  useFlutterwaveRate: boolean;
  useLiveWorldDollarRate: boolean;
  manualDollarRate: number;
  dollarCommissionFee: number;
  useLiveWorldXofRate: boolean;
  manualXofRate: number;
  xofCommissionFee: number;
  xofToNgnRate: number;
  swapFees: {
    ngnToUsd: number;
    usdToNgn: number;
    ngnToXof: number;
    xofToNgn: number;
    usdToXof: number;
    xofToUsd: number;
  };
  swapRangeTiers: SwapRangeTier[];
}

const DEFAULT_CONFIG: ExchangeConfig = {
  useFlutterwaveRate: false,
  useLiveWorldDollarRate: false,
  manualDollarRate: 1550,
  dollarCommissionFee: 15,
  useLiveWorldXofRate: false,
  manualXofRate: 2.5,
  xofCommissionFee: 0.1,
  xofToNgnRate: 2.5,
  swapFees: {
    ngnToUsd: 50,
    usdToNgn: 1.5,
    ngnToXof: 30,
    xofToNgn: 10,
    usdToXof: 2.0,
    xofToUsd: 15,
  },
  swapRangeTiers: [
    {
      id: "tier-1",
      pair: "ngnToUsd",
      minAmount: 1000,
      maxAmount: 5000,
      markupFee: 1,
    },
  ],
};

function CpanelExchangeRatesContent() {
  const { user } = useAuth();
  const { isDark, toggleTheme } = useCpanelTheme();

  const [config, setConfig] = useState<ExchangeConfig>(DEFAULT_CONFIG);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Live World Rates State
  const [liveWorldDollarRate, setLiveWorldDollarRate] = useState<number | null>(null);
  const [isFetchingLiveDollar, setIsFetchingLiveDollar] = useState(false);

  const [liveWorldXofRate, setLiveWorldXofRate] = useState<number | null>(null);
  const [isFetchingLiveXof, setIsFetchingLiveXof] = useState(false);

  // Range Tier Creator Modal/Form State
  const [newPair, setNewPair] = useState<SwapRangeTier["pair"]>("ngnToUsd");
  const [newMin, setNewMin] = useState<number>(1000);
  const [newMax, setNewMax] = useState<number>(5000);
  const [newFee, setNewFee] = useState<number>(1);

  // Simulator States
  const [simFromCurrency, setSimFromCurrency] = useState<"NGN" | "USD" | "XOF">("NGN");
  const [simToCurrency, setSimToCurrency] = useState<"NGN" | "USD" | "XOF">("USD");
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

  const fetchLiveDollarRate = async () => {
    setIsFetchingLiveDollar(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/USD");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.NGN) {
          setLiveWorldDollarRate(Number(data.rates.NGN));
          toast.success(`Fetched live world market USD rate: ₦${Number(data.rates.NGN).toLocaleString()}`);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch live USD market rate:", err.message);
    } finally {
      setIsFetchingLiveDollar(false);
    }
  };

  const fetchLiveXofRate = async () => {
    setIsFetchingLiveXof(true);
    try {
      const res = await fetch("https://api.exchangerate-api.com/v4/latest/XOF");
      if (res.ok) {
        const data = await res.json();
        if (data?.rates?.NGN) {
          setLiveWorldXofRate(Number(data.rates.NGN));
          toast.success(`Fetched live world market XOF rate: ₦${Number(data.rates.NGN).toLocaleString()}`);
        }
      }
    } catch (err: any) {
      console.warn("Failed to fetch live XOF market rate:", err.message);
    } finally {
      setIsFetchingLiveXof(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config.useLiveWorldDollarRate && !liveWorldDollarRate) {
      fetchLiveDollarRate();
    }
  }, [config.useLiveWorldDollarRate]);

  useEffect(() => {
    if (config.useLiveWorldXofRate && !liveWorldXofRate) {
      fetchLiveXofRate();
    }
  }, [config.useLiveWorldXofRate]);

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

    // Validate all range tiers before save
    for (const t of config.swapRangeTiers || []) {
      if (t.maxAmount <= t.minAmount) {
        toast.error(`Tier error (${t.pair}): Max amount (${t.maxAmount}) must be greater than Min amount (${t.minAmount}).`);
        return;
      }
    }

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
        toast.success(data.message || "Exchange rates, XOF mode, and custom range tiers saved successfully!");
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

  const activeBaseDollarRate = config.useLiveWorldDollarRate
    ? (liveWorldDollarRate || config.manualDollarRate)
    : config.manualDollarRate;
  const effectiveDollarRate = activeBaseDollarRate + config.dollarCommissionFee;

  const activeBaseXofRate = config.useLiveWorldXofRate
    ? (liveWorldXofRate || config.manualXofRate)
    : config.manualXofRate;
  const effectiveXofRate = activeBaseXofRate + config.xofCommissionFee;

  // Pair key helper
  const getPairKey = (from: string, to: string): SwapRangeTier["pair"] | null => {
    if (from === "NGN" && to === "USD") return "ngnToUsd";
    if (from === "USD" && to === "NGN") return "usdToNgn";
    if (from === "NGN" && to === "XOF") return "ngnToXof";
    if (from === "XOF" && to === "NGN") return "xofToNgn";
    if (from === "USD" && to === "XOF") return "usdToXof";
    if (from === "XOF" && to === "USD") return "xofToUsd";
    return null;
  };

  // Simulator calculation with Custom Range Tier Fee checking
  const calculateSimSwap = () => {
    if (simFromCurrency === simToCurrency) return { output: simAmount, fee: 0, appliedTier: null };

    const pairKey = getPairKey(simFromCurrency, simToCurrency);
    let fee = 0;
    let appliedTier: SwapRangeTier | null = null;

    if (pairKey) {
      // Check for matching range tier
      const matchingTier = (config.swapRangeTiers || []).find(
        (t) => t.pair === pairKey && simAmount >= t.minAmount && simAmount <= t.maxAmount
      );

      if (matchingTier) {
        fee = matchingTier.markupFee;
        appliedTier = matchingTier;
      } else {
        fee = config.swapFees[pairKey] || 0;
      }
    }

    let converted = 0;
    if (simFromCurrency === "NGN" && simToCurrency === "USD") {
      const net = Math.max(0, simAmount - fee);
      converted = net / effectiveDollarRate;
    } else if (simFromCurrency === "USD" && simToCurrency === "NGN") {
      const net = Math.max(0, simAmount - fee);
      converted = net * effectiveDollarRate;
    } else if (simFromCurrency === "NGN" && simToCurrency === "XOF") {
      const net = Math.max(0, simAmount - fee);
      converted = net * effectiveXofRate;
    } else if (simFromCurrency === "XOF" && simToCurrency === "NGN") {
      const net = Math.max(0, simAmount - fee);
      converted = net / effectiveXofRate;
    } else if (simFromCurrency === "USD" && simToCurrency === "XOF") {
      const net = Math.max(0, simAmount - fee);
      const ngnEquivalent = net * effectiveDollarRate;
      converted = ngnEquivalent * effectiveXofRate;
    } else if (simFromCurrency === "XOF" && simToCurrency === "USD") {
      const net = Math.max(0, simAmount - fee);
      const ngnEquivalent = net / effectiveXofRate;
      converted = ngnEquivalent / effectiveDollarRate;
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
                Configure USD & XOF live market modes, custom range markup fees, commission margins, and multi-currency swap rules.
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

        {/* Live World Rate Modes Grid (USD & XOF) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* USD Live Rate Mode Card */}
          <div className="bg-[#0b1329] text-white rounded-2xl p-6 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-[#FC7A00]/20 text-[#FC7A00] border border-[#FC7A00]/30 tracking-wider">
                  USD RATE ENGINE
                </span>
                <h2 className="text-base font-extrabold tracking-tight mt-1.5">Live FX Rate Modes</h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  Auto-fetches real-time USD exchange rates + your commission fee.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {/* Flutterwave Rate Toggle */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-extrabold text-amber-400">Flutterwave Rate</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useFlutterwaveRate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig({
                          ...config,
                          useFlutterwaveRate: checked,
                          useLiveWorldDollarRate: checked ? false : config.useLiveWorldDollarRate
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* World Live Rate Toggle */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-extrabold text-slate-300">World Rate</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useLiveWorldDollarRate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig({
                          ...config,
                          useLiveWorldDollarRate: checked,
                          useFlutterwaveRate: checked ? false : config.useFlutterwaveRate
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-xl border transition-all space-y-1", config.useLiveWorldDollarRate ? "bg-slate-950/60 border-slate-800 opacity-80" : "bg-slate-900/80 border-slate-800")}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400">Manual Dollar Rate</span>
                  {config.useLiveWorldDollarRate && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-emerald-500/20 text-emerald-400">
                      {isFetchingLiveDollar ? "Fetching..." : "Live Active"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    disabled={config.useLiveWorldDollarRate}
                    value={config.useLiveWorldDollarRate ? (liveWorldDollarRate || config.manualDollarRate) : config.manualDollarRate}
                    onChange={(e) => setConfig({ ...config, manualDollarRate: Math.max(1, parseFloat(e.target.value) || 0) })}
                    className={cn(
                      "w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold outline-none focus:border-[#FC7A00] transition-all",
                      config.useLiveWorldDollarRate && "opacity-60 cursor-not-allowed text-emerald-400 border-slate-800 bg-slate-900"
                    )}
                  />
                </div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block">USD Commission Fee</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    value={config.dollarCommissionFee}
                    onChange={(e) => setConfig({ ...config, dollarCommissionFee: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-emerald-400 outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400">Effective Customer USD Sell Rate:</span>
              <strong className="text-base font-black text-emerald-400 font-mono">
                ₦{effectiveDollarRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} / USD
              </strong>
            </div>
          </div>

          {/* XOF Live Rate Mode Card */}
          <div className="bg-[#0b1329] text-white rounded-2xl p-6 border border-slate-800 space-y-5 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="px-2.5 py-0.5 rounded text-[9px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30 tracking-wider">
                  XOF (FCFA) RATE ENGINE
                </span>
                <h2 className="text-base font-extrabold tracking-tight mt-1.5">Live XOF Rate Modes</h2>
                <p className="text-[11px] text-slate-400 mt-0.5 font-medium">
                  Auto-fetches XOF (FCFA) live exchange rate + your commission fee.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
                {/* Flutterwave XOF Toggle */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-extrabold text-amber-400">Flutterwave Rate</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useFlutterwaveXofRate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig({
                          ...config,
                          useFlutterwaveXofRate: checked,
                          useLiveWorldXofRate: checked ? false : config.useLiveWorldXofRate
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {/* World XOF Toggle */}
                <div className="flex items-center gap-2 bg-slate-900 p-2 rounded-xl border border-slate-800">
                  <span className="text-[11px] font-extrabold text-slate-300">World Rate</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.useLiveWorldXofRate}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConfig({
                          ...config,
                          useLiveWorldXofRate: checked,
                          useFlutterwaveXofRate: checked ? false : config.useFlutterwaveXofRate
                        });
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-xl border transition-all space-y-1", config.useLiveWorldXofRate ? "bg-slate-950/60 border-slate-800 opacity-80" : "bg-slate-900/80 border-slate-800")}>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-slate-400">Manual XOF Rate (₦)</span>
                  {config.useLiveWorldXofRate && (
                    <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase bg-blue-500/20 text-blue-400">
                      {isFetchingLiveXof ? "Fetching..." : "Live Active"}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    step="0.01"
                    disabled={config.useLiveWorldXofRate}
                    value={config.useLiveWorldXofRate ? (liveWorldXofRate || config.manualXofRate) : config.manualXofRate}
                    onChange={(e) => {
                      const val = Math.max(0.01, parseFloat(e.target.value) || 0);
                      setConfig({ ...config, manualXofRate: val, xofToNgnRate: val });
                    }}
                    className={cn(
                      "w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold outline-none focus:border-[#FC7A00] transition-all",
                      config.useLiveWorldXofRate && "opacity-60 cursor-not-allowed text-blue-400 border-slate-800 bg-slate-900"
                    )}
                  />
                </div>
              </div>

              <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-800 space-y-1">
                <span className="text-[10px] font-black uppercase text-slate-400 block">XOF Commission Fee</span>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">₦</span>
                  <input
                    type="number"
                    step="0.01"
                    value={config.xofCommissionFee}
                    onChange={(e) => setConfig({ ...config, xofCommissionFee: Math.max(0, parseFloat(e.target.value) || 0) })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-blue-400 outline-none focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="bg-slate-900/90 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-slate-400">Effective Customer XOF Sell Rate:</span>
              <strong className="text-base font-black text-blue-400 font-mono">
                ₦{effectiveXofRate.toLocaleString(undefined, { maximumFractionDigits: 3 })} / FCFA
              </strong>
            </div>
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
                  onChange={(e) => setNewPair(e.target.value as any)}
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
                      title="Delete Tier"
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
                    Test exact user conversions, effective rates, range tier matching, and deducted swap fees in real-time
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

              <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-1">
                <span className="text-[9px] font-black uppercase text-gray-400 block">Simulated User Receives</span>
                <strong className="text-base font-black text-emerald-500 font-mono block">
                  {simToCurrency === "USD" ? "$" : simToCurrency === "XOF" ? "FCFA " : "₦"}
                  {simResult.output.toLocaleString(undefined, { maximumFractionDigits: 2 })} {simToCurrency}
                </strong>
                <div className="text-[9.5px] text-gray-400 font-bold space-y-0.5 border-t border-gray-200 dark:border-gray-800 pt-1 mt-1">
                  <div className="flex justify-between text-emerald-600 font-extrabold">
                    <span>Active Rate:</span>
                    <span>
                      {simFromCurrency === "NGN" && simToCurrency === "USD" && `1 USD = ₦${effectiveDollarRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} (1 NGN = $${(1 / effectiveDollarRate).toFixed(6)})`}
                      {simFromCurrency === "USD" && simToCurrency === "NGN" && `1 USD = ₦${effectiveDollarRate.toLocaleString(undefined, { maximumFractionDigits: 2 })}`}
                      {simFromCurrency === "NGN" && simToCurrency === "XOF" && `1 NGN = ${effectiveXofRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} XOF (1 XOF = ₦${(1 / effectiveXofRate).toFixed(4)})`}
                      {simFromCurrency === "XOF" && simToCurrency === "NGN" && `1 NGN = ${effectiveXofRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} XOF (1 XOF = ₦${(1 / effectiveXofRate).toFixed(4)})`}
                      {(simFromCurrency === "USD" && simToCurrency === "XOF" || (simFromCurrency === "XOF" && simToCurrency === "USD")) && `1 USD = ${(effectiveDollarRate * effectiveXofRate).toLocaleString(undefined, { maximumFractionDigits: 2 })} XOF`}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Swap Fee Deducted:</span>
                    <span>{simResult.fee} {simFromCurrency} {simResult.appliedTier ? "(Tier)" : "(Default)"}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>Net Amount Converted:</span>
                    <span>{Math.max(0, simAmount - simResult.fee).toLocaleString()} {simFromCurrency}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-4 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
          >
            {isSaving ? <><ButtonSpinner /> Saving Configurations...</> : "Save Exchange Rates, XOF Mode & Range Tiers"}
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
