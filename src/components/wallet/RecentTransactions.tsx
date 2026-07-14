"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TransactionReceipt, Transaction } from "./TransactionReceipt";

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
        if (e.state && e.state.receiptOpen) {
          hasPushedState.current = false;
          setSelectedTx(null);
        }
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

  return (
    <section className="mb-stack-lg space-y-3.5">
      {/* Premium Header section */}
      <div className="flex justify-between items-end px-1">
        <div>
          <h3 className="font-headline-md text-[16px] min-[360px]:text-[19px] text-gray-900 font-bold tracking-tight">
            Quick Activity
          </h3>
          <p className="font-hanken text-[9.5px] text-gray-400 font-extrabold uppercase tracking-widest mt-0.5">Real-time ledger feeds</p>
        </div>
        <Link
          href="/history"
          className="font-label-sm text-[11px] min-[360px]:text-xs text-[#FC7A00] font-black hover:brightness-110 flex items-center gap-0.5 transition-all"
        >
          See All
          <span className="material-symbols-outlined text-[15px] font-bold">arrow_forward</span>
        </Link>
      </div>

      {/* Glossy Tri-Gradient Transaction Cards */}
      <div className="space-y-3">
        {RECENT_ITEMS.map((tx) => {
          const isDeposit = tx.type === "DEPOSIT";

          return (
            <motion.button
              key={tx.id}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedTx(tx)}
              className={cn(
                "w-full text-left relative overflow-hidden rounded-[20px] p-4.5 flex items-center justify-between gap-3 border transition-all cursor-pointer shadow-xs",
                isDeposit
                  ? "bg-gradient-to-r from-emerald-500/[0.04] via-emerald-500/[0.01] to-white border-emerald-500/15 hover:border-emerald-500/35 hover:shadow-sm"
                  : "bg-gradient-to-r from-[#FC7A00]/[0.04] via-[#FC7A00]/[0.01] to-white border-[#FC7A00]/15 hover:border-[#FC7A00]/35 hover:shadow-sm"
              )}
            >
              {/* Premium Multi-Color Side Accent Gradient Strip */}
              <div
                className={cn(
                  "absolute left-0 top-0 bottom-0 w-[4.5px]",
                  isDeposit
                    ? "bg-gradient-to-b from-[#07B038] via-emerald-500 to-[#034A17]"
                    : "bg-gradient-to-b from-[#FC7A00] via-[#FF9E40] to-[#B35200]"
                )}
              />

              <div className="flex items-center gap-4 min-w-0">
                {/* Glossy Backdrop Blurred Gradient icon container */}
                <div
                  className={cn(
                    "w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm border",
                    isDeposit
                      ? "bg-gradient-to-br from-emerald-50 to-emerald-100 text-emerald-600 border-emerald-200/50"
                      : "bg-gradient-to-br from-[#FFF2E6] to-[#FFE4CC] text-[#FC7A00] border-[#FFE4CC]/50"
                  )}
                >
                  <span className="material-symbols-outlined text-[20px] font-black">
                    {isDeposit ? "south_west" : "north_east"}
                  </span>
                </div>

                <div className="min-w-0">
                  <p className="font-hanken font-extrabold text-[13px] text-gray-900 leading-tight truncate">
                    {tx.description}
                  </p>
                  <p className="font-hanken text-[9.5px] text-gray-400 mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>{tx.date}</span>
                    <span className="w-1 h-1 rounded-full bg-gray-300" />
                    <span>{tx.time}</span>
                  </p>
                </div>
              </div>

              {/* Amount and Status Pill layout */}
              <div className="text-right flex-shrink-0">
                <p
                  className={cn(
                    "font-mono text-[14px] min-[360px]:text-[15px] font-black tracking-tight",
                    isDeposit ? "text-emerald-600" : "text-gray-950"
                  )}
                >
                  {isDeposit ? "+" : "-"}
                  ₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-150 rounded-full px-2 py-0.5 mt-1.5 shadow-3xs">
                  <span className={cn(
                    "w-1.5 h-1.5 rounded-full animate-pulse",
                    isDeposit ? "bg-emerald-500" : "bg-[#FC7A00]"
                  )} />
                  <span className="font-hanken text-[8px] font-black uppercase tracking-widest text-gray-500">
                    {tx.status}
                  </span>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Shared Transaction Receipt details Drawer modal wrapped in AnimatePresence for smooth exit transition */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>
    </section>
  );
};
