"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface GlobalDeduction {
  id: string;
  deductionId: string;
  name: string;
  description: string;
  amount: number;
  currency: string;
  target: string;
  status: "PROCESSING" | "COMPLETED" | "FAILED";
  eligibleUsersCount?: number;
  indebtedUsersCount?: number;
  totalAssessedAmount?: number;
  totalRecoveredAmount?: number;
  totalOutstandingAmount?: number;
  createdBy: string;
  createdAt: string;
}

interface UserDeductionRecord {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  amountAssessed: number;
  amountRecovered: number;
  amountOutstanding: number;
  walletBalanceBefore: number;
  walletBalanceAfter: number;
  outstandingDebtBefore: number;
  outstandingDebtAfter: number;
  status: string;
  createdAt: string;
}

interface DeductionPreview {
  eligibleUsersCount: number;
  sufficientFundsCount: number;
  indebtedCount: number;
  totalAssessedAmount: number;
  totalImmediateRecovery: number;
  totalNewOutstandingDebt: number;
}

export default function GlobalDeductionsPage() {
  const { isDark } = useCpanelTheme();

  const [deductions, setDeductions] = useState<GlobalDeduction[]>([]);
  const [summary, setSummary] = useState({
    totalDeductionsExecuted: 0,
    totalAssessedAmount: 0,
    totalRecoveredAmount: 0,
    totalOutstandingAmount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);

  // New Deduction Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalStep, setModalStep] = useState<"form" | "preview">("form");
  const [name, setName] = useState("Monthly Account Maintenance Fee");
  const [description, setDescription] = useState("Standard service maintenance fee for active wallet accounts");
  const [amount, setAmount] = useState<number | "">(500);

  const [previewData, setPreviewData] = useState<DeductionPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);

  // Detail Drawer State
  const [selectedDeduction, setSelectedDeduction] = useState<GlobalDeduction | null>(null);
  const [userRecords, setUserRecords] = useState<UserDeductionRecord[]>([]);
  const [isLoadingUserRecords, setIsLoadingUserRecords] = useState(false);

  const fetchDeductions = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/admin/deductions");
      const data = await res.json();
      if (res.ok && data.success) {
        setDeductions(data.deductions || []);
        if (data.summary) {
          setSummary(data.summary);
        }
      } else {
        toast.error(data.error || "Failed to load global deductions");
      }
    } catch {
      toast.error("Network error fetching global deductions history");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeductions();
  }, []);

  const handlePreview = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmt = Number(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      toast.error("Please enter a valid amount greater than 0");
      return;
    }

    setIsPreviewing(true);
    try {
      const res = await fetch("/api/admin/deductions/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmt }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPreviewData(data.preview);
        setModalStep("preview");
      } else {
        toast.error(data.error || "Failed to generate preview");
      }
    } catch {
      toast.error("Network error generating preview");
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleExecute = async () => {
    const parsedAmt = Number(amount);
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      toast.error("Please enter a valid deduction amount");
      return;
    }

    setIsExecuting(true);
    try {
      const res = await fetch("/api/admin/deductions/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim(),
          amount: parsedAmt,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Global deduction executed successfully!");
        setShowModal(false);
        setModalStep("form");
        setPreviewData(null);
        fetchDeductions();
      } else {
        toast.error(data.error || "Failed to execute global deduction");
      }
    } catch {
      toast.error("Network error executing global deduction");
    } finally {
      setIsExecuting(false);
    }
  };

  const handleViewUserRecords = async (ded: GlobalDeduction) => {
    setSelectedDeduction(ded);
    setIsLoadingUserRecords(true);
    try {
      const res = await fetch(`/api/admin/deductions?deductionId=${ded.deductionId}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setUserRecords(data.userRecords || []);
      } else {
        toast.error(data.error || "Failed to fetch user audit logs");
      }
    } catch {
      toast.error("Network error fetching user audit logs");
    } finally {
      setIsLoadingUserRecords(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FC7A00] flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">payments</span>
            </div>
            <div>
              <h1 className={cn("text-xl sm:text-2xl font-black font-hanken tracking-tight", isDark ? "text-white" : "text-gray-900")}>
                Global Wallet Deductions
              </h1>
              <p className={cn("text-xs font-semibold mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Assess maintenance fees or service charges across all active user accounts with automatic debt recovery.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            setModalStep("form");
            setPreviewData(null);
            setShowModal(true);
          }}
          className="px-5 py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer self-start sm:self-auto"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Assess Global Deduction
        </button>
      </div>

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className={cn("p-4 rounded-3xl border transition-all", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-xs")}>
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Executed Deductions</span>
            <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">verified</span>
          </div>
          <p className={cn("text-xl sm:text-2xl font-black font-hanken tracking-tight", isDark ? "text-white" : "text-gray-900")}>
            {summary.totalDeductionsExecuted}
          </p>
          <span className="text-[10px] text-gray-400 font-semibold mt-1 block">Master Batches Completed</span>
        </div>

        <div className={cn("p-4 rounded-3xl border transition-all", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-xs")}>
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Total Assessed</span>
            <span className="material-symbols-outlined text-[20px] text-blue-500">account_balance_wallet</span>
          </div>
          <p className={cn("text-xl sm:text-2xl font-black font-hanken tracking-tight", isDark ? "text-white" : "text-gray-900")}>
            ₦{summary.totalAssessedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-gray-400 font-semibold mt-1 block">Total Fee Value Assessed</span>
        </div>

        <div className={cn("p-4 rounded-3xl border transition-all", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-xs")}>
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Recovered Immediately</span>
            <span className="material-symbols-outlined text-[20px] text-emerald-500">price_check</span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-hanken tracking-tight text-emerald-500">
            ₦{summary.totalRecoveredAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-emerald-600/70 font-semibold mt-1 block">Debited directly from balances</span>
        </div>

        <div className={cn("p-4 rounded-3xl border transition-all", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-xs")}>
          <div className="flex items-center justify-between text-gray-400 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider">Outstanding Debt</span>
            <span className="material-symbols-outlined text-[20px] text-amber-500">pending_actions</span>
          </div>
          <p className="text-xl sm:text-2xl font-black font-hanken tracking-tight text-amber-500">
            ₦{summary.totalOutstandingAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
          </p>
          <span className="text-[10px] text-amber-600/70 font-semibold mt-1 block">Pending automatic recovery</span>
        </div>
      </div>

      {/* History Audit Table */}
      <div className={cn("rounded-3xl border overflow-hidden", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200 shadow-sm")}>
        <div className={cn("p-4 sm:p-5 border-b flex items-center justify-between", isDark ? "border-gray-800" : "border-gray-100")}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FC7A00]">history</span>
            <h2 className={cn("font-black text-sm uppercase tracking-wider", isDark ? "text-white" : "text-gray-900")}>
              Global Deduction Master History
            </h2>
          </div>
          <button
            onClick={fetchDeductions}
            className="text-xs font-bold text-[#FC7A00] hover:underline flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[16px]">refresh</span> Refresh
          </button>
        </div>

        {isLoading ? (
          <div className="p-12 text-center text-gray-400 animate-pulse">
            <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
            <p className="text-xs font-bold uppercase tracking-wider">Loading Deduction Audit History...</p>
          </div>
        ) : deductions.length === 0 ? (
          <div className="p-12 text-center text-gray-400 space-y-2">
            <span className="material-symbols-outlined text-4xl text-gray-300">payments</span>
            <p className="text-sm font-bold text-gray-600 dark:text-gray-400">No Global Deductions Executed Yet</p>
            <p className="text-xs text-gray-400">Click &quot;Assess Global Deduction&quot; above to create and apply fee charges across users.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className={cn("border-b text-[10px] font-black uppercase tracking-wider text-gray-400", isDark ? "border-gray-800 bg-gray-950/50" : "border-gray-100 bg-gray-50")}>
                  <th className="py-3.5 px-4">Deduction Info</th>
                  <th className="py-3.5 px-4">Rate / User</th>
                  <th className="py-3.5 px-4">Processed Users</th>
                  <th className="py-3.5 px-4">Immediate Recovery</th>
                  <th className="py-3.5 px-4">Debt Created</th>
                  <th className="py-3.5 px-4">Status</th>
                  <th className="py-3.5 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-medium">
                {deductions.map((ded) => (
                  <tr key={ded.id} className={cn("hover:bg-gray-50/50 dark:hover:bg-gray-800/50 transition-colors", isDark ? "text-gray-200" : "text-gray-700")}>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-gray-900 dark:text-white">{ded.name}</div>
                      <div className="text-[11px] text-gray-400 truncate max-w-xs">{ded.description || ded.deductionId}</div>
                      <div className="text-[9px] text-gray-400 font-mono mt-0.5">{new Date(ded.createdAt).toLocaleString()}</div>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-gray-900 dark:text-white">
                      ₦{(ded.amount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-semibold">
                      {ded.eligibleUsersCount || 0} users
                    </td>
                    <td className="py-3.5 px-4 font-bold text-emerald-600">
                      ₦{(ded.totalRecoveredAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-amber-500">
                      ₦{(ded.totalOutstandingAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider",
                        ded.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400"
                      )}>
                        {ded.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleViewUserRecords(ded)}
                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                      >
                        User Audit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE & PREVIEW MODAL */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99998]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 max-w-lg w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[32px] p-6 shadow-2xl z-[99999] font-hanken overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-orange-500/10 text-[#FC7A00] flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px]">payments</span>
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                      {modalStep === "form" ? "Assess Global Wallet Deduction" : "Confirm Deduction Execution"}
                    </h3>
                    <p className="text-[11px] text-gray-400 font-semibold">
                      {modalStep === "form" ? "Step 1: Set Deduction Amount & Purpose" : "Step 2: Review Preview Impact across Users"}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setShowModal(false)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {modalStep === "form" ? (
                <form onSubmit={handlePreview} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#FC7A00]">
                      Deduction Title / Name
                    </label>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Monthly Maintenance Fee"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-xs text-gray-900 dark:text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#FC7A00]">
                      Description / Reason
                    </label>
                    <textarea
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="e.g. Service maintenance fee for active wallet accounts"
                      className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl px-4 py-3 text-xs text-gray-900 dark:text-white outline-none focus:border-[#FC7A00]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-black uppercase tracking-wider text-[#FC7A00]">
                      Deduction Amount per User (NGN)
                    </label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-black text-gray-400">₦</span>
                      <input
                        type="number"
                        required
                        min={1}
                        step="any"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value === "" ? "" : Number(e.target.value))}
                        placeholder="500"
                        className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl pl-8 pr-4 py-3 text-sm font-black text-gray-900 dark:text-white outline-none focus:border-[#FC7A00]"
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isPreviewing}
                      className="w-full py-4 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isPreviewing ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          Calculating User Impact Preview...
                        </>
                      ) : (
                        <>
                          Preview User Impact →
                        </>
                      )}
                    </button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4 pt-4">
                  {previewData && (
                    <div className="grid grid-cols-2 gap-3 text-center">
                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Eligible Users</span>
                        <span className="text-lg font-black text-gray-900 dark:text-white">{previewData.eligibleUsersCount}</span>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700">
                        <span className="text-[10px] text-gray-400 font-bold uppercase block">Max Assessment</span>
                        <span className="text-lg font-black text-blue-500">₦{previewData.totalAssessedAmount.toLocaleString()}</span>
                      </div>

                      <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 rounded-2xl border border-emerald-100 dark:border-emerald-900/30">
                        <span className="text-[10px] text-emerald-600 font-bold uppercase block">Sufficient Funds</span>
                        <span className="text-lg font-black text-emerald-600">{previewData.sufficientFundsCount} users</span>
                      </div>

                      <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/30">
                        <span className="text-[10px] text-amber-600 font-bold uppercase block">New Indebted Users</span>
                        <span className="text-lg font-black text-amber-600">{previewData.indebtedCount} users</span>
                      </div>
                    </div>
                  )}

                  <div className="p-3.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/40 rounded-2xl text-left space-y-1">
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-black text-xs uppercase">
                      <span className="material-symbols-outlined text-[16px]">warning</span>
                      Atomic Debit & Recovery Warning
                    </div>
                    <p className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                      Executing this deduction will debit <strong>₦{Number(amount).toLocaleString()}</strong> from all active users. Users with insufficient balance will enter an <strong>Outstanding Debt</strong> state and will be automatically debited upon their next wallet deposit.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalStep("form")}
                      className="py-3.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                    >
                      ← Back to Form
                    </button>

                    <button
                      type="button"
                      disabled={isExecuting}
                      onClick={handleExecute}
                      className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isExecuting ? (
                        <>
                          <span className="material-symbols-outlined text-sm animate-spin">progress_activity</span>
                          Executing Deduction...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-sm">check_circle</span>
                          Confirm & Execute
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* USER AUDIT DETAIL DRAWER */}
      <AnimatePresence>
        {selectedDeduction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedDeduction(null)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99998]"
            />

            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed inset-x-4 top-12 bottom-12 md:inset-y-12 md:left-1/2 md:-translate-x-1/2 max-w-3xl w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[32px] p-6 shadow-2xl z-[99999] font-hanken flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-gray-800 shrink-0">
                <div>
                  <h3 className="font-extrabold text-base text-gray-900 dark:text-white">
                    User Audit Log: {selectedDeduction.name}
                  </h3>
                  <p className="text-[11px] text-gray-400 font-semibold">
                    ID: {selectedDeduction.deductionId} | Rate: ₦{selectedDeduction.amount.toLocaleString()}
                  </p>
                </div>

                <button
                  onClick={() => setSelectedDeduction(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-black dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto pt-4 space-y-3 no-scrollbar">
                {isLoadingUserRecords ? (
                  <div className="p-12 text-center text-gray-400 animate-pulse">
                    <span className="material-symbols-outlined text-4xl animate-spin mb-2">progress_activity</span>
                    <p className="text-xs font-bold uppercase tracking-wider">Loading Per-User Audit Logs...</p>
                  </div>
                ) : userRecords.length === 0 ? (
                  <div className="p-8 text-center text-gray-400 text-xs">No per-user audit records found for this deduction.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b text-[10px] font-black uppercase tracking-wider text-gray-400 border-gray-100 dark:border-gray-800">
                          <th className="py-2.5 px-3">User</th>
                          <th className="py-2.5 px-3">Assessed</th>
                          <th className="py-2.5 px-3">Recovered</th>
                          <th className="py-2.5 px-3">Outstanding Debt</th>
                          <th className="py-2.5 px-3">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-xs font-medium">
                        {userRecords.map((ur) => (
                          <tr key={ur.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-gray-900 dark:text-white">{ur.userName}</div>
                              <div className="text-[10px] text-gray-400">{ur.userEmail || ur.userPhone}</div>
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-gray-800 dark:text-gray-200">
                              ₦{(ur.amountAssessed || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-emerald-600">
                              ₦{(ur.amountRecovered || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-amber-500">
                              ₦{(ur.amountOutstanding || 0).toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 font-mono font-bold text-gray-700 dark:text-gray-300">
                              ₦{(ur.walletBalanceAfter || 0).toLocaleString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
