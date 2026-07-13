"use client";

import React from "react";
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
  const handleCopyReference = (ref: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(ref);
      toast.success("Transaction reference copied!");
    }
  };

  if (!transaction) return null;

  const isDeposit =
    transaction.type === "DEPOSIT" || transaction.type === "CASHOUT";
  const currencySymbol = transaction.currency === "USD" ? "$" : "₦";

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

      {/* Swipe-to-dismiss Drawer */}
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
        className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 shadow-none text-black overflow-hidden touch-none select-none"
      >
        {/* Drag Handle */}
        <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto cursor-grab active:cursor-grabbing" />

        {/* Receipt Header details */}
        <div className="text-center space-y-2 pb-6 border-b border-gray-100">
          <div
            className={cn(
              "w-12 h-12 rounded-full mx-auto flex items-center justify-center shadow-inner",
              isDeposit
                ? "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600"
                : "bg-gradient-to-br from-[#FFF2E6] to-[#FFE4CC] text-[#FC7A00]"
            )}
          >
            <span className="material-symbols-outlined text-[23px] font-bold">
              {transaction.type === "DEPOSIT" && "south_west"}
              {transaction.type === "TRANSFER" && "north_east"}
              {transaction.type === "BILL_PAYMENT" && "receipt_long"}
              {transaction.type === "CARD_FUND" && "credit_card"}
              {transaction.type === "CASHOUT" && "atm"}
            </span>
          </div>

          <h3 className="font-hanken font-black text-[10px] uppercase tracking-widest text-gray-400">
            Transaction Receipt
          </h3>
          <p className="font-mono text-xl min-[360px]:text-2xl font-black text-black">
            {isDeposit ? "+" : "-"}
            {currencySymbol}
            {transaction.amount.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </p>

          <p className="font-hanken text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
            {transaction.description}
          </p>
        </div>

        {/* Data Specifications Table */}
        <div className="py-5 space-y-3.5 text-xs">
          <div className="flex justify-between items-center text-gray-500 font-semibold">
            <span>Reference ID</span>
            <div className="flex items-center gap-1">
              <span className="font-mono text-black font-bold uppercase text-[11px]">
                {transaction.reference}
              </span>
              <button
                onClick={() => handleCopyReference(transaction.reference)}
                className="text-[#FC7A00] hover:brightness-95 active:scale-95 flex items-center justify-center cursor-pointer"
              >
                <span className="material-symbols-outlined text-[14px]">
                  content_copy
                </span>
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center text-gray-500 font-semibold">
            <span>Type</span>
            <span className="font-bold text-black uppercase text-[11px]">
              {transaction.type}
            </span>
          </div>

          {transaction.recipientName && (
            <div className="flex justify-between items-center text-gray-500 font-semibold">
              <span>Beneficiary / Sender</span>
              <span className="font-bold text-black uppercase text-[11px]">
                {transaction.recipientName}
              </span>
            </div>
          )}

          {transaction.bankName && (
            <div className="flex justify-between items-center text-gray-500 font-semibold">
              <span>Provider Bank</span>
              <span className="font-bold text-black uppercase text-[11px]">
                {transaction.bankName}
              </span>
            </div>
          )}

          <div className="flex justify-between items-center text-gray-500 font-semibold">
            <span>Processing Fee</span>
            <span className="font-bold text-black uppercase text-[11px]">
              {currencySymbol}
              {transaction.fee.toFixed(2)}
            </span>
          </div>

          <div className="flex justify-between items-center text-gray-500 font-semibold">
            <span>Status code</span>
            <span
              className={cn(
                "font-black tracking-widest text-[10px] uppercase",
                transaction.status === "SUCCESS" ? "text-emerald-600" : "text-error"
              )}
            >
              {transaction.status}
            </span>
          </div>

          <div className="flex justify-between items-center text-gray-500 font-semibold">
            <span>Settlement Time</span>
            <span className="font-bold text-black text-[11px]">
              {transaction.date} @ {transaction.time}
            </span>
          </div>
        </div>

        {/* Primary Dismiss */}
        <button
          onClick={onClose}
          className="w-full mt-2 py-4 bg-gray-50 hover:bg-gray-100 text-black text-[11px] font-black uppercase tracking-widest rounded-2xl cursor-pointer active:scale-95 transition-all text-center"
        >
          Dismiss Receipt
        </button>
      </motion.div>
    </div>
  );
};
