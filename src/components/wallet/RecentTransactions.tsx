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

      {/* Shared Transaction Receipt details Drawer modal wrapped in AnimatePresence for smooth exit transition */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>
    </section>
  );
};
