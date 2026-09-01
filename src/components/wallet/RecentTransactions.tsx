"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { TransactionReceipt, Transaction } from "./TransactionReceipt";
import { TransactionIcon } from "./TransactionIcon";
import { formatTransactionDateTime } from "@/lib/date-utils";
import { db } from "@/lib/firebase";
import { useAuth } from "@/lib/AuthContext";
import { collection, query, where, orderBy, limit, getDocs } from "firebase/firestore";

interface RecentTransactionsProps {
  isLoading?: boolean;
}

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

const RECENT_TX_CACHE_KEY = "recent_transactions_cache";
const RECENT_TX_TTL_MS = 3 * 60 * 1000; // 3-minute cache to drastically save Firestore read budget

export const RecentTransactions: React.FC<RecentTransactionsProps> = ({ isLoading: propIsLoading }) => {
  const { user } = useAuth();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [isBalanceVisible, setIsBalanceVisible] = useState(true);
  const hasPushedState = React.useRef(false);

  useEffect(() => {
    const checkVisibility = () => {
      const saved = sessionStorage.getItem("balance_visible");
      if (saved !== null) {
        setIsBalanceVisible(saved === "true");
      }
    };

    checkVisibility();

    window.addEventListener("balance_visibility_changed", checkVisibility);
    return () => {
      window.removeEventListener("balance_visibility_changed", checkVisibility);
    };
  }, []);

  const fetchRecentTransactions = async (forceRefresh = false) => {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
    if (isMock || !user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    // Check low-read session cache first unless explicit refresh is requested
    if (!forceRefresh && typeof window !== "undefined") {
      try {
        const raw = sessionStorage.getItem(`${RECENT_TX_CACHE_KEY}_${user.uid}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && Array.isArray(parsed.data) && Date.now() - parsed.timestamp < RECENT_TX_TTL_MS) {
            setTransactions(parsed.data);
            setLoading(false);
            return;
          }
        }
      } catch {
        // Fall back to getDocs query on cache read error
      }
    }

    try {
      setLoading(true);
      const q = query(
        collection(db, "transactions"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc"),
        limit(3)
      );

      const snapshot = await getDocs(q);
      const list: Transaction[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        list.push({
          id: docSnap.id,
          ...data,
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
        } as Transaction);
      });

      setTransactions(list);

      // Save in low-read session cache
      if (typeof window !== "undefined") {
        try {
          sessionStorage.setItem(
            `${RECENT_TX_CACHE_KEY}_${user.uid}`,
            JSON.stringify({ data: list, timestamp: Date.now() })
          );
        } catch {
          // Ignore storage write errors
        }
      }
    } catch (error) {
      console.error("[RecentTransactions Query Error]:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecentTransactions();

    const handleAppRefresh = () => {
      fetchRecentTransactions(true);
    };

    window.addEventListener("app-refresh", handleAppRefresh);
    return () => {
      window.removeEventListener("app-refresh", handleAppRefresh);
    };
  }, [user]);

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
    <section className="mb-stack-lg p-4 bg-white/95 border border-gray-200/90 rounded-[24px] shadow-3xs space-y-3.5 transition-all">
      {/* Premium Header section */}
      <div className="flex justify-between items-end px-0.5">
        <div>
          <h3 className="font-headline-md text-[16px] min-[360px]:text-[18px] text-gray-900 font-bold tracking-tight">
            Quick Activity
          </h3>
          <p className="font-hanken text-[9.5px] text-gray-400 font-extrabold uppercase tracking-widest mt-0.5">Real-time ledger feeds</p>
        </div>
        {isBalanceVisible && (
          <Link
            href="/history"
            className="font-label-sm text-[11px] min-[360px]:text-xs text-[#FC7A00] font-black hover:brightness-110 flex items-center gap-0.5 transition-all"
          >
            See All
            <span className="material-symbols-outlined text-[15px] font-bold">arrow_forward</span>
          </Link>
        )}
      </div>

      {/* Glossy Tri-Gradient Transaction Cards or Hidden State Indicator */}
      <AnimatePresence mode="wait">
        {!isBalanceVisible ? (
          <motion.div
            key="hidden-activity"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="p-5 bg-gray-50/80 border border-dashed border-gray-200 rounded-[20px] text-center space-y-2 select-none"
          >
            <div className="w-10 h-10 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00] mx-auto">
              <span className="material-symbols-outlined text-[20px]">visibility_off</span>
            </div>
            <p className="font-hanken font-bold text-xs text-gray-700">Quick Activity Hidden</p>
            <p className="font-hanken text-[10.5px] text-gray-400 max-w-xs mx-auto">
              Click the eye icon on your balance card above to reveal your real-time ledger feed.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="visible-activity"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-3"
          >
        {(propIsLoading || loading) ? (
          // Shimmer placeholders for transactions - exact layout matching live rows
          [1, 2].map((i) => (
            <div
              key={i}
              className="w-full relative overflow-hidden rounded-[20px] p-4.5 flex items-center justify-between gap-3 bg-gray-50/50 border border-gray-100 shadow-xs"
            >
              <div className="absolute left-0 top-0 bottom-0 w-[4.5px] bg-gray-200 skeleton-shimmer" />
              <div className="flex items-center gap-4 min-w-0">
                <div className="w-11 h-11 rounded-full skeleton-shimmer flex-shrink-0" />
                <div className="min-w-0 space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded skeleton-shimmer w-36" />
                  <div className="h-3 bg-gray-100 rounded skeleton-shimmer w-20" />
                </div>
              </div>
              <div className="text-right flex-shrink-0 space-y-2">
                <div className="h-4 bg-gray-200 rounded skeleton-shimmer w-16 ml-auto" />
                <div className="h-4.5 bg-gray-100 rounded-full skeleton-shimmer w-12 ml-auto" />
              </div>
            </div>
          ))
        ) : (
          transactions.map((tx) => {
            const isDeposit = tx.type === "DEPOSIT" || tx.type === "CASHOUT";

            return (
              <motion.button
                key={tx.id}
                whileTap={{ scale: 0.98 }}
                onClick={() => setSelectedTx(tx)}
                className={cn(
                  "w-full text-left relative overflow-hidden rounded-[20px] p-4.5 flex items-center justify-between gap-3 premium-gradient-border transition-all cursor-pointer shadow-xs",
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
                  <TransactionIcon
                    type={tx.type}
                    description={tx.description}
                    recipientName={tx.recipientName}
                    bankName={tx.bankName}
                    className="w-11 h-11"
                  />

                  <div className="min-w-0">
                    <p className="font-hanken font-extrabold text-[13px] text-gray-900 leading-tight truncate">
                      {tx.description}
                    </p>
                    {(() => {
                      const dt = formatTransactionDateTime(tx.createdAt, tx.date, tx.time);
                      return (
                        <p className="font-hanken text-[9.5px] text-gray-400 mt-1 font-bold uppercase tracking-wider flex items-center gap-1.5">
                          <span>{dt.date}</span>
                          <span className="w-1 h-1 rounded-full bg-gray-300" />
                          <span>{dt.time}</span>
                        </p>
                      );
                    })()}
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

                  {(() => {
                    const normalized = normalizeStatus(tx.status);
                    return (
                      <div className="inline-flex items-center gap-1 bg-gray-50 border border-gray-150 rounded-full px-2 py-0.5 mt-1.5 shadow-3xs">
                        <span className={cn(
                          "w-1.5 h-1.5 rounded-full animate-pulse",
                          normalized === "SUCCESS" && "bg-emerald-500",
                          normalized === "PENDING" && "bg-amber-500",
                          normalized === "REFUND" && "bg-blue-500",
                          normalized === "FAILED" && "bg-red-500"
                        )} />
                        <span className="font-hanken text-[8px] font-black uppercase tracking-widest text-gray-500">
                          {normalized === "SUCCESS" ? "Successful" : normalized === "REFUND" ? "Refunded" : normalized === "PENDING" ? "Pending" : "Failed"}
                        </span>
                      </div>
                    );
                  })()}
                </div>
              </motion.button>
            );
          })
        )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shared Transaction Receipt details Drawer modal wrapped in AnimatePresence for smooth exit transition */}
      <AnimatePresence>
        {selectedTx && (
          <TransactionReceipt transaction={selectedTx} onClose={() => setSelectedTx(null)} />
        )}
      </AnimatePresence>
    </section>
  );
};
