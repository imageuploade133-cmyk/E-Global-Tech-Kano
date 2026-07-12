"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

interface TransactionItem {
  id: string;
  reference: string;
  type: "DEPOSIT" | "TRANSFER" | "BILL_PAYMENT" | "CARD_FUND" | "CASHOUT";
  category: "deposit" | "transfer" | "bills" | "card";
  amount: number;
  currency: "NGN" | "USD";
  description: string;
  recipientName?: string;
  bankName?: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  date: string;
  time: string;
  fee: number;
}

const HISTORICAL_TRANSACTIONS: TransactionItem[] = [
  {
    id: "tx-1001",
    reference: "ETF-8924021-992",
    type: "DEPOSIT",
    category: "deposit",
    amount: 500000.00,
    currency: "NGN",
    description: "Inbound Bank Settlement",
    recipientName: "JULES VERNE",
    bankName: "Providus Bank",
    status: "SUCCESS",
    date: "Jul 12, 2024",
    time: "10:42 AM",
    fee: 0.00,
  },
  {
    id: "tx-1002",
    reference: "ETF-1039845-812",
    type: "TRANSFER",
    category: "transfer",
    amount: 120000.00,
    currency: "NGN",
    description: "Account Transfer to Steve",
    recipientName: "STEVE COLLINS",
    bankName: "Opay Wallet",
    status: "SUCCESS",
    date: "Jul 11, 2024",
    time: "06:15 PM",
    fee: 10.00,
  },
  {
    id: "tx-1003",
    reference: "ETF-3904812-709",
    type: "BILL_PAYMENT",
    category: "bills",
    amount: 25000.00,
    currency: "NGN",
    description: "DSTV Premium Renewal",
    recipientName: "MultiChoice DSTV",
    bankName: "E-Tech Bills Hub",
    status: "SUCCESS",
    date: "Jul 09, 2024",
    time: "02:30 PM",
    fee: 100.00,
  },
  {
    id: "tx-1004",
    reference: "ETF-7719283-441",
    type: "CARD_FUND",
    category: "card",
    amount: 50.00,
    currency: "USD",
    description: "USD Card Provisioning",
    recipientName: "USD Virtual Card",
    bankName: "Silicon Valley Bank",
    status: "SUCCESS",
    date: "Jul 08, 2024",
    time: "09:05 AM",
    fee: 1.50,
  },
  {
    id: "tx-1005",
    reference: "ETF-1123984-500",
    type: "TRANSFER",
    category: "transfer",
    amount: 45000.00,
    currency: "NGN",
    description: "Rent Allocation Payment",
    recipientName: "ADEYEMI LANDLORDS",
    bankName: "Access Bank Plc",
    status: "SUCCESS",
    date: "Jul 05, 2024",
    time: "08:12 AM",
    fee: 25.00,
  },
  {
    id: "tx-1006",
    reference: "ETF-9908123-667",
    type: "BILL_PAYMENT",
    category: "bills",
    amount: 15000.00,
    currency: "NGN",
    description: "IKEDC Prepaid Meter recharge",
    recipientName: "Ikeja Electric",
    status: "FAILED",
    date: "Jul 03, 2024",
    time: "11:58 PM",
    fee: 0.00,
  },
  {
    id: "tx-1007",
    reference: "ETF-4819203-311",
    type: "CASHOUT",
    category: "deposit",
    amount: 30000.00,
    currency: "NGN",
    description: "Card Withdrawal Cashout",
    recipientName: "Self POS Agent",
    bankName: "First Bank ATM",
    status: "SUCCESS",
    date: "Jun 28, 2024",
    time: "04:50 PM",
    fee: 150.00,
  }
];

