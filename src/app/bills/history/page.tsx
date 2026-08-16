"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";
import { TransactionReceipt, Transaction } from "@/components/wallet/TransactionReceipt";
import { TransactionIcon } from "@/components/wallet/TransactionIcon";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, limit, getDocs, startAfter, QueryDocumentSnapshot, DocumentData } from "firebase/firestore";
import Link from "next/link";

const normalizeStatus = (status?: string): "SUCCESS" | "PENDING" | "FAILED" | "REFUND" => {
  const s = String(status || "").toUpperCase().trim();
  if (s === "SUCCESS" || s === "SUCCESSFUL" || s === "COMPLETED" || s === "COMPLETE" || s === "ACTIVE" || s === "DELIVERED") {
    return "SUCCESS";
  }
  if (s === "PENDING" || s === "PROCESSING") {
    return "PENDING";
  }
  if (s === "REFUND" || s === "REFUNDED" || s === "REVERSED") {
    return "REFUND";
  }
  return "FAILED";
};

const BILL_TYPES = ["BILL_PAYMENT", "AIRTIME", "DATA", "BILLS", "CABLE", "ELECTRICITY", "WAEC", "BETTING", "UTILITY"];

export default function BillsHistoryPage() {
  const { userData, user } = useAuth();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "airtime" | "data" | "cable" | "electricity" | "waec">("all");
  const hasPushedState = React.useRef(false);

  // Pagination states
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastVisibleDoc, setLastVisibleDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Sync state with browser back history
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

  // Initial secure paginated loading of bill transactions
  useEffect(() => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (isMock || !user) {
      setTransactions([]);
      setLoading(false);
      setHasMore(false);
      return;
    }

    const fetchInitialBillsHistory = async () => {
      try {
        setLoading(true);
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          where("type", "in", BILL_TYPES),
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
            type: data.type || "BILL_PAYMENT",
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
        console.error("[BillsHistoryPage Initial Load Exception]:", err);
        // Fallback for missing composite index if type in query fails
        try {
          const fallbackQuery = query(
            collection(db, "transactions"),
            where("userId", "==", user.uid),
            orderBy("createdAt", "desc"),
            limit(40)
          );
          const fallbackSnap = await getDocs(fallbackQuery);
          const list: Transaction[] = [];
          fallbackSnap.forEach((docSnap) => {
            const data = docSnap.data();
            const typeUpper = (data.type || "").toUpperCase();
            const descLower = (data.description || "").toLowerCase();
            const isBill =
              BILL_TYPES.includes(typeUpper) ||
              descLower.includes("airtime") ||
              descLower.includes("data") ||
              descLower.includes("recharge") ||
              descLower.includes("cable") ||
              descLower.includes("electricity") ||
              descLower.includes("waec");

            if (isBill) {
              list.push({
                id: docSnap.id,
                reference: data.reference || docSnap.id,
                type: data.type || "BILL_PAYMENT",
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
            }
          });
          setTransactions(list);
          setHasMore(false);
        } catch (fallbackErr) {
          console.error("[BillsHistoryPage Fallback Exception]:", fallbackErr);
          setTransactions([]);
          setHasMore(false);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchInitialBillsHistory();
  }, [user]);

  // Load more function
  const handleLoadMore = async () => {
    if (!user || loadingMore || !hasMore || !lastVisibleDoc) return;

    try {
      setLoadingMore(true);
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        where("type", "in", BILL_TYPES),
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
          type: data.type || "BILL_PAYMENT",
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
      console.error("[BillsHistoryPage Load More Exception]:", err);
      setHasMore(false);
    } finally {
      setLoadingMore(false);
    }
  };

  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const getSubCategoryFromTx = (tx: Transaction) => {
    const t = (tx.type || "").toUpperCase();
    const d = (tx.description || "").toLowerCase();
    if (t === "AIRTIME" || d.includes("airtime") || d.includes("recharge")) return "airtime";
    if (t === "DATA" || d.includes("data") || d.includes("sme") || d.includes("gig")) return "data";
    if (t === "CABLE" || d.includes("dstv") || d.includes("gotv") || d.includes("startimes")) return "cable";
    if (t === "ELECTRICITY" || t === "UTILITY" || d.includes("electricity") || d.includes("meter")) return "electricity";
    if (t === "WAEC" || d.includes("waec")) return "waec";
    return "all";
  };

  const filteredTransactions = transactions.filter((tx) => {
    const txSubCategory = getSubCategoryFromTx(tx);
    const matchesCategory = activeCategory === "all" || txSubCategory === activeCategory;
    const matchesSearch =
      tx.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (tx.recipientName && tx.recipientName.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  return (
    <>
      <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black max-w-md mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-5"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                onClick={() => window.history.back()}
                className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
                title="Go Back"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
              </button>
              <div>
                <h2 className="font-bodoni font-extrabold text-lg text-black leading-tight">Bills History</h2>
                <p className="font-hanken text-[10.5px] text-gray-400 font-bold uppercase tracking-wider">Airtime, Data & Utility Logs</p>
              </div>
            </div>

            <Link
              href="/bills"
              className="px-3 py-1.5 rounded-xl border border-[#FC7A00]/30 bg-[#FC7A00]/10 text-[#FC7A00] font-black text-xs uppercase tracking-wider hover:bg-[#FC7A00] hover:text-white transition-all"
            >
              Pay Bills
            </Link>
          </div>

          {/* Search Input */}
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search phone number, provider or ref..."
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

          {/* Filter Pill Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar py-1 -mx-margin-mobile px-margin-mobile select-none">
            {[
              { id: "all" as const, label: "All Bills" },
              { id: "airtime" as const, label: "Airtime" },
              { id: "data" as const, label: "Mobile Data" },
              { id: "cable" as const, label: "Cable TV" },
              { id: "electricity" as const, label: "Electricity" },
              { id: "waec" as const, label: "WAEC Pins" }
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
                <p className="font-hanken font-bold text-xs text-gray-400 uppercase tracking-widest">No bill logs found</p>
                <p className="font-hanken text-[10px] text-gray-400">Try refining search text or select another category filter.</p>
              </div>
            ) : (
              <>
                {filteredTransactions.map((tx) => (
                  <button
                    key={tx.id}
                    onClick={() => setSelectedTx(tx)}
                    className="w-full text-left relative overflow-hidden bg-gradient-to-r from-[#FC7A00]/[0.03] via-[#FC7A00]/[0.005] to-white border border-[#FC7A00]/15 hover:border-[#FC7A00]/35 rounded-2xl p-4 pl-5 flex items-center justify-between gap-3 active:scale-[0.99] transition-all cursor-pointer shadow-3xs"
                  >
                    <div className="absolute left-0 top-0 bottom-0 w-[4px] bg-gradient-to-b from-[#FC7A00] to-[#FF9022]" />

                    <div className="flex items-center gap-3 min-w-0">
                      <TransactionIcon
                        type={tx.type}
                        description={tx.description}
                        recipientName={tx.recipientName}
                        bankName={tx.bankName}
                        className="w-10 h-10"
                      />

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
                      <p className="font-mono text-xs min-[360px]:text-sm font-bold text-black">
                        -₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>

                      {(() => {
                        const normalized = normalizeStatus(tx.status);
                        return (
                          <span
                            className={cn(
                              "inline-block px-2 py-0.5 rounded-full text-[8px] font-black tracking-widest mt-1 uppercase",
                              normalized === "SUCCESS" && "bg-emerald-50 text-emerald-600",
                              normalized === "PENDING" && "bg-amber-50 text-amber-600",
                              normalized === "REFUND" && "bg-blue-50 text-blue-600",
                              normalized === "FAILED" && "bg-error/5 text-error"
                            )}
                          >
                            {normalized === "SUCCESS" ? "Successful" : normalized === "REFUND" ? "Refunded" : normalized === "PENDING" ? "Pending" : "Failed"}
                          </span>
                        );
                      })()}
                    </div>
                  </button>
                ))}

                {/* Skeleton placeholders when loading more bill items so user continues seamlessly */}
                {loadingMore && (
                  <div className="space-y-2.5 pt-1">
                    {[1, 2, 3].map((i) => (
                      <div
                        key={`loading-more-bills-${i}`}
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
                )}

                {hasMore && (
                  <div className="pt-4 flex justify-center">
                    <button
                      type="button"
                      disabled={loadingMore}
                      onClick={handleLoadMore}
                      className="px-6 py-3.5 rounded-xl border border-[#FC7A00]/30 hover:border-[#FC7A00] bg-white text-[#FC7A00] text-xs font-black uppercase tracking-widest transition-all active:scale-95 cursor-pointer flex items-center gap-2.5 shadow-3xs hover:shadow-xs disabled:opacity-60"
                    >
                      {loadingMore ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#FC7A00] border-t-transparent rounded-full animate-spin" />
                          <span>Fetching More Bills...</span>
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[18px]">expand_circle_down</span>
                          <span>Load More Bills History</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </motion.div>
      </main>

      <AnimatePresence>
        {selectedTx && (
          <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>

      <BottomNav />
    </>
  );
}
