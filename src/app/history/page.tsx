"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { TransactionReceipt, Transaction } from "@/components/wallet/TransactionReceipt";

const HISTORICAL_TRANSACTIONS: Transaction[] = [
  {
    id: "tx-1001",
    reference: "ETF-8924021-992",
    type: "DEPOSIT",
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
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "deposit" | "transfer" | "bills" | "card">("all");
  const hasPushedState = React.useRef(false);

  // Sync state with browser back history (device physical/swipe back button support)
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

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Map category strings back to filters
  const getCategoryFromTx = (tx: Transaction) => {
    if (tx.type === "DEPOSIT" || tx.type === "CASHOUT") return "deposit";
    if (tx.type === "TRANSFER") return "transfer";
    if (tx.type === "BILL_PAYMENT") return "bills";
    if (tx.type === "CARD_FUND") return "card";
    return "all";
  };

  // Filter logic based on category buttons and search key characters
  const filteredTransactions = HISTORICAL_TRANSACTIONS.filter((tx) => {
    const txCategory = getCategoryFromTx(tx);
    const matchesCategory = activeCategory === "all" || txCategory === activeCategory;
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

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
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
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
                    ? "bg-[#FC7A00] text-white border-[#FC7A00] shadow-[0_2px_8px_rgba(252,122,0,0.15)]"
                    : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
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
                    className="w-full text-left bg-white border border-gray-200 p-4 rounded-2xl flex items-center justify-between gap-3 active:scale-[0.99] hover:border-gray-300 transition-all cursor-pointer shadow-sm"
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

      {/* Shared High-Fidelity Transaction Receipt Details Drawer wrapped in AnimatePresence for smooth exit transition */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
