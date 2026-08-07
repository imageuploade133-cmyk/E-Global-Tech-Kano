"use client";

import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export interface Transaction {
  id: string;
  reference: string;
  type: string;
  amount: number;
  currency?: "NGN" | "USD";
  description: string;
  recipientName?: string;
  bankName?: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  date: string;
  time: string;
  fee: number;
}

interface TransactionReceiptProps {
  transaction: Transaction | null;
  onClose: () => void;
}

export const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  onClose,
}) => {
  // Prevent background scrolling while the transaction receipt is displayed
  useEffect(() => {
    if (transaction) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [transaction]);

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied successfully!`);
    }
  };

  if (!transaction) return null;

  const isDeposit =
    transaction.type === "DEPOSIT" || transaction.type === "CASHOUT";
  const currencySymbol = transaction.currency === "USD" ? "$" : "₦";

  // Generate realistic bank session ID based on reference
  const generateSessionId = (ref: string) => {
    let hash = 0;
    for (let i = 0; i < ref.length; i++) {
      hash = ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash).toString().padEnd(18, "0");
    return `000003260807092${absHash.slice(0, 15)}`;
  };

  // Generate realistic masked account number based on reference
  const generateAccountNumber = (ref: string) => {
    let hash = 0;
    for (let i = 0; i < ref.length; i++) {
      hash = ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    const suffix = Math.abs(hash % 1000).toString().padStart(3, "8");
    return `103****${suffix}`;
  };

  const sessionId = generateSessionId(transaction.reference);
  const mockAccountNumber = generateAccountNumber(transaction.reference);

  // Extract clean bank details
  const bankDisplayName = transaction.bankName || (isDeposit ? "Providus Bank" : "Wema Bank");
  const entityName = transaction.recipientName || (isDeposit ? "DIRECT INBOUND DEPOSIT" : "E-TECH SECURE NODE");

  return (
    <div className="relative">
      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99998]"
      />

      {/* Swipe-to-dismiss Drawer with 92dvh scrolling containment */}
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
        drag="y"
        dragDirectionLock
        dragConstraints={{ top: 0, bottom: 450 }}
        dragElastic={{ top: 0, bottom: 0.2 }}
        onDragEnd={(event, info) => {
          if (info.offset.y > 100 || info.velocity.y > 500) {
            onClose();
          }
        }}
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-gray-50 rounded-t-[32px] z-[99999] h-[92dvh] flex flex-col overflow-hidden text-black select-none"
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-gray-300 rounded-full mt-4 mb-2 mx-auto cursor-grab active:cursor-grabbing shrink-0" />

        {/* Scrollable Receipt Body */}
        <div className="flex-1 overflow-y-auto px-5 pb-24 space-y-4 custom-scrollbar">

          {/* Main Top Header White Card */}
          <div className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm text-center relative mt-2 space-y-4">
            {/* Bank Circular Icon */}
            <div className="mx-auto w-12 h-12 rounded-full bg-gradient-to-tr from-[#FC7A00] to-[#FF9022] flex items-center justify-center text-white font-bold text-sm shadow-sm">
              {isDeposit ? "FCMB" : "ETG"}
            </div>

            {/* Inbound vs Outbound labels */}
            <div className="space-y-1.5 px-2">
              <h2 className="font-hanken font-bold text-[14px] text-gray-800 leading-snug">
                {isDeposit
                  ? `Transfer from ${entityName}`
                  : `Transfer to ${entityName}`
                }
              </h2>
              <h1 className="font-mono text-3xl font-black text-black">
                {currencySymbol}
                {transaction.amount.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </h1>
            </div>

            {/* Status Pill */}
            <div className="flex items-center justify-center gap-1.5 text-xs font-bold">
              {transaction.status === "SUCCESS" ? (
                <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                  <span>Successful</span>
                </div>
              ) : transaction.status === "PENDING" ? (
                <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm font-bold">schedule</span>
                  <span>Processing</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-600 bg-red-50 px-3 py-1 rounded-full">
                  <span className="material-symbols-outlined text-sm font-bold">cancel</span>
                  <span>Failed</span>
                </div>
              )}
            </div>

            {/* Transfer Timeline Progress Bar (Outbound Transfer Only) */}
            {!isDeposit && transaction.status === "SUCCESS" && (
              <div className="pt-3 border-t border-gray-50 space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Successful</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-emerald-500 mx-2 -mt-4" />
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Processed</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-emerald-500 mx-2 -mt-4" />
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Received</span>
                  </div>
                </div>

                {/* Subtext info notice */}
                <div className="p-3 bg-gray-50 rounded-xl text-left border border-gray-100">
                  <p className="text-[9.5px] text-gray-500 font-semibold leading-relaxed">
                    The recipient account is expected to be credited within 5 minutes, subject to notification by the bank. If you have any questions, you can also <span className="text-[#FC7A00] font-bold hover:underline cursor-pointer">contact the recipient bank &gt;&gt;</span>
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Detailed Specifications List Card */}
          <div className="bg-white rounded-3xl p-5 border border-gray-100 shadow-sm space-y-4">
            <h3 className="font-hanken font-extrabold text-[12px] text-gray-800 uppercase tracking-widest border-b border-gray-50 pb-2">
              Transaction Details
            </h3>

            <div className="space-y-3.5 text-xs">
              {/* Account Credited/Debited */}
              <div className="flex justify-between items-start text-gray-500 font-semibold">
                <span>{isDeposit ? "Credited to" : "Debited from"}</span>
                <span className="text-black font-bold flex items-center gap-1">
                  Available Balance
                  <span className="material-symbols-outlined text-xs text-gray-400">chevron_right</span>
                </span>
              </div>

              {/* Sender/Recipient details */}
              <div className="flex justify-between items-start text-gray-500 font-semibold">
                <span>{isDeposit ? "Sender Details" : "Recipient Details"}</span>
                <div className="text-right max-w-[200px]">
                  <p className="text-black font-bold uppercase truncate">{entityName}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-none">
                    {bankDisplayName} | {mockAccountNumber}
                  </p>
                </div>
              </div>

              {/* Remarks */}
              <div className="flex justify-between items-start text-gray-500 font-semibold">
                <span>Remark</span>
                <span className="text-black font-bold text-right max-w-[200px] truncate">
                  {transaction.description || "web payment"}
                </span>
              </div>

              {/* Transaction Type */}
              <div className="flex justify-between items-center text-gray-500 font-semibold">
                <span>Transaction Type</span>
                <span className="text-black font-bold">
                  {isDeposit ? "Bank Deposit" : "Bank Transfer"}
                </span>
              </div>

              {/* Transaction Number with Copy */}
              <div className="flex justify-between items-center text-gray-500 font-semibold">
                <span>Transaction No.</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-black font-bold uppercase text-[11px]">
                    {transaction.reference}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(transaction.reference, "Transaction number")}
                    className="text-[#FC7A00] hover:brightness-90 active:scale-90 flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px] font-bold">
                      content_copy
                    </span>
                  </button>
                </div>
              </div>

              {/* Transaction Date */}
              <div className="flex justify-between items-center text-gray-500 font-semibold">
                <span>Transaction Date</span>
                <span className="text-black font-bold text-right">
                  {transaction.date} {transaction.time}
                </span>
              </div>

              {/* Session ID with Copy */}
              <div className="flex justify-between items-center text-gray-500 font-semibold">
                <span>Session ID</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono text-black font-bold uppercase text-[11px] truncate max-w-[120px]">
                    {sessionId}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy(sessionId, "Session ID")}
                    className="text-[#FC7A00] hover:brightness-90 active:scale-90 flex items-center justify-center cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px] font-bold">
                      content_copy
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* More Actions Panel */}
          <div className="bg-white rounded-3xl p-4 border border-gray-100 shadow-sm flex justify-between items-center text-xs font-semibold text-gray-500">
            <span>Category</span>
            <span className="text-black font-bold flex items-center gap-1">
              {isDeposit ? "Deposit" : "Transfer"}
              <span className="material-symbols-outlined text-xs text-gray-400">chevron_right</span>
            </span>
          </div>
        </div>

        {/* Sticky Professional Bottom Action Buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-5 bg-white/90 backdrop-blur-md border-t border-gray-100 flex gap-3 z-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-4 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer active:scale-98 transition-all text-center border border-gray-200"
          >
            Dismiss
          </button>
          <button
            type="button"
            onClick={() => handleCopy(sessionId, "Receipt Share link")}
            className="flex-1 py-4 bg-[#10B981] hover:bg-[#059669] text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer active:scale-98 transition-all text-center shadow-sm flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-sm font-bold">share</span>
            Share Receipt
          </button>
        </div>
      </motion.div>
    </div>
  );
};
