"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminTxLog {
  id: string;
  userName: string;
  type: "DEPOSIT" | "TRANSFER" | "BILL_PAYMENT";
  amount: number;
  status: "SUCCESS" | "PENDING" | "FAILED";
  reference: string;
  date: string;
  time: string;
}

const INITIAL_ADMIN_LOGS: AdminTxLog[] = [
  {
    id: "tx-adm-1",
    userName: "STEVE COLLINS",
    type: "TRANSFER",
    amount: 120000.00,
    status: "SUCCESS",
    reference: "ETF-1039845-812",
    date: "Jul 11, 2024",
    time: "06:15 PM"
  },
  {
    id: "tx-adm-2",
    userName: "JULES VERNE",
    type: "DEPOSIT",
    amount: 500000.00,
    status: "SUCCESS",
    reference: "ETF-8924021-992",
    date: "Jul 12, 2024",
    time: "10:42 AM"
  },
  {
    id: "tx-adm-3",
    userName: "AMINA BELLO",
    type: "BILL_PAYMENT",
    amount: 15000.00,
    status: "PENDING",
    reference: "ETF-9908123-667",
    date: "Today",
    time: "11:58 PM"
  },
  {
    id: "tx-adm-4",
    userName: "CHIDI OKEKE",
    type: "TRANSFER",
    amount: 45000.00,
    status: "FAILED",
    reference: "ETF-1123984-500",
    date: "Jul 05, 2024",
    time: "08:12 AM"
  },
  {
    id: "tx-adm-5",
    userName: "YUSUF HARUNA",
    type: "DEPOSIT",
    amount: 250000.00,
    status: "SUCCESS",
    reference: "ETF-3904812-709",
    date: "Jul 09, 2024",
    time: "02:30 PM"
  }
];

