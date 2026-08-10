"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { TransactionReceipt, Transaction } from "@/components/wallet/TransactionReceipt";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";

export default function HistoryPage() {
  const { userData, user } = useAuth();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "deposit" | "transfer" | "bills" | "card">("all");
  const [selectedCurrencyFilter, setSelectedCurrencyFilter] = useState<"ALL" | "NGN" | "USD">("ALL");
  const hasPushedState = React.useRef(false);

  // Pagination states for production-grade low read operations
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

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

  // Initial secure paginated loading of transactions
  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (isMock || !user) {
      setTransactions([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    const fetchInitialTransactions = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          orderBy("createdAt", "desc"),
          limit(15)
        );

        const snap = await getDocs(q);
        const list: Transaction[] = [];
        snap.forEach((docSnap) => {
          const data = docSnap.data();
          list.push({
            id: docSnap.id,
            reference: data.reference || docSnap.id,
            type: data.type || "DEPOSIT",
            amount: Number(data.amount) || 0,
            currency: data.currency || "NGN",
            description: data.description || "",
            recipientName: data.recipientName || "",
            bankName: data.bankName || "",
            status: data.status || "SUCCESS",
            date: data.date || "",
            time: data.time || "",
            fee: Number(data.fee) || 0,
          });
        });

        setTransactions(list);
        if (snap.docs.length < 15) {
          setHasMore(false);
        } else {
          setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
          setHasMore(true);
        }
      } catch (err) {
        console.error("[HistoryPage Initial Load Exception]:", err);
        setTransactions([]);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    };

    fetchInitialTransactions();
  }, [user]);

  // Load more function with query cursors to save read budget
  const handleLoadMore = async () => {
    if (!user || loadingMore || !hasMore || !lastVisibleDoc) return;

    try {
      setLoadingMore(true);
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        startAfter(lastVisibleDoc),
        limit(15)
      );

      const snap = await getDocs(q);
      const list: Transaction[] = [];
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          reference: data.reference || docSnap.id,
          type: data.type || "DEPOSIT",
          amount: Number(data.amount) || 0,
          currency: data.currency || "NGN",
          description: data.description || "",
          recipientName: data.recipientName || "",
          bankName: data.bankName || "",
          status: data.status || "SUCCESS",
          date: data.date || "",
          time: data.time || "",
          fee: Number(data.fee) || 0,
        });
      });

      setTransactions((prev) => [...prev, ...list]);
      if (snap.docs.length < 15) {
        setHasMore(false);
        setLastVisibleDoc(null);
      } else {
        setLastVisibleDoc(snap.docs[snap.docs.length - 1]);
        setHasMore(true);
      }
    } catch (err) {
      console.error("[HistoryPage Load More Exception]:", err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Map category strings back to filters
  const getCategoryFromTx = (tx: Transaction) => {
    if (tx.type === "DEPOSIT" || tx.type === "CASHOUT") return "deposit";
    if (tx.type === "TRANSFER") return "transfer";
    if (tx.type === "BILL_PAYMENT" || tx.type === "AIRTIME" || tx.type === "DATA" || tx.type === "BILLS") return "bills";
    if (tx.type === "CARD_FUND") return "card";
    return "all";
  };

  // Filter logic based on category buttons, currency, and search key characters
  const filteredTransactions = transactions.filter((tx) => {
    const txCategory = getCategoryFromTx(tx);
    const matchesCategory = activeCategory === "all" || txCategory === activeCategory;
    const matchesCurrency = selectedCurrencyFilter === "ALL" || (tx.currency || "NGN") === selectedCurrencyFilter;
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      tx.type.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch && matchesCurrency;
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
              className="w-full bg-white border border-black rounded-2xl pl-11 pr-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
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

          {/* Currency Filter Row */}
          <div className="flex gap-2 select-none border-b border-gray-100 pb-2">
            {[
              { id: "ALL" as const, label: "All Currencies" },
              { id: "NGN" as const, label: "NGN (₦)" },
              { id: "USD" as const, label: "USD ($)" }
            ].map((cur) => (
              <button
                key={cur.id}
                onClick={() => setSelectedCurrencyFilter(cur.id)}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer border",
                  selectedCurrencyFilter === cur.id
                    ? "bg-black text-white border-black"
                    : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                )}
              >
                {cur.label}
              </button>
            ))}
          </div>

          {/* Transactions List */}
          <div className="space-y-2.5">
            {loading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="w-full h-[72px] bg-white border border-gray-100 rounded-2xl p-4 flex items-center justify-between animate-pulse"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gray-100" />
                      <div className="space-y-2">
                        <div className="h-3 bg-gray-200 rounded w-28" />
                        <div className="h-2 bg-gray-100 rounded w-16" />
                      </div>
                    </div>
                    <div className="space-y-2 text-right">
                      <div className="h-3.5 bg-gray-200 rounded w-16 ml-auto" />
                      <div className="h-2.5 bg-gray-100 rounded w-10 ml-auto" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div className="text-center py-12 space-y-2">
                <span className="material-symbols-outlined text-[48px] text-gray-300">receipt_long</span>
                <p className="font-hanken font-bold text-xs text-gray-400 uppercase tracking-widest">No matching activities</p>
                <p className="font-hanken text-[10px] text-gray-400">Refine search text or select another category filter.</p>
              </div>
            ) : (
              <>
                {filteredTransactions.map((tx) => {
                  const isCredit = tx.type === "DEPOSIT" || tx.type === "CASHOUT";
                  return (
                    <button
                      key={tx.id}
                      onClick={() => setSelectedTx(tx)}
                      className={cn(
                        "w-full text-left relative overflow-hidden bg-white border rounded-2xl p-4 pl-5 flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer shadow-3xs",
                        isCredit
                          ? "bg-gradient-to-r from-emerald-500/[0.03] via-emerald-500/[0.005] to-white border-emerald-500/15 hover:border-emerald-500/35"
                          : "bg-gradient-to-r from-[#FC7A00]/[0.03] via-[#FC7A00]/[0.005] to-white border-[#FC7A00]/15 hover:border-[#FC7A00]/35"
                      )}
                    >
                      {/* Premium Side Accent Strip */}
                      <div
                        className={cn(
                          "absolute left-0 top-0 bottom-0 w-[4px]",
                          isCredit
                            ? "bg-gradient-to-b from-emerald-400 to-emerald-600"
                            : "bg-gradient-to-b from-[#FC7A00] to-[#FF9022]"
                        )}
                      />

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
                            {(tx.type === "TRANSFER" || tx.type === "WITHDRAWAL") && "north_east"}
                            {(tx.type === "BILL_PAYMENT" || tx.type === "AIRTIME" || tx.type === "DATA" || tx.type === "BILLS") && "receipt_long"}
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
                })}

                {/* Highly intuitive production-ready pagination footer */}
                {hasMore && (
                  <div className="pt-4 flex justify-center">
                    {loadingMore ? (
                      <div className="flex items-center gap-2 text-[#FC7A00] font-bold text-xs uppercase tracking-wider">
                        <div className="w-4 h-4 border-2 border-[#FC7A00] border-t-transparent rounded-full animate-spin" />
                        <span>Loading more...</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={handleLoadMore}
                        className="px-6 py-3 rounded-xl border border-[#FC7A00]/30 hover:border-[#FC7A00] bg-white text-[#FC7A00] text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2"
                      >
                        Load More Activity
                      </button>
                    )}
                  </div>
                )}
              </>
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
