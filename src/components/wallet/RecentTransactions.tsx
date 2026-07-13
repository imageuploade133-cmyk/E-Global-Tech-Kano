"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Transaction {
  id: string;
  reference: string;
  type: "DEPOSIT" | "TRANSFER";
  amount: number;
  description: string;
  recipientName?: string;
  bankName?: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  date: string;
  time: string;
  fee: number;
}

const RECENT_ITEMS: Transaction[] = [
  {
    id: "tx-recent-1",
    reference: "ETF-RG-8924021",
    type: "DEPOSIT",
    amount: 150000.00,
    description: "Inbound Settlement Transfer",
    recipientName: "E-TECH WALLET",
    bankName: "Providus Bank",
    status: "SUCCESS",
    date: "Today",
    time: "11:42 AM",
    fee: 0.00,
  },
  {
    id: "tx-recent-2",
    reference: "ETF-RG-1039845",
    type: "TRANSFER",
    amount: 35000.00,
    description: "Outgoing Peer-to-Peer",
    recipientName: "STEVE COLLINS",
    bankName: "Opay Wallet",
    status: "SUCCESS",
    date: "Yesterday",
    time: "04:15 PM",
    fee: 10.00,
  },
];

export const RecentTransactions: React.FC = () => {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const hasPushedState = React.useRef(false);

  // Sync state with browser back history for swipe-to-dismiss behavior
  React.useEffect(() => {
    if (selectedTx) {
      window.history.pushState({ receiptOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        setSelectedTx(null);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [selectedTx]);

  const handleCopyReference = (ref: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(ref);
      toast.success("Transaction reference copied!");
    }
  };

  return (
    <section className="mb-stack-lg">
      {/* Header section */}
      <div className="flex justify-between items-center mb-3">
        <div className="flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[18px] text-[#FC7A00] font-bold">history</span>
          <h3 className="font-headline-md text-[15px] min-[360px]:text-[17px] text-on-surface font-black uppercase tracking-wider">
            Quick Activity
          </h3>
        </div>
        <Link
          href="/history"
          className="font-label-sm text-[11px] min-[360px]:text-xs text-[#FC7A00] font-extrabold hover:underline flex items-center gap-0.5"
        >
          See All
          <span className="material-symbols-outlined text-[14px]">chevron_right</span>
        </Link>
      </div>

      {/* Transaction Rows */}
      <div className="space-y-3">
        {RECENT_ITEMS.map((tx) => {
          const isDeposit = tx.type === "DEPOSIT";

          return (
            <motion.button
              key={tx.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTx(tx)}
              className={cn(
                "w-full text-left relative overflow-hidden rounded-2xl p-4 flex items-center justify-between gap-3 border transition-all cursor-pointer shadow-xs",
                isDeposit
                  ? "bg-gradient-to-r from-emerald-500/[0.04] via-emerald-500/[0.01] to-white border-emerald-500/15 hover:border-emerald-500/30"
                  : "bg-gradient-to-r from-[#FC7A00]/[0.04] via-[#FC7A00]/[0.01] to-white border-[#FC7A00]/15 hover:border-[#FC7A00]/30"
              )}
            >
              {/* Colored Side Accent Gradient Strip */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-[4px]",
                  isDeposit
                    ? "bg-gradient-to-b from-emerald-500 to-emerald-600"
                    : "bg-gradient-to-b from-[#FC7A00] to-[#E06600]"
                )}
              />

              <div className="flex items-center gap-3.5 min-w-0">
                {/* Gradient-colored circle icon wrapper */}
                <div
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-inner",
                    isDeposit
                      ? "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600"
                      : "bg-gradient-to-br from-[#FFF2E6] to-[#FFE4CC] text-[#FC7A00]"
                  )}
                >
                  <span className="material-symbols-outlined text-[19px] font-extrabold">
                    {isDeposit ? "south_west" : "north_east"}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="font-hanken font-extrabold text-[12.5px] text-black leading-tight truncate">
                    {tx.description}
                  </p>
                  <p className="font-hanken text-[9.5px] text-gray-400 mt-1 font-bold uppercase tracking-wider flex items-center gap-1">
                    <span>{tx.date}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{tx.time}</span>
                  </p>
                </div>
              </div>

              {/* Amount and Status */}
              <div className="text-right flex-shrink-0">
                <p
                  className={cn(
                    "font-mono text-[13.5px] min-[360px]:text-[14.5px] font-black tracking-tight",
                    isDeposit ? "text-emerald-600" : "text-black"
                  )}
                >
                  {isDeposit ? "+" : "-"}
                  ₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full",
                    isDeposit ? "bg-emerald-500" : "bg-[#FC7A00]"
                  )} />
                  <span className="font-hanken text-[8.5px] font-black uppercase tracking-widest text-gray-500">
                    {tx.status}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Modern Receipt Details Drawer overlay */}
      <AnimatePresence>
        {selectedTx && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedTx(null)}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99998]"
            />

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
                  setSelectedTx(null);
                }
              }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 shadow-none text-black overflow-hidden touch-none select-none"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto cursor-grab active:cursor-grabbing" />

              {/* Receipt Header details */}
              <div className="text-center space-y-2 pb-6 border-b border-gray-100">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full mx-auto flex items-center justify-center shadow-inner",
                    selectedTx.type === "DEPOSIT"
                      ? "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600"
                      : "bg-gradient-to-br from-[#FFF2E6] to-[#FFE4CC] text-[#FC7A00]"
                  )}
                >
                  <span className="material-symbols-outlined text-[23px] font-bold">
                    {selectedTx.type === "DEPOSIT" ? "south_west" : "north_east"}
                  </span>
                </div>

                <h3 className="font-hanken font-black text-[10px] uppercase tracking-widest text-gray-400">
                  Transaction Receipt
                </h3>
                <p className="font-mono text-xl min-[360px]:text-2xl font-black text-black">
                  {selectedTx.type === "DEPOSIT" ? "+" : "-"}
                  ₦{selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                <p className="font-hanken text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  {selectedTx.description}
                </p>
              </div>

              {/* Data Specifications Table */}
              <div className="py-5 space-y-3.5 text-xs">
                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Reference ID</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-black font-bold uppercase text-[11px]">{selectedTx.reference}</span>
                    <button
                      onClick={() => handleCopyReference(selectedTx.reference)}
                      className="text-[#FC7A00] hover:brightness-95 active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Type</span>
                  <span className="font-bold text-black uppercase text-[11px]">{selectedTx.type}</span>
                </div>

                {selectedTx.recipientName && (
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Beneficiary / Sender</span>
                    <span className="font-bold text-black uppercase text-[11px]">{selectedTx.recipientName}</span>
                  </div>
                )}

                {selectedTx.bankName && (
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Provider Bank</span>
                    <span className="font-bold text-black uppercase text-[11px]">{selectedTx.bankName}</span>
                  </div>
                )}

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Processing Fee</span>
                  <span className="font-bold text-black uppercase text-[11px]">
                    ₦{selectedTx.fee.toFixed(2)}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Status code</span>
                  <span
                    className={cn(
                      "font-black tracking-widest text-[10px] uppercase",
                      selectedTx.status === "SUCCESS" ? "text-emerald-600" : "text-error"
                    )}
                  >
                    {selectedTx.status}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Settlement Time</span>
                  <span className="font-bold text-black text-[11px]">{selectedTx.date} @ {selectedTx.time}</span>
                </div>
              </div>

              {/* Primary Dismiss */}
              <button
                onClick={() => setSelectedTx(null)}
                className="w-full mt-2 py-4 bg-gray-50 hover:bg-gray-100 text-black text-[11px] font-black uppercase tracking-widest rounded-2xl cursor-pointer active:scale-95 transition-all text-center"
              >
                Dismiss Receipt
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </section>
  );
};