export default function AdminPage() {
  const { userData, user } = useAuth();
  const { config, updateConfig } = useAppConfig();

  // Admin lock validation
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [activeTab, setActiveTab] = useState<"dashboard" | "settings" | "transactions">("dashboard");

  // Sidebar minimize state
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  // Editable settings states
  const [logoInput, setLogoInput] = useState(config.logoUrl);
  const [phone1Input, setPhone1Input] = useState(config.supportPhone1);
  const [phone2Input, setPhone2Input] = useState(config.supportPhone2);
  const [emailInput, setEmailInput] = useState(config.supportEmail);

  // Editable metrics states
  const [usersCountInput, setUsersCountInput] = useState(config.totalUsers);
  const [ngnBalanceInput, setNgnBalanceInput] = useState(config.globalNgnBalance);
  const [usdBalanceInput, setUsdBalanceInput] = useState(config.globalUsdBalance);

  // Transaction Log states
  const [logs, setLogs] = useState<AdminTxLog[]>([]);
  const [searchLogTerm, setSearchLogTerm] = useState("");

  // Load initial states
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedLogs = localStorage.getItem("admin_transaction_logs");
      if (savedLogs) {
        try {
          setLogs(JSON.parse(savedLogs));
        } catch {
          setLogs(INITIAL_ADMIN_LOGS);
        }
      } else {
        setLogs(INITIAL_ADMIN_LOGS);
        localStorage.setItem("admin_transaction_logs", JSON.stringify(INITIAL_ADMIN_LOGS));
      }

      const authorized = sessionStorage.getItem("admin_session_unlocked") === "true";
      if (authorized) {
        setIsAdminUnlocked(true);
      }
    }
  }, []);

  // Update inputs when config context loads or resets
  useEffect(() => {
    setLogoInput(config.logoUrl);
    setPhone1Input(config.supportPhone1);
    setPhone2Input(config.supportPhone2);
    setEmailInput(config.supportEmail);
    setUsersCountInput(config.totalUsers);
    setNgnBalanceInput(config.globalNgnBalance);
    setUsdBalanceInput(config.globalUsdBalance);
  }, [config]);

  const handleAdminVerify = (e: React.FormEvent) => {
    e.preventDefault();
    const isMockUser = user?.email === "jules@example.com" || userData?.name === "JULES VERNE";
    if (adminPin === "9900" || (isMockUser && adminPin === "1234") || adminPin === "8888") {
      setIsAdminUnlocked(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("admin_session_unlocked", "true");
      }
      toast.success("Admin Authorization Granted!");
    } else {
      toast.error("Invalid Admin Passcode PIN!");
    }
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      logoUrl: logoInput,
      supportPhone1: phone1Input,
      supportPhone2: phone2Input,
      supportEmail: emailInput,
    });
    toast.success("Branding and Support settings applied!");
  };

  const handleSaveMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      totalUsers: Number(usersCountInput),
      globalNgnBalance: Number(ngnBalanceInput),
      globalUsdBalance: Number(usdBalanceInput),
    });
    toast.success("Core metrics modified successfully!");
  };

  // Log moderation utilities
  const handleUpdateLogStatus = (id: string, newStatus: "SUCCESS" | "FAILED" | "PENDING") => {
    const updated = logs.map(l => l.id === id ? { ...l, status: newStatus } : l);
    setLogs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_transaction_logs", JSON.stringify(updated));
    }
    toast.success(`Transaction status marked as ${newStatus}!`);
  };

  const handleAddSimulatedTx = () => {
    const newTx: AdminTxLog = {
      id: `tx-adm-${Date.now()}`,
      userName: "AUTOMATED USER " + Math.floor(100 + Math.random() * 900),
      type: Math.random() > 0.5 ? "DEPOSIT" : "TRANSFER",
      amount: Math.floor(5000 + Math.random() * 95000),
      status: "PENDING",
      reference: `ETF-SIM-${Math.floor(1000000 + Math.random() * 9000000)}`,
      date: "Today",
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    };
    const updated = [newTx, ...logs];
    setLogs(updated);
    if (typeof window !== "undefined") {
      localStorage.setItem("admin_transaction_logs", JSON.stringify(updated));
    }
    toast.success("Simulated transaction log generated!");
  };

  const filteredLogs = logs.filter(l =>
    l.userName.toLowerCase().includes(searchLogTerm.toLowerCase()) ||
    l.reference.toLowerCase().includes(searchLogTerm.toLowerCase()) ||
    l.type.toLowerCase().includes(searchLogTerm.toLowerCase())
  );

  // Clean pure Light Mode lockscreen (Not dark mode)
  if (!isAdminUnlocked) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 shadow-xl flex flex-col items-center text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00] shadow-inner">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_maybe</span>
          </div>

          <div>
            <h2 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">Admin Gatekeeper</h2>
            <p className="font-hanken text-xs text-gray-500 mt-1.5 font-semibold leading-relaxed">
              Welcome to the E-Tech Enterprise Control Panel. Enter your administrative credential PIN below to access global configurations.
            </p>
          </div>

          <form onSubmit={handleAdminVerify} className="w-full space-y-4">
            <div className="space-y-2 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin PIN Code</label>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter passcode (e.g. 9900)"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-mono font-bold text-xl text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer shadow-md"
            >
              Verify Authority
            </button>
          </form>

          <Link href="/" className="font-hanken text-xs text-gray-400 hover:text-gray-700 transition-colors underline font-medium">
            Return to Fleet Homepage
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 text-gray-800 flex flex-col md:flex-row font-hanken">
      {/* Side Navigation with collapsing state for desktop, collapsing dynamically with motion */}
      <motion.aside
        animate={{ width: isSidebarMinimized ? 80 : 256 }}
        className="w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex flex-col justify-between flex-shrink-0 relative overflow-hidden transition-all duration-300"
      >
        <div className="flex flex-col h-full">
          {/* Brand Row */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between min-h-[73px]">
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded bg-gray-100 p-1 flex-shrink-0 flex items-center justify-center">
                <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
              </div>
              {!isSidebarMinimized && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col"
                >
                  <h1 className="font-hanken font-black text-sm tracking-tight text-gray-900 leading-none">E-TECH</h1>
                  <p className="text-[8px] font-black tracking-widest text-[#FC7A00] uppercase mt-0.5">Control Panel</p>
                </motion.div>
              )}
            </div>

            {/* Minimize Sidebar toggle button for Desktop */}
            <button
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              className="hidden md:flex w-7 h-7 rounded-lg border border-gray-150 hover:bg-gray-50 items-center justify-center text-gray-500 cursor-pointer active:scale-90 transition-all ml-1.5"
              title={isSidebarMinimized ? "Expand Menu" : "Collapse Menu"}
            >
              <span className="material-symbols-outlined text-[16px] font-bold">
                {isSidebarMinimized ? "chevron_right" : "chevron_left"}
              </span>
            </button>

            {/* Quick home link for Mobile */}
            <Link
              href="/"
              className="md:hidden w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 border border-gray-100 active:scale-95"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </Link>
          </div>

          {/* Collapsible Nav Links */}
          <nav className="p-4 space-y-1.5 flex flex-row md:flex-col gap-1.5 overflow-x-auto no-scrollbar md:overflow-visible">
            <button
              onClick={() => setActiveTab("dashboard")}
              className={cn(
                "flex-grow md:flex-grow-0 flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                activeTab === "dashboard"
                  ? "bg-orange-50 text-[#FC7A00] border border-orange-100"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                isSidebarMinimized ? "justify-center" : "justify-center md:justify-start"
              )}
              title="Metrics & Balances"
            >
              <span className="material-symbols-outlined text-[18px]">cell_tower</span>
              {!isSidebarMinimized && <span>Metrics</span>}
            </button>

            <button
              onClick={() => setActiveTab("settings")}
              className={cn(
                "flex-grow md:flex-grow-0 flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                activeTab === "settings"
                  ? "bg-orange-50 text-[#FC7A00] border border-orange-100"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                isSidebarMinimized ? "justify-center" : "justify-center md:justify-start"
              )}
              title="Branding & Support"
            >
              <span className="material-symbols-outlined text-[18px]">diamond</span>
              {!isSidebarMinimized && <span>Branding</span>}
            </button>

            <button
              onClick={() => setActiveTab("transactions")}
              className={cn(
                "flex-grow md:flex-grow-0 flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap",
                activeTab === "transactions"
                  ? "bg-orange-50 text-[#FC7A00] border border-orange-100"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800",
                isSidebarMinimized ? "justify-center" : "justify-center md:justify-start"
              )}
              title="Global Ledger"
            >
              <span className="material-symbols-outlined text-[18px]">history</span>
              {!isSidebarMinimized && <span>Ledger</span>}
            </button>
          </nav>
        </div>

        {/* Console Lock Button */}
        <div className="p-4 border-t border-gray-100 hidden md:block">
          <button
            onClick={() => {
              setIsAdminUnlocked(false);
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("admin_session_unlocked");
              }
              toast.info("Console session locked.");
            }}
            className={cn(
              "w-full py-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-gray-500 text-center flex items-center justify-center gap-1.5",
              isSidebarMinimized && "p-1"
            )}
            title="Lock Console"
          >
            <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
            {!isSidebarMinimized && <span>Lock Console</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Workspace */}
      <section className="flex-1 flex flex-col min-w-0">
        {/* Top Header on Desktop */}
        <header className="hidden md:flex justify-between items-center px-8 py-5 bg-white border-b border-gray-200">
          <div>
            <h2 className="font-hanken font-extrabold text-lg text-gray-800">
              {activeTab === "dashboard" && "Platform Operations & Metrics"}
              {activeTab === "settings" && "Dynamic Visual Settings Manager"}
              {activeTab === "transactions" && "Global Financial Audit Logs"}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider">Enterprise System Suite</p>
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 border border-gray-200 hover:border-[#FC7A00] rounded-xl text-xs font-bold uppercase tracking-wider text-gray-600 hover:text-[#FC7A00] transition-colors flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Fleet Homepage
            </Link>
          </div>
        </header>

        {/* Dashboard workspace page view scrollable container */}
        <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            {/* Tab 1: Dashboard metrics */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Premium Gradient Cards with Beautiful Highlight Borders */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Total Users Card */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-white via-orange-50/10 to-orange-50/40 rounded-2xl p-6 border-2 border-orange-100 shadow-sm hover:shadow-md transition-all">
                    {/* Corner shine highlight */}
                    <div className="absolute top-0 right-0 w-24 h-24 bg-[#FC7A00]/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />

                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Platform Registered Users</p>
                        <p className="font-mono text-3xl font-black text-gray-900 mt-2">{config.totalUsers.toLocaleString()}</p>
                        <p className="text-[10px] text-[#FC7A00] font-bold uppercase tracking-wider mt-1.5">Live Counter</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-orange-100 to-orange-200 border border-orange-300 flex items-center justify-center text-[#FC7A00] shadow-sm">
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: '"FILL" 1' }}>face</span>
                      </div>
                    </div>
                  </div>

                  {/* NGN holdings Card */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-white via-emerald-50/10 to-emerald-50/40 rounded-2xl p-6 border-2 border-emerald-150 shadow-sm hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />

                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Global Pool NGN holdings</p>
                        <p className="font-mono text-3xl font-black text-emerald-600 mt-2">₦{config.globalNgnBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-1.5">Live Liquidity</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-100 to-emerald-200 border border-emerald-300 flex items-center justify-center text-emerald-600 shadow-sm">
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: '"FILL" 1' }}>payments</span>
                      </div>
                    </div>
                  </div>

                  {/* USD holdings Card */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-white via-cyan-50/10 to-cyan-50/40 rounded-2xl p-6 border-2 border-cyan-150 shadow-sm hover:shadow-md transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />

                    <div className="flex justify-between items-center relative z-10">
                      <div>
                        <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Global Pool USD holdings</p>
                        <p className="font-mono text-3xl font-black text-cyan-600 mt-2">${config.globalUsdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                        <p className="text-[10px] text-cyan-600 font-bold uppercase tracking-wider mt-1.5">Live Reserves</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-100 to-cyan-200 border border-cyan-300 flex items-center justify-center text-cyan-600 shadow-sm">
                        <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: '"FILL" 1' }}>credit_card</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Simulated metric values form card */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm relative overflow-hidden bg-gradient-to-br from-white via-gray-50/30 to-gray-50/50">
                  <h3 className="font-hanken font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-3 mb-4 uppercase tracking-wide">
                    Simulate System Balances
                  </h3>

                  <form onSubmit={handleSaveMetrics} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">Total User Metrics</label>
                      <input
                        type="number"
                        value={usersCountInput}
                        onChange={(e) => setUsersCountInput(Number(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">NGN holdings (₦)</label>
                      <input
                        type="number"
                        value={ngnBalanceInput}
                        onChange={(e) => setNgnBalanceInput(Number(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">USD holdings ($)</label>
                      <input
                        type="number"
                        value={usdBalanceInput}
                        onChange={(e) => setUsdBalanceInput(Number(e.target.value))}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                      />
                    </div>

                    <div className="md:col-span-3 pt-3">
                      <button
                        type="submit"
                        className="px-6 py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer shadow-md active:scale-98"
                      >
                        Override System Metrics
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            )}

            {/* Tab 2: Settings Branding / support */}
            {activeTab === "settings" && (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                {/* Left Forms */}
                <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm md:col-span-2 bg-gradient-to-br from-white via-gray-50/10 to-gray-50/30">
                  <h3 className="font-hanken font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-3 mb-4 uppercase tracking-wide">
                    Live Brand Settings
                  </h3>

                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">Core Brand Logo URL</label>
                      <input
                        type="url"
                        value={logoInput}
                        onChange={(e) => setLogoInput(e.target.value)}
                        placeholder="https://..."
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                      />
                      <p className="text-[9px] text-gray-400 font-semibold">Must be a valid remote PNG, JPG, or SVG image file URL.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Toll-Free Support Line</label>
                        <input
                          type="text"
                          value={phone1Input}
                          onChange={(e) => setPhone1Input(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">VIP Chat Hotline</label>
                        <input
                          type="text"
                          value={phone2Input}
                          onChange={(e) => setPhone2Input(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">System Support Email</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-gray-800 outline-none focus:border-[#FC7A00] transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-6 py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-110 transition-all cursor-pointer shadow-md active:scale-98"
                    >
                      Save Branding Configurations
                    </button>
                  </form>
                </div>

                {/* Right Preview Panel with nice border and light gradient background */}
                <div className="bg-gradient-to-br from-white via-orange-50/10 to-orange-50/30 border-2 border-orange-100 rounded-2xl p-6 shadow-sm flex flex-col justify-between relative overflow-hidden">
                  <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-orange-100/10 rounded-full blur-xl" />

                  <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Live Platform Widget Preview</h4>

                    <div className="border border-orange-100 p-4 rounded-xl space-y-3 bg-white/80 backdrop-blur-xs">
                      <div className="flex justify-between items-center">
                        <div className="w-10 h-10 rounded bg-white flex items-center justify-center p-1.5 shadow-xs border border-gray-100">
                          <img src={logoInput || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="Brand Logo Preview" className="object-contain" />
                        </div>
                        <span className="text-[10px] font-mono font-black text-[#FC7A00] bg-orange-50 px-2 py-0.5 rounded border border-orange-100">LIVE</span>
                      </div>

                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-black tracking-wide leading-none">Support contact details</p>
                        <p className="text-xs font-black text-gray-900 mt-1">{emailInput}</p>
                        <p className="text-[11px] font-mono text-gray-500 mt-1">{phone1Input}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-100 mt-4 relative z-10">
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed">
                      All alterations committed inside this settings matrix propagates instantly to the global wallet UI client, including the top Header and Support Hotline components.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Ledger audits */}
            {activeTab === "transactions" && (
              <motion.div
                key="ledger-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-gray-200 bg-gradient-to-r from-white to-gray-50/50">
                  <div className="relative flex-1 max-w-md">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      value={searchLogTerm}
                      onChange={(e) => setSearchLogTerm(e.target.value)}
                      placeholder="Search user, status, reference..."
                      className="w-full bg-white border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs text-gray-800 outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSimulatedTx}
                    className="px-4 py-2.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md whitespace-nowrap"
                  >
                    <span className="material-symbols-outlined text-[14px]">add_card</span>
                    Inject Simulated Log
                  </button>
                </div>

                {/* Clean responsive table audit design */}
                <div className="bg-white border-2 border-gray-150 rounded-2xl overflow-hidden shadow-sm">
                  <div className="overflow-x-auto animate-fadeIn">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                          <th className="px-6 py-4">User</th>
                          <th className="px-6 py-4">Type</th>
                          <th className="px-6 py-4">Amount</th>
                          <th className="px-6 py-4">Status</th>
                          <th className="px-6 py-4">Reference ID</th>
                          <th className="px-6 py-4 text-right">Moderation Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 text-xs">
                        {filteredLogs.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="px-6 py-8 text-center text-gray-400 uppercase tracking-widest font-bold">
                              No ledger entries found
                            </td>
                          </tr>
                        ) : (
                          filteredLogs.map((log) => {
                            const isCredit = log.type === "DEPOSIT";
                            return (
                              <tr key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                <td className="px-6 py-4">
                                  <p className="font-extrabold text-gray-900 leading-tight">{log.userName}</p>
                                  <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">{log.date} @ {log.time}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                    isCredit ? "bg-emerald-50 text-emerald-600 border border-emerald-100" : "bg-orange-50 text-[#FC7A00] border border-orange-100"
                                  )}>
                                    {log.type}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono font-bold text-gray-950">
                                  {isCredit ? "+" : "-"}₦{log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                                    log.status === "SUCCESS" && "bg-emerald-50 text-emerald-600",
                                    log.status === "PENDING" && "bg-amber-50 text-amber-600",
                                    log.status === "FAILED" && "bg-rose-50 text-rose-600"
                                  )}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="px-6 py-4 font-mono text-gray-400 text-[10px] select-all">
                                  {log.reference}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  <div className="flex gap-1 justify-end">
                                    <button
                                      onClick={() => handleUpdateLogStatus(log.id, "SUCCESS")}
                                      className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 text-[9px] font-black uppercase rounded border border-emerald-100 transition-colors cursor-pointer"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      onClick={() => handleUpdateLogStatus(log.id, "FAILED")}
                                      className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase rounded border border-rose-100 transition-colors cursor-pointer"
                                    >
                                      Fail
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Mobile Lock Action Drawer */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-40">
        <button
          onClick={() => {
            setIsAdminUnlocked(false);
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("admin_session_unlocked");
            }
            toast.info("Console session locked.");
          }}
          className="w-full py-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-gray-500 text-center"
        >
          Lock Admin Console Session
        </button>
      </footer>
    </main>
  );
}