export default function HistoryPage() {
  const { userData, user } = useAuth();
  const [selectedTx, setSelectedTx] = useState<TransactionItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "deposit" | "transfer" | "bills" | "card">("all");

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Filter logic based on category buttons and search key characters
  const filteredTransactions = HISTORICAL_TRANSACTIONS.filter((tx) => {
    const matchesCategory = activeCategory === "all" || tx.category === activeCategory;
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleCopyReference = (ref: string) => {
    navigator.clipboard.writeText(ref);
    toast.success("Transaction reference copied!");
  };

  return (
    <>
      <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-5"
        >
          {/* Header Bar */}
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="w-9 h-9 rounded-full border border-gray-100 bg-white shadow-sm flex items-center justify-center text-gray-700 active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </Link>
            <div>
              <h2 className="font-hanken font-extrabold text-lg text-black leading-tight">Activity Log</h2>
              <p className="font-hanken text-[11px] text-gray-400 font-bold uppercase tracking-wider">Historical Transactions</p>
            </div>
          </div>

          {/* Search Bar Input */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search reference, recipient, or category..."
              className="w-full bg-white border border-gray-100 rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00]/40 shadow-sm transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Pill Filters Horizontal Drawer */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-margin-mobile px-margin-mobile select-none">
            {[
              { id: "all" as const, label: "All Logs" },
              { id: "deposit" as const, label: "Deposits" },
              { id: "transfer" as const, label: "Transfers" },
              { id: "bills" as const, label: "Bills Pay" },
              { id: "card" as const, label: "Virtual Cards" }
            ].map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "px-4 py-2 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex-shrink-0 cursor-pointer shadow-sm border",
                  activeCategory === cat.id
                    ? "bg-[#FC7A00] text-white border-[#FC7A00]"
                    : "bg-white text-gray-600 border-gray-100 hover:bg-gray-50"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="space-y-2.5">
            {filteredTransactions.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <span className="material-symbols-outlined text-[48px] text-gray-300">receipt_long</span>
                <p className="font-hanken font-bold text-xs text-gray-400 uppercase tracking-widest">No matching activities</p>
                <p className="font-hanken text-[10px] text-gray-400">Refine search text or select another category filter.</p>
              </div>
            ) : (
              filteredTransactions.map((tx) => {
                const isCredit = tx.type === "DEPOSIT" || tx.type === "CASHOUT";
                return (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full text-left bg-white border border-gray-100 p-4 rounded-2xl flex items-center justify-between gap-3 active:scale-[0.99] hover:border-gray-200 transition-all cursor-pointer shadow-sm"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Interactive type indicator badge icons */}
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                          isCredit ? "bg-emerald-50 text-emerald-600" : "bg-error/5 text-error"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {tx.type === "DEPOSIT" && "south_west"}
                          {tx.type === "TRANSFER" && "north_east"}
                          {tx.type === "BILL_PAYMENT" && "receipt_long"}
                          {tx.type === "CARD_FUND" && "credit_card"}
                          {tx.type === "CASHOUT" && "atm"}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <p className="font-hanken font-extrabold text-xs text-black leading-tight truncate">
                          {tx.description}
                        </p>
                        <p className="font-hanken text-[9px] text-gray-400 mt-1 font-semibold uppercase tracking-wider">
                          {tx.date} • {tx.time}
                        </p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p
                        className={cn(
                          "font-mono text-xs min-[360px]:text-sm font-bold",
                          isCredit ? "text-emerald-600" : "text-black"
                        )}
                      >
                        {isCredit ? "+" : "-"}
                        {tx.currency === "NGN" ? "₦" : "$"}
                        {tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>

                      <span
                        className={cn(
                          "inline-block px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest mt-1 uppercase",
                          tx.status === "SUCCESS" && "bg-emerald-50 text-emerald-600",
                          tx.status === "PENDING" && "bg-amber-50 text-amber-600",
                          tx.status === "FAILED" && "bg-error/5 text-error"
                        )}
                      >
                        {tx.status}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </motion.div>
      </main>

      {/* High-Fidelity Transaction Receipt Details Drawer */}
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
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 shadow-none text-black overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto" />

              {/* Receipt Header details */}
              <div className="text-center space-y-2 pb-6 border-b border-gray-100">
                <div
                  className={cn(
                    "w-12 h-12 rounded-full mx-auto flex items-center justify-center",
                    selectedTx.type === "DEPOSIT" || selectedTx.type === "CASHOUT"
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-error/5 text-error"
                  )}
                >
                  <span className="material-symbols-outlined text-[24px]">
                    {selectedTx.type === "DEPOSIT" && "south_west"}
                    {selectedTx.type === "TRANSFER" && "north_east"}
                    {selectedTx.type === "BILL_PAYMENT" && "receipt_long"}
                    {selectedTx.type === "CARD_FUND" && "credit_card"}
                    {selectedTx.type === "CASHOUT" && "atm"}
                  </span>
                </div>

                <h3 className="font-hanken font-black text-sm uppercase tracking-widest text-gray-400">
                  Transaction Receipt
                </h3>
                <p className="font-mono text-xl min-[360px]:text-2xl font-black text-black">
                  {selectedTx.type === "DEPOSIT" || selectedTx.type === "CASHOUT" ? "+" : "-"}
                  {selectedTx.currency === "NGN" ? "₦" : "$"}
                  {selectedTx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>

                <p className="font-hanken text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-relaxed">
                  {selectedTx.description}
                </p>
              </div>

              {/* Data Specifications Table */}
              <div className="py-5 space-y-3 text-xs">
                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Reference ID</span>
                  <div className="flex items-center gap-1">
                    <span className="font-mono text-black font-bold uppercase text-[11px]">{selectedTx.reference}</span>
                    <button
                      onClick={() => handleCopyReference(selectedTx.reference)}
                      className="text-primary hover:brightness-95 active:scale-95 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[14px]">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Transfer Type</span>
                  <span className="font-bold text-black uppercase text-[11px]">{selectedTx.type}</span>
                </div>

                {selectedTx.recipientName && (
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Beneficiary</span>
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
                    {selectedTx.currency === "NGN" ? "₦" : "$"}
                    {selectedTx.fee.toFixed(2)}
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
                className="w-full mt-2 py-4 bg-gray-50 hover:bg-gray-100 text-black text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer active:scale-95 transition-all text-center"
              >
                Dismiss Receipt
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
