"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface FixedDeposit {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amount: number;
  interestRate: number;
  status: "ACTIVE" | "SETTLED" | "CLAIMED" | "CANCELLED" | string;
  createdAt: string;
  maturesAt: string;
  claimedAt?: string;
  description: string;
}

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function AdminFixedDepositsPage() {
  const { user, userData } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();

  // Theme support
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cpanel_theme");
      if (cached === "dark" || cached === "light") {
        setTheme(cached);
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("cpanel_theme", next);
      }
      return next;
    });
  };

  const isDark = theme === "dark";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full";
  const labelClass = isDark ? "text-gray-300" : "text-gray-900";

  // Admin lock validation
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Check cookie-based admin session on mount
  useEffect(() => {
    const checkCPanelSession = async () => {
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setIsAdminUnlocked(true);
          setAdminEmail(data.user.email);
        }
      } catch (err) {
        console.warn("No active admin cookie session found on mount:", err);
      }
    };
    checkCPanelSession();
  }, []);

  // Pre-fill admin email when user loads as fallback
  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email);
    }
  }, [user, adminEmail]);

  // Deposits Data States
  const [investments, setInvestments] = useState<FixedDeposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "ACTIVE" | "SETTLED">("ALL");

  const fetchInvestments = async () => {
    setIsLoading(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/investments", {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInvestments(data.investments || []);
      } else {
        toast.error(data.error || "Failed to load system investments.");
      }
    } catch (err) {
      console.error("Error loading investments:", err);
      toast.error("Network communication failure loading investments.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchInvestments();
    }
  }, [isAdminUnlocked, user]);

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);

    if (!adminEmail.trim()) {
      toast.error("Please enter your admin email address.");
      setIsVerifyingPin(false);
      return;
    }

    if (!adminPin || adminPin.length < 4) {
      toast.error("Please enter your 4-digit Access PIN.");
      setIsVerifyingPin(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: adminEmail,
          pin: adminPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminUnlocked(true);
        toast.success(data.message || "Identity PIN Verified. Access Granted!");
      } else {
        toast.error(data.error || "Invalid Email or Access PIN!");
      }
    } catch (err: any) {
      toast.error("API connection error during verification.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Calculations & Analytics
  const activeDeposits = investments.filter(i => i.status === "ACTIVE");
  const settledDeposits = investments.filter(i => i.status === "SETTLED" || i.status === "CLAIMED");

  const totalActiveVolume = activeDeposits.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
  const totalSettledVolume = settledDeposits.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);

  // Search and Tab filtering
  const filteredInvestments = investments.filter((inv) => {
    // 1. Tab filter
    if (filterTab === "ACTIVE" && inv.status !== "ACTIVE") return false;
    if (filterTab === "SETTLED" && inv.status !== "SETTLED" && inv.status !== "CLAIMED") return false;

    // 2. Search filter
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      inv.userName?.toLowerCase().includes(term) ||
      inv.userEmail?.toLowerCase().includes(term) ||
      inv.userPhone?.includes(term) ||
      inv.status?.toLowerCase().includes(term) ||
      String(inv.amount).includes(term)
    );
  });

  if (!isAdminUnlocked) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800" style={{ marginTop: 0 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 flex flex-col items-center text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00]">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_maybe</span>
          </div>

          <div>
            <h2 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">Admin Gatekeeper</h2>
            <p className="font-hanken text-xs text-gray-500 mt-1.5 font-semibold leading-relaxed">
              Enter your administrative email and access PIN to verify authorization for Fixed Deposit ledger auditing.
            </p>
          </div>

          <form onSubmit={handleAdminVerify} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin Email Address</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin Access PIN</label>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter 4-digit Access PIN"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-mono font-bold text-xl text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifyingPin}
              className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isVerifyingPin ? <><ButtonSpinner /> Verifying Authority...</> : "Verify Authority"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "min-h-screen flex flex-col font-hanken !mt-0 relative transition-colors duration-300",
        isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-800"
      )}
      style={{ marginTop: 0 }}
    >
      {/* Header Banner */}
      <div role="banner" className={cn(
        "flex justify-between items-center px-8 py-5 border-b transition-colors duration-300",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-4">
          <Link
            href="/cpanel"
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:brightness-110",
              isDark ? "border-gray-700 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-800"
            )}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className={cn("font-hanken font-extrabold text-lg", isDark ? "text-white" : "text-gray-800")}>
              Fixed Deposit Auditing
            </h1>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">Secure System Savings Ledger</p>
          </div>
        </div>

        {/* Theme Toggle */}
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
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>

      <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24 md:pb-8">
        {/* Metrics Overview grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Active Volume */}
          <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Active Savings</p>
            <p className="font-mono text-xl sm:text-2xl font-black text-emerald-500 mt-1 leading-none">
              ₦{totalActiveVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2.5">
              Accumulating Yield
            </p>
          </div>

          {/* Settled Volume */}
          <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Settled / Credited</p>
            <p className="font-mono text-xl sm:text-2xl font-black text-blue-500 mt-1 leading-none">
              ₦{totalSettledVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2.5">
              Matured & Disbursed
            </p>
          </div>

          {/* Active Depositors Count */}
          <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Active Accounts</p>
            <p className="font-mono text-xl sm:text-2xl font-black text-[#FC7A00] mt-1 leading-none">
              {activeDeposits.length}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2.5">
              Unique Active Placements
            </p>
          </div>

          {/* Total Placements Count */}
          <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
            <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Ledger Audits</p>
            <p className="font-mono text-xl sm:text-2xl font-black text-gray-400 mt-1 leading-none">
              {investments.length}
            </p>
            <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2.5">
              Lifetime Savings Placements
            </p>
          </div>
        </div>

        {/* Tab Selection Row & Filter Search Bar */}
        <div className={cn("rounded-2xl p-4 border transition-colors duration-300 space-y-4", panelClass)}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 flex-wrap">
            <div className="grid grid-cols-3 gap-1 bg-gray-150 dark:bg-gray-800 p-0.5 rounded-xl max-w-sm w-full">
              {(["ALL", "ACTIVE", "SETTLED"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setFilterTab(tab)}
                  className={cn(
                    "py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
                    filterTab === tab
                      ? "bg-white dark:bg-gray-950 text-[#FC7A00] shadow-sm"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search user email or phone..."
                className={inputClass}
              />
              <button
                type="button"
                disabled={isLoading}
                onClick={fetchInvestments}
                className="px-4 py-2 bg-black text-white hover:bg-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap"
              >
                {isLoading ? <ButtonSpinner /> : "Reload"}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto pr-1">
            {isLoading ? (
              <div className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                <ButtonSpinner /> Auditing system savings records...
              </div>
            ) : filteredInvestments.length === 0 ? (
              <div className="text-center py-16 text-gray-500 uppercase font-black text-xs">
                No matching Fixed Deposit records found.
              </div>
            ) : (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-gray-250 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <th className="pb-3 pl-2">User Details</th>
                    <th className="pb-3 text-right">Principal</th>
                    <th className="pb-3 text-center">Yield Rate</th>
                    <th className="pb-3 text-right">Est. Accrued</th>
                    <th className="pb-3 text-center">Status</th>
                    <th className="pb-3 text-center">Placement / Maturity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                  {filteredInvestments.map((inv) => {
                    const estYield = inv.amount * (Number(inv.interestRate) / 100);
                    const totalEstimatedPayout = inv.amount + estYield;
                    const isActive = inv.status === "ACTIVE";

                    return (
                      <tr key={inv.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                        <td className="py-3.5 pl-2">
                          <p className="font-extrabold text-sm">{inv.userName || "System User"}</p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{inv.userEmail}</p>
                          <p className="text-[9px] font-mono text-gray-500">{inv.userPhone}</p>
                        </td>
                        <td className="py-3.5 text-right font-mono font-bold text-sm">
                          ₦{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-center font-mono font-black text-[#FC7A00]">
                          {inv.interestRate}%
                        </td>
                        <td className="py-3.5 text-right font-mono font-extrabold text-emerald-500">
                          +₦{estYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-3.5 text-center">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                            isActive
                              ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 animate-pulse"
                              : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                          )}>
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-3.5 text-center">
                          <p className="text-[9px] font-semibold text-gray-400">Created: {new Date(inv.createdAt).toLocaleDateString()}</p>
                          <p className="text-[9px] font-extrabold text-[#FC7A00] mt-0.5">Matures: {new Date(inv.maturesAt).toLocaleDateString()}</p>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
