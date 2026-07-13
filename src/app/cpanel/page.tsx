"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Interface for simulated user transactions (the transaction log viewer)
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
    // Check if there are local saved transaction logs or initialize
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

      // Check if admin is currently authorized in this session
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
    // Default admin entry is '9900' or being the default mock/admin user 'jules@example.com' or 'CAPTAIN'
    const isMockUser = user?.email === "jules@example.com" || userData?.name === "JULES VERNE";
    if (adminPin === "9900" || (isMockUser && adminPin === "1234") || adminPin === "8888") {
      setIsAdminUnlocked(true);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("admin_session_unlocked", "true");
      }
      toast.success("Admin Authorization Granted!");
    } else {
      toast.error("Invalid Admin Credential PIN Code!");
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
    toast.success("Branding and Support settings saved successfully!");
  };

  const handleSaveMetrics = (e: React.FormEvent) => {
    e.preventDefault();
    updateConfig({
      totalUsers: Number(usersCountInput),
      globalNgnBalance: Number(ngnBalanceInput),
      globalUsdBalance: Number(usdBalanceInput),
    });
    toast.success("Core dashboard metrics updated successfully!");
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
    toast.success("Simulated inbound transaction log generated!");
  };

  // Filter transaction logs
  const filteredLogs = logs.filter(l =>
    l.userName.toLowerCase().includes(searchLogTerm.toLowerCase()) ||
    l.reference.toLowerCase().includes(searchLogTerm.toLowerCase()) ||
    l.type.toLowerCase().includes(searchLogTerm.toLowerCase())
  );

  // Lockscreen form
  if (!isAdminUnlocked) {
    return (
      <main className="min-h-screen bg-[#080d1a] flex items-center justify-center p-4 text-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-sm glass-card rounded-[28px] p-6 border border-white/10 flex flex-col items-center text-center space-y-6"
          style={{ background: "rgba(12, 19, 36, 0.85)" }}
        >
          <div className="w-14 h-14 rounded-2xl bg-[#FC7A00]/20 flex items-center justify-center text-[#FC7A00]">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_maybe</span>
          </div>

          <div>
            <h2 className="font-hanken font-extrabold text-xl tracking-tight text-white leading-tight">Admin Portal Gate</h2>
            <p className="font-hanken text-xs text-gray-400 mt-1 font-semibold leading-relaxed">
              Secure Control Panel access. Enter Admin Code or use default simulated credential.
            </p>
          </div>

          <form onSubmit={handleAdminVerify} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[10px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin Entry Code PIN</label>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter admin passcode (e.g. 9900)"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-center font-mono font-bold text-lg text-white placeholder-gray-600 outline-none focus:border-[#FC7A00] transition-all"
              />
            </div>

            <button
              type="submit"
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-110 active:scale-95 transition-all cursor-pointer text-white"
            >
              Verify Credentials
            </button>
          </form>

          <Link href="/" className="font-hanken text-xs text-gray-500 hover:text-white transition-colors underline">
            Return to Fleet Homepage
          </Link>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080d1a] text-white flex flex-col">
      {/* Top Banner Navigation Header */}
      <header className="sticky top-0 z-50 bg-[#0c1324]/90 backdrop-blur-md px-4 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="w-8 h-8 rounded-full border border-white/15 bg-white/5 flex items-center justify-center text-white active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-hanken font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#FC7A00] animate-pulse" />
              E-TECH ADMIN CPANEL
            </h1>
            <p className="font-hanken text-[9px] text-[#FC7A00] font-black uppercase tracking-widest mt-0.5">Control Center</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-1.5 bg-white/5 p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setActiveTab("dashboard")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              activeTab === "dashboard" ? "bg-[#FC7A00] text-white" : "text-gray-400 hover:text-white"
            )}
          >
            Metrics
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              activeTab === "settings" ? "bg-[#FC7A00] text-white" : "text-gray-400 hover:text-white"
            )}
          >
            Branding
          </button>
          <button
            onClick={() => setActiveTab("transactions")}
            className={cn(
              "px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all",
              activeTab === "transactions" ? "bg-[#FC7A00] text-white" : "text-gray-400 hover:text-white"
            )}
          >
            Ledger
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <div className="flex-1 p-4 max-w-md mx-auto w-full space-y-6 pb-24">
        <AnimatePresence mode="wait">
          {/* TAB 1: Metrics & Global Balances */}
          {activeTab === "dashboard" && (
            <motion.div
              key="metrics-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <h2 className="font-hanken font-black text-xs uppercase tracking-widest text-[#FC7A00]">
                Live Metrics Control
              </h2>

              {/* Status overview cards */}
              <div className="grid grid-cols-1 gap-3">
                <div className="glass-card rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-[#0c1324] to-[#070b14] flex justify-between items-center">
                  <div>
                    <p className="font-hanken text-[10px] text-gray-400 uppercase font-black tracking-wider">Total registered users</p>
                    <p className="font-mono text-2xl font-black text-white mt-1">{config.totalUsers.toLocaleString()}</p>
                  </div>
                  <span className="material-symbols-outlined text-[32px] text-[#FC7A00]">face</span>
                </div>

                <div className="glass-card rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-[#0c1324] to-[#070b14] flex justify-between items-center">
                  <div>
                    <p className="font-hanken text-[10px] text-gray-400 uppercase font-black tracking-wider">Cumulative ngn pool balance</p>
                    <p className="font-mono text-2xl font-black text-emerald-400 mt-1">₦{config.globalNgnBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <span className="material-symbols-outlined text-[32px] text-emerald-500">payments</span>
                </div>

                <div className="glass-card rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-[#0c1324] to-[#070b14] flex justify-between items-center">
                  <div>
                    <p className="font-hanken text-[10px] text-gray-400 uppercase font-black tracking-wider">Cumulative usd pool balance</p>
                    <p className="font-mono text-2xl font-black text-cyan-400 mt-1">${config.globalUsdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                  </div>
                  <span className="material-symbols-outlined text-[32px] text-cyan-500">credit_card</span>
                </div>
              </div>

              {/* Form to update metrics */}
              <form onSubmit={handleSaveMetrics} className="glass-card rounded-2xl p-5 border border-white/10 bg-white/5 space-y-4">
                <h3 className="font-hanken font-bold text-xs text-white border-b border-white/5 pb-2 uppercase tracking-wide">
                  Simulate Global Metrics
                </h3>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">Simulate Total User Count</label>
                    <input
                      type="number"
                      value={usersCountInput}
                      onChange={(e) => setUsersCountInput(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">Simulate Global NGN Holdings (₦)</label>
                    <input
                      type="number"
                      value={ngnBalanceInput}
                      onChange={(e) => setNgnBalanceInput(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">Simulate Global USD Holdings ($)</label>
                    <input
                      type="number"
                      value={usdBalanceInput}
                      onChange={(e) => setUsdBalanceInput(Number(e.target.value))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#FC7A00] rounded-xl text-[10px] font-black uppercase tracking-wider text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Save Metrics Override
                </button>
              </form>
            </motion.div>
          )}

          {/* TAB 2: Branding & Support Details Settings */}
          {activeTab === "settings" && (
            <motion.div
              key="settings-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              <h2 className="font-hanken font-black text-xs uppercase tracking-widest text-[#FC7A00]">
                App Branding Settings
              </h2>

              <form onSubmit={handleSaveSettings} className="glass-card rounded-2xl p-5 border border-white/10 bg-white/5 space-y-4">
                <div className="space-y-3">
                  {/* Logo URL Input */}
                  <div className="space-y-1.5">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">App Brand Logo URL</label>
                    <input
                      type="url"
                      value={logoInput}
                      onChange={(e) => setLogoInput(e.target.value)}
                      placeholder="https://..."
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                    <p className="font-hanken text-[8px] text-gray-500">Provide any remote png/jpg url. Must load correctly.</p>
                  </div>

                  {/* Priority Phone */}
                  <div className="space-y-1.5">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">Priority Toll-Free Phone</label>
                    <input
                      type="text"
                      value={phone1Input}
                      onChange={(e) => setPhone1Input(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  {/* VIP Phone */}
                  <div className="space-y-1.5">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">WhatsApp VIP Hotline</label>
                    <input
                      type="text"
                      value={phone2Input}
                      onChange={(e) => setPhone2Input(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 font-mono text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  {/* Email Support */}
                  <div className="space-y-1.5">
                    <label className="font-hanken text-[9px] text-gray-400 uppercase font-bold">Official Support Email</label>
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#FC7A00] rounded-xl text-[10px] font-black uppercase tracking-wider text-white hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Apply Branding Updates
                </button>
              </form>

              {/* Preview of Live Branding */}
              <div className="glass-card rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-[#0c1324] to-[#070b14] space-y-3">
                <p className="font-hanken text-[9px] text-gray-400 font-bold uppercase tracking-wider">Live Support Card Mockup</p>
                <div className="flex items-center gap-2.5 bg-white/5 p-3 rounded-xl border border-white/5">
                  <div className="relative w-8 h-8 rounded bg-white flex items-center justify-center p-1.5">
                    <img src={logoInput || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="Brand Logo preview" className="object-contain" />
                  </div>
                  <div>
                    <p className="font-hanken text-xs font-bold text-white">{emailInput}</p>
                    <p className="font-mono text-[10px] text-gray-400 mt-0.5">{phone1Input}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: Global Transaction Log Explorer */}
          {activeTab === "transactions" && (
            <motion.div
              key="transactions-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="font-hanken font-black text-xs uppercase tracking-widest text-[#FC7A00]">
                  Global Ledger Log
                </h2>
                <button
                  type="button"
                  onClick={handleAddSimulatedTx}
                  className="px-2.5 py-1 bg-white/10 border border-white/15 rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-white/15 flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">add_card</span>
                  Simulate Tx
                </button>
              </div>

              {/* Filter search bar */}
              <div className="relative w-full">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  value={searchLogTerm}
                  onChange={(e) => setSearchLogTerm(e.target.value)}
                  placeholder="Search user, status, reference..."
                  className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-xs text-white placeholder-gray-500 outline-none focus:border-[#FC7A00]"
                />
              </div>

              {/* Logs Rows list */}
              <div className="space-y-2.5 max-h-[360px] overflow-y-auto custom-scrollbar">
                {filteredLogs.length === 0 ? (
                  <p className="text-center py-8 font-hanken text-xs text-gray-500 uppercase tracking-widest">No transaction logs match</p>
                ) : (
                  filteredLogs.map((log) => {
                    const isCredit = log.type === "DEPOSIT";
                    return (
                      <div
                        key={log.id}
                        className="p-3.5 bg-white/5 border border-white/10 rounded-xl flex flex-col gap-2 relative overflow-hidden"
                      >
                        <div className="flex justify-between items-start gap-2">
                          <div>
                            <p className="font-hanken text-[11px] font-extrabold text-white leading-none">{log.userName}</p>
                            <p className="font-hanken text-[8px] text-gray-500 uppercase tracking-wide mt-1 font-bold">
                              {log.date} @ {log.time}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={cn("font-mono text-xs font-black", isCredit ? "text-emerald-400" : "text-white")}>
                              {isCredit ? "+" : "-"}₦{log.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                            <span className={cn(
                              "inline-block px-1.5 py-0.5 rounded text-[7.5px] font-black tracking-wider uppercase mt-1",
                              log.status === "SUCCESS" && "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20",
                              log.status === "PENDING" && "bg-amber-500/10 text-amber-400 border border-amber-500/20",
                              log.status === "FAILED" && "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            )}>
                              {log.status}
                            </span>
                          </div>
                        </div>

                        {/* Actions for log */}
                        <div className="flex justify-between items-center pt-2 border-t border-white/5">
                          <span className="font-mono text-[8.5px] text-gray-500">{log.reference}</span>
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleUpdateLogStatus(log.id, "SUCCESS")}
                              className="px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 hover:bg-emerald-500/20 text-[8px] font-black uppercase rounded"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleUpdateLogStatus(log.id, "FAILED")}
                              className="px-1.5 py-0.5 bg-rose-500/10 border border-rose-500/15 text-rose-400 hover:bg-rose-500/20 text-[8px] font-black uppercase rounded"
                            >
                              Fail
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Persistent admin action logout floating button */}
      <footer className="fixed bottom-0 left-0 right-0 max-w-md mx-auto p-4 z-40 bg-[#080d1a]/80 backdrop-blur-md">
        <button
          onClick={() => {
            setIsAdminUnlocked(false);
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("admin_session_unlocked");
            }
            toast.info("Admin Session Closed.");
          }}
          className="w-full py-3 border border-white/10 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest text-center text-gray-400 hover:text-white transition-all cursor-pointer"
        >
          Close CPanel Control Session
        </button>
      </footer>
    </main>
  );
}
