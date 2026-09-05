"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { SavingsPlanData } from "@/lib/savings-plans-types";

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

function AdminFixedDepositsPageContent() {
  const { user } = useAuth();
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

  // Navigation tab: AUDIT vs PLANS
  const [activeTab, setActiveTab] = useState<"PLANS" | "AUDIT">("PLANS");

  // Auth Session Check
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

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

  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email);
    }
  }, [user, adminEmail]);

  // Deposits Data States
  const [investments, setInvestments] = useState<FixedDeposit[]>([]);
  const [isLoadingInvestments, setIsLoadingInvestments] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTab, setFilterTab] = useState<"ALL" | "ACTIVE" | "SETTLED" | "CANCELLED">("ALL");

  // Savings Plans Customizer States
  const [plans, setPlans] = useState<SavingsPlanData[]>([]);
  const [isLoadingPlans, setIsLoadingLoadingPlans] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Partial<SavingsPlanData> | null>(null);
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Month/Year Options String Helpers for editing
  const [monthOptsStr, setMonthOptsStr] = useState("1, 3, 6, 9");
  const [yearOptsStr, setYearOptsStr] = useState("1, 2, 3");

  const fetchPlans = async () => {
    setIsLoadingLoadingPlans(true);
    try {
      const isMock = typeof window !== "undefined" && (sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true"));
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch("/api/admin/investments/plans", { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.plans)) {
        setPlans(data.plans);
      }
    } catch (err) {
      console.warn("Failed to load savings plans:", err);
    } finally {
      setIsLoadingLoadingPlans(false);
    }
  };

  const fetchInvestments = async () => {
    setIsLoadingInvestments(true);
    try {
      const isMock = typeof window !== "undefined" && (sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true"));
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/investments", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setInvestments(data.investments || []);
      }
    } catch (err) {
      console.error("Error loading investments:", err);
    } finally {
      setIsLoadingInvestments(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchPlans();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail, pin: adminPin }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminUnlocked(true);
        toast.success(data.message || "Identity PIN Verified. Access Granted!");
      } else {
        toast.error(data.error || "Invalid Email or Access PIN!");
      }
    } catch {
      toast.error("API connection error during verification.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  // Open Modal to Add/Edit Plan
  const handleOpenModal = (planToEdit?: SavingsPlanData) => {
    if (planToEdit) {
      setEditingPlan({ ...planToEdit });
      setMonthOptsStr(Array.isArray(planToEdit.monthOptions) ? planToEdit.monthOptions.join(", ") : "1, 3, 6, 9");
      setYearOptsStr(Array.isArray(planToEdit.yearOptions) ? planToEdit.yearOptions.join(", ") : "1, 2, 3");
    } else {
      setEditingPlan({
        id: "",
        name: "",
        description: "",
        type: "SAVINGS",
        logoUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        badgeTag: "POPULAR",
        apr: 12.5,
        interestType: "SIMPLE",
        allowMonths: true,
        allowYears: true,
        allowCustom: true,
        minCustomDays: 7,
        maxCustomDays: 1095,
        defaultDurationDays: 30,
        isAmountRequired: true,
        minInvestment: 1000,
        maxInvestment: 10000000,
        status: "ACTIVE",
      });
      setMonthOptsStr("1, 3, 6, 9");
      setYearOptsStr("1, 2, 3");
    }
    setIsModalOpen(true);
  };

  // Handle Logo Upload via ImgBB
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    toast.loading("Uploading logo image...");

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      toast.dismiss();

      if (res.ok && data.url) {
        setEditingPlan((prev) => (prev ? { ...prev, logoUrl: data.url } : null));
        toast.success("Logo uploaded successfully!");
      } else {
        toast.error(data.error || "Logo upload failed.");
      }
    } catch {
      toast.dismiss();
      toast.error("Failed to upload logo.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  // Save Plan
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan || !editingPlan.name?.trim()) {
      toast.warning("Plan Title/Name is required.");
      return;
    }

    setIsSavingPlan(true);

    const parsedMonths = monthOptsStr.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);
    const parsedYears = yearOptsStr.split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n > 0);

    const payload = {
      action: "upsert",
      plan: {
        ...editingPlan,
        monthOptions: parsedMonths.length > 0 ? parsedMonths : [1, 3, 6, 9],
        yearOptions: parsedYears.length > 0 ? parsedYears : [1, 2, 3],
      },
    };

    try {
      const isMock = typeof window !== "undefined" && (sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true"));
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/investments/plans", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Savings Plan saved successfully!");
        if (Array.isArray(data.plans)) {
          setPlans(data.plans);
        } else {
          fetchPlans();
        }
        setIsModalOpen(false);
      } else {
        toast.error(data.error || "Failed to save savings plan.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving savings plan.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Delete Plan
  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Are you sure you want to delete this savings plan?")) return;

    try {
      const isMock = typeof window !== "undefined" && (sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true"));
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/investments/plans", {
        method: "POST",
        headers,
        body: JSON.stringify({ action: "delete", planId }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Savings plan deleted successfully!");
        if (Array.isArray(data.plans)) {
          setPlans(data.plans);
        } else {
          fetchPlans();
        }
      } else {
        toast.error(data.error || "Failed to delete savings plan.");
      }
    } catch {
      toast.error("Network error deleting savings plan.");
    }
  };

  // Analytics & Filtering
  const activeDeposits = investments.filter((i) => i.status === "ACTIVE");
  const settledDeposits = investments.filter((i) => i.status === "SETTLED" || i.status === "CLAIMED");
  const cancelledDeposits = investments.filter((i) => i.status === "CANCELLED" || i.status === "CANCELED");

  const totalActiveVolume = activeDeposits.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
  const totalSettledVolume = settledDeposits.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
  const totalCancelledVolume = cancelledDeposits.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);

  const filteredInvestments = investments.filter((inv) => {
    if (filterTab === "ACTIVE" && inv.status !== "ACTIVE") return false;
    if (filterTab === "SETTLED" && inv.status !== "SETTLED" && inv.status !== "CLAIMED") return false;
    if (filterTab === "CANCELLED" && inv.status !== "CANCELLED" && inv.status !== "CANCELED") return false;
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase().trim();
    return (
      inv.userName?.toLowerCase().includes(term) ||
      inv.userEmail?.toLowerCase().includes(term) ||
      inv.userPhone?.includes(term) ||
      inv.status?.toLowerCase().includes(term) ||
      inv.description?.toLowerCase().includes(term) ||
      String(inv.amount).includes(term)
    );
  });

  if (!isAdminUnlocked) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800" style={{ marginTop: 0 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 flex flex-col items-center text-center space-y-6 shadow-sm"
        >
          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00]">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_maybe</span>
          </div>

          <div>
            <h2 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">Admin Gatekeeper</h2>
            <p className="font-hanken text-xs text-gray-500 mt-1.5 font-semibold leading-relaxed">
              Enter your administrative email and access PIN to verify authorization for Investment & Savings Plans.
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
        "flex justify-between items-center px-6 md:px-8 py-5 border-b transition-colors duration-300",
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
              Savings Plans & Investment Manager
            </h1>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">
              Configure Savings Schemes, Logos, Unlock Durations & Audit Placements
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
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
      </div>

      <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-6xl w-full mx-auto space-y-6 pb-24 md:pb-8">

        {/* Top Tab Bar: Manage Savings Plans vs Audit Fixed Deposits */}
        <div className={cn("p-2 rounded-2xl border flex items-center justify-between gap-2", panelClass)}>
          <div className="grid grid-cols-2 gap-2 w-full max-w-md">
            <button
              type="button"
              onClick={() => setActiveTab("PLANS")}
              className={cn(
                "py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
                activeTab === "PLANS"
                  ? "bg-[#FC7A00] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">savings</span>
              <span>Choose Savings Plans ({plans.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("AUDIT")}
              className={cn(
                "py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-2",
                activeTab === "AUDIT"
                  ? "bg-[#FC7A00] text-white shadow-sm"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">query_stats</span>
              <span>Audit Placements ({investments.length})</span>
            </button>
          </div>

          {activeTab === "PLANS" && (
            <button
              type="button"
              onClick={() => handleOpenModal()}
              className="px-5 h-11 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Add Savings Plan</span>
            </button>
          )}
        </div>

        {/* TAB 1: SAVINGS PLANS MANAGER */}
        {activeTab === "PLANS" && (
          <div className="space-y-6">
            {isLoadingPlans ? (
              <div className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                <ButtonSpinner /> Loading savings plans...
              </div>
            ) : plans.length === 0 ? (
              <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
                <span className="material-symbols-outlined text-[48px] text-orange-500">savings</span>
                <p className="text-xs font-black uppercase text-gray-400">No Savings Plans Configured</p>
                <button
                  type="button"
                  onClick={() => handleOpenModal()}
                  className="px-6 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                >
                  Create First Savings Plan
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {plans.map((p) => (
                  <div key={p.id} className={cn("p-5 rounded-2xl border space-y-4 flex flex-col justify-between transition-all", panelClass)}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl border border-gray-200 bg-white p-1 flex items-center justify-center overflow-hidden shrink-0 relative shadow-2xs">
                            <img
                              src={p.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
                              alt={p.name}
                              className="w-full h-full object-contain p-0.5"
                            />
                          </div>
                          <div>
                            <h3 className="font-extrabold text-sm text-black dark:text-white leading-tight">{p.name}</h3>
                            <span className="text-[9px] font-mono text-gray-400 font-bold uppercase">{p.type} • {p.interestType}</span>
                          </div>
                        </div>

                        {p.badgeTag && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20 shrink-0">
                            {p.badgeTag}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{p.description}</p>

                      <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800 space-y-2 text-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Annual Interest (APR)</span>
                          <span className="font-mono font-black text-orange-500 text-sm">{p.apr}% p.a.</span>
                        </div>

                        <div className="flex justify-between items-center">
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Unlock Options</span>
                          <div className="flex gap-1 text-[9px] font-extrabold uppercase">
                            {p.allowMonths && <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-500">Months</span>}
                            {p.allowYears && <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500">Years</span>}
                            {p.allowCustom && <span className="px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-500">Custom</span>}
                          </div>
                        </div>

                        <div className="flex justify-between items-center border-t border-gray-200/40 pt-1.5">
                          <span className="text-gray-400 font-bold uppercase text-[10px]">Investment Limits</span>
                          <span className="font-mono font-bold text-black dark:text-white text-[10.5px]">
                            ₦{p.minInvestment?.toLocaleString()} - ₦{p.maxInvestment?.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200/40">
                      <button
                        type="button"
                        onClick={() => handleOpenModal(p)}
                        className="flex-1 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-black dark:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Edit
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePlan(p.id)}
                        className="px-3 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: AUDIT PLACEMENTS */}
        {activeTab === "AUDIT" && (
          <div className="space-y-6">
            {/* Metrics Overview grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className={cn("p-5 rounded-2xl border transition-colors duration-300 relative overflow-hidden", panelClass)}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Active Savings</p>
                  <span className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center font-black text-xs">
                    {activeDeposits.length}
                  </span>
                </div>
                <p className="font-mono text-xl sm:text-2xl font-black text-emerald-500 mt-2 leading-none">
                  ₦{totalActiveVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className={cn("p-5 rounded-2xl border transition-colors duration-300 relative overflow-hidden", panelClass)}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Settled / Credited</p>
                  <span className="w-8 h-8 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center font-black text-xs">
                    {settledDeposits.length}
                  </span>
                </div>
                <p className="font-mono text-xl sm:text-2xl font-black text-blue-500 mt-2 leading-none">
                  ₦{totalSettledVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className={cn("p-5 rounded-2xl border transition-colors duration-300 relative overflow-hidden", panelClass)}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Canceled Investments</p>
                  <span className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center font-black text-xs">
                    {cancelledDeposits.length}
                  </span>
                </div>
                <p className="font-mono text-xl sm:text-2xl font-black text-rose-500 mt-2 leading-none">
                  ₦{totalCancelledVolume.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                </p>
              </div>

              <div className={cn("p-5 rounded-2xl border transition-colors duration-300 relative overflow-hidden", panelClass)}>
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Audited Placements</p>
                  <span className="w-8 h-8 rounded-full bg-orange-500/10 text-[#FC7A00] flex items-center justify-center font-black text-xs">
                    {investments.length}
                  </span>
                </div>
                <p className="font-mono text-xl sm:text-2xl font-black text-gray-900 dark:text-white mt-2 leading-none">
                  {investments.length} <span className="text-xs text-gray-400 font-semibold uppercase">Records</span>
                </p>
              </div>
            </div>

            {/* Audit Table & Custom Filter Tab Selector */}
            <div className={cn("rounded-2xl p-5 border transition-colors duration-300 space-y-5", panelClass)}>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Modern Multi-Filter Pill Bar */}
                <div className="flex items-center bg-gray-100 dark:bg-gray-900/80 p-1.5 rounded-2xl border border-gray-200/80 dark:border-gray-800 gap-1.5 overflow-x-auto custom-scrollbar w-full lg:w-auto">
                  <button
                    type="button"
                    onClick={() => setFilterTab("ALL")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                      filterTab === "ALL"
                        ? "bg-white dark:bg-gray-800 text-[#FC7A00] shadow-sm border border-gray-200/60 dark:border-gray-700"
                        : "text-gray-500 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">apps</span>
                    <span>ALL</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", filterTab === "ALL" ? "bg-orange-500/15 text-[#FC7A00]" : "bg-gray-200 dark:bg-gray-800 text-gray-500")}>
                      {investments.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab("ACTIVE")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                      filterTab === "ACTIVE"
                        ? "bg-white dark:bg-gray-800 text-emerald-500 shadow-sm border border-gray-200/60 dark:border-gray-700"
                        : "text-gray-500 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">published_with_changes</span>
                    <span>ACTIVE</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", filterTab === "ACTIVE" ? "bg-emerald-500/15 text-emerald-500" : "bg-gray-200 dark:bg-gray-800 text-gray-500")}>
                      {activeDeposits.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab("SETTLED")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                      filterTab === "SETTLED"
                        ? "bg-white dark:bg-gray-800 text-blue-500 shadow-sm border border-gray-200/60 dark:border-gray-700"
                        : "text-gray-500 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>SETTLED</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", filterTab === "SETTLED" ? "bg-blue-500/15 text-blue-500" : "bg-gray-200 dark:bg-gray-800 text-gray-500")}>
                      {settledDeposits.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFilterTab("CANCELLED")}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 shrink-0 cursor-pointer",
                      filterTab === "CANCELLED"
                        ? "bg-white dark:bg-gray-800 text-rose-500 shadow-sm border border-gray-200/60 dark:border-gray-700"
                        : "text-gray-500 hover:text-black dark:hover:text-white"
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">cancel</span>
                    <span>CANCELED</span>
                    <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold font-mono", filterTab === "CANCELLED" ? "bg-rose-500/15 text-rose-500" : "bg-gray-200 dark:bg-gray-800 text-gray-500")}>
                      {cancelledDeposits.length}
                    </span>
                  </button>
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto">
                  <div className="relative flex-1 lg:w-64">
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search user, email, phone or amount..."
                      className={inputClass}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={isLoadingInvestments}
                    onClick={fetchInvestments}
                    className="px-4 py-2.5 bg-black dark:bg-gray-800 text-white hover:bg-gray-900 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap shrink-0 flex items-center gap-1.5"
                  >
                    {isLoadingInvestments ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[16px]">refresh</span>}
                    <span>Reload</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto pr-1">
                {isLoadingInvestments ? (
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
                        const isActive = inv.status === "ACTIVE";
                        const isSettled = inv.status === "SETTLED" || inv.status === "CLAIMED";
                        const isCancelled = inv.status === "CANCELLED" || inv.status === "CANCELED";

                        return (
                          <tr key={inv.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10 transition-colors">
                            <td className="py-3.5 pl-2">
                              <p className="font-extrabold text-sm text-black dark:text-white">{inv.userName || "System User"}</p>
                              <p className="text-[10px] text-gray-400 mt-0.5">{inv.userEmail}</p>
                              <p className="text-[9px] font-mono text-gray-500">{inv.userPhone}</p>
                            </td>
                            <td className="py-3.5 text-right font-mono font-bold text-sm text-black dark:text-white">
                              ₦{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </td>
                            <td className="py-3.5 text-center font-mono font-black text-[#FC7A00]">
                              {inv.interestRate}%
                            </td>
                            <td className={cn(
                              "py-3.5 text-right font-mono font-extrabold",
                              isCancelled ? "text-gray-400 line-through" : "text-emerald-500"
                            )}>
                              {isCancelled ? "₦0.00" : `+₦${estYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}`}
                            </td>
                            <td className="py-3.5 text-center">
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border inline-flex items-center gap-1",
                                isActive
                                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20 animate-pulse"
                                  : isSettled
                                  ? "bg-blue-500/10 text-blue-500 border-blue-500/20"
                                  : isCancelled
                                  ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                  : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                              )}>
                                <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                                <span>{inv.status}</span>
                              </span>
                            </td>
                            <td className="py-3.5 text-center">
                              <p className="text-[9px] font-semibold text-gray-400">Created: {new Date(inv.createdAt).toLocaleDateString()}</p>
                              <p className="text-[9px] font-extrabold text-[#FC7A00] mt-0.5">
                                {isCancelled ? "Canceled" : `Matures: ${new Date(inv.maturesAt).toLocaleDateString()}`}
                              </p>
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
        )}

      </div>

      {/* CREATE / EDIT SAVINGS PLAN MODAL */}
      <AnimatePresence>
        {isModalOpen && editingPlan && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn("w-full max-w-2xl rounded-3xl p-6 border my-8 space-y-5 max-h-[90vh] overflow-y-auto custom-scrollbar", panelClass)}
            >
              <div className="flex items-center justify-between border-b border-gray-200/40 pb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500 text-[24px]">savings</span>
                  <h3 className="font-extrabold text-base uppercase tracking-tight">
                    {editingPlan.id ? "Edit Savings Plan" : "Add New Savings Plan"}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-gray-500 hover:text-black dark:hover:text-white"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              </div>

              <form onSubmit={handleSavePlan} className="space-y-4">
                {/* Title & Badge */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Plan Name / Title *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Target Savings Plan"
                      value={editingPlan.name || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, name: e.target.value })}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Badge Tag (e.g. POPULAR, HIGH YIELD)</label>
                    <input
                      type="text"
                      placeholder="e.g. POPULAR"
                      value={editingPlan.badgeTag || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, badgeTag: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Subtitle / Description */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Description / Subtitle</label>
                  <input
                    type="text"
                    placeholder="Short summary of this plan..."
                    value={editingPlan.description || ""}
                    onChange={(e) => setEditingPlan({ ...editingPlan, description: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {/* Logo URL & Upload Button */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Plan Logo / Icon</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="https://i.ibb.co/..."
                      value={editingPlan.logoUrl || ""}
                      onChange={(e) => setEditingPlan({ ...editingPlan, logoUrl: e.target.value })}
                      className={inputClass}
                    />
                    <label className="px-4 py-2 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-orange-500/20 transition-all shrink-0 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px]">upload</span>
                      <span>{isUploadingLogo ? "Uploading..." : "Upload Logo"}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={isUploadingLogo}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                {/* APR, Type & Interest compounding */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Annual Interest APR (%) *</label>
                    <input
                      type="number"
                      step="0.1"
                      required
                      placeholder="12.5"
                      value={editingPlan.apr ?? 12.5}
                      onChange={(e) => setEditingPlan({ ...editingPlan, apr: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Plan Type</label>
                    <select
                      value={editingPlan.type || "SAVINGS"}
                      onChange={(e) => setEditingPlan({ ...editingPlan, type: e.target.value as any })}
                      className={inputClass}
                    >
                      <option value="SAVINGS">SAVINGS</option>
                      <option value="FIXED_DEPOSIT">FIXED DEPOSIT</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Interest Calculation</label>
                    <select
                      value={editingPlan.interestType || "SIMPLE"}
                      onChange={(e) => setEditingPlan({ ...editingPlan, interestType: e.target.value as any })}
                      className={inputClass}
                    >
                      <option value="SIMPLE">SIMPLE INTEREST</option>
                      <option value="COMPOUND">COMPOUND INTEREST</option>
                    </select>
                  </div>
                </div>

                {/* UNLOCK DURATION CONFIGURATION SECTION */}
                <div className="p-4 rounded-xl border border-orange-500/20 bg-orange-500/5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-orange-500 text-[18px]">lock_clock</span>
                    <h4 className="font-extrabold text-xs uppercase tracking-wider text-orange-500">
                      &quot;WHEN DO YOU WANT TO UNLOCK YOUR SAVINGS&quot; CONFIGURATION
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
                    {/* Month Options */}
                    <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPlan.allowMonths !== false}
                          onChange={(e) => setEditingPlan({ ...editingPlan, allowMonths: e.target.checked })}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <span className="text-xs font-black uppercase">Allow Month Selection</span>
                      </label>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400">Month Options (Comma Separated)</label>
                        <input
                          type="text"
                          placeholder="1, 3, 6, 9"
                          value={monthOptsStr}
                          onChange={(e) => setMonthOptsStr(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Year Options */}
                    <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPlan.allowYears !== false}
                          onChange={(e) => setEditingPlan({ ...editingPlan, allowYears: e.target.checked })}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <span className="text-xs font-black uppercase">Allow Year Selection</span>
                      </label>

                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400">Year Options (Comma Separated)</label>
                        <input
                          type="text"
                          placeholder="1, 2, 3"
                          value={yearOptsStr}
                          onChange={(e) => setYearOptsStr(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>

                    {/* Custom Selection */}
                    <div className="space-y-2 p-3 rounded-xl bg-white dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingPlan.allowCustom !== false}
                          onChange={(e) => setEditingPlan({ ...editingPlan, allowCustom: e.target.checked })}
                          className="w-4 h-4 text-orange-500 rounded"
                        />
                        <span className="text-xs font-black uppercase">Allow Custom Date</span>
                      </label>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Min Days</label>
                          <input
                            type="number"
                            placeholder="7"
                            value={editingPlan.minCustomDays ?? 7}
                            onChange={(e) => setEditingPlan({ ...editingPlan, minCustomDays: parseInt(e.target.value, 10) || 1 })}
                            className={inputClass}
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-400">Max Days</label>
                          <input
                            type="number"
                            placeholder="1095"
                            value={editingPlan.maxCustomDays ?? 1095}
                            onChange={(e) => setEditingPlan({ ...editingPlan, maxCustomDays: parseInt(e.target.value, 10) || 30 })}
                            className={inputClass}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* AMOUNT INVESTMENT REQUIREMENTS */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2 p-3 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200/60 dark:border-gray-800">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingPlan.isAmountRequired !== false}
                        onChange={(e) => setEditingPlan({ ...editingPlan, isAmountRequired: e.target.checked })}
                        className="w-4 h-4 text-orange-500 rounded"
                      />
                      <span className="text-xs font-black uppercase">Amount Required</span>
                    </label>
                    <p className="text-[9px] text-gray-400">If unchecked, entering amount is optional on initialization.</p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Min Investment Amount (₦)</label>
                    <input
                      type="number"
                      placeholder="1000"
                      value={editingPlan.minInvestment ?? 1000}
                      onChange={(e) => setEditingPlan({ ...editingPlan, minInvestment: parseFloat(e.target.value) || 0 })}
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400">Max Investment Amount (₦)</label>
                    <input
                      type="number"
                      placeholder="10000000"
                      value={editingPlan.maxInvestment ?? 10000000}
                      onChange={(e) => setEditingPlan({ ...editingPlan, maxInvestment: parseFloat(e.target.value) || 10000 })}
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-200/40">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editingPlan.status === "ACTIVE"}
                      onChange={(e) => setEditingPlan({ ...editingPlan, status: e.target.checked ? "ACTIVE" : "INACTIVE" })}
                      className="w-4 h-4 text-orange-500 rounded"
                    />
                    <span className="text-xs font-black uppercase">Plan Active & Visible to Users</span>
                  </label>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="px-5 h-10 bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSavingPlan}
                      className="px-6 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"
                    >
                      {isSavingPlan ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                      <span>Save Plan</span>
                    </button>
                  </div>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </main>
  );
}

export default function AdminInvestmentsPage() {
  return (
    <CpanelRouteGuard requiredPermission="investments.manage">
      <AdminFixedDepositsPageContent />
    </CpanelRouteGuard>
  );
}
