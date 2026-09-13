"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface EmergencyBroadcastData {
  active: boolean;
  title: string;
  message: string;
  urgency?: "info" | "warning" | "danger" | "emerald";
  badge?: string;
  icon?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const EmergencyBroadcastBanner: React.FC = () => {
  const [broadcast, setBroadcast] = useState<EmergencyBroadcastData | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Modal hardware/browser back button handling
  useModalBackHandler(isModalOpen, () => setIsModalOpen(false), "emergency-broadcast-modal");

  useEffect(() => {
    const fetchBroadcast = async () => {
      try {
        const res = await fetch("/api/emergency", { cache: "no-store" });
        const data = await res.json();
        if (data.success && data.broadcast && data.broadcast.active) {
          setBroadcast(data.broadcast);
        } else {
          setBroadcast(null);
        }
      } catch (err) {
        console.warn("[EmergencyBroadcastBanner] Fetch error:", err);
      }
    };

    fetchBroadcast();
    // Poll every 30 seconds for live broadcasts
    const interval = setInterval(fetchBroadcast, 30000);
    return () => clearInterval(interval);
  }, []);

  if (!broadcast || !broadcast.active) return null;

  const urgency = broadcast.urgency || "warning";
  const iconName = broadcast.icon || "campaign";
  const badgeLabel = broadcast.badge || "EMERGENCY BROADCAST";

  return (
    <>
      {/* Ticker Banner rendered above wallet balance card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        onClick={() => setIsModalOpen(true)}
        className={cn(
          "w-full max-w-[280px] min-[360px]:max-w-sm md:max-w-md mx-auto mb-3.5 p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all cursor-pointer select-none shadow-xs group",
          urgency === "danger"
            ? "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400 hover:bg-red-500/15"
            : urgency === "warning"
            ? "bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-400 hover:bg-amber-500/15"
            : urgency === "emerald"
            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-400 hover:bg-emerald-500/15"
            : "bg-blue-500/10 border-blue-500/30 text-blue-800 dark:text-blue-400 hover:bg-blue-500/15"
        )}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-full bg-current/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-[18px] font-bold animate-pulse">
              {iconName}
            </span>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-current/20 text-current shrink-0">
                {badgeLabel}
              </span>
              <h4 className="font-extrabold text-xs truncate text-black dark:text-white">
                {broadcast.title}
              </h4>
            </div>
            <p className="text-[10.5px] font-medium text-gray-600 dark:text-gray-300 truncate mt-0.5">
              {broadcast.message}
            </p>
          </div>
        </div>

        <span className="material-symbols-outlined text-[18px] text-gray-400 group-hover:text-black dark:group-hover:text-white transition-colors shrink-0">
          chevron_right
        </span>
      </motion.div>

      {/* Full-Screen Emergency Information Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100000] bg-white dark:bg-gray-950 text-black dark:text-white flex flex-col justify-between overflow-hidden font-hanken select-none">
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
              className="w-full h-full max-w-md mx-auto flex flex-col justify-between overflow-hidden p-5 sm:p-6"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4 flex-shrink-0">
                <div className="flex items-center gap-2.5">
                  <div
                    className={cn(
                      "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                      urgency === "danger"
                        ? "bg-red-500/15 text-red-600"
                        : urgency === "warning"
                        ? "bg-amber-500/15 text-amber-600"
                        : urgency === "emerald"
                        ? "bg-emerald-500/15 text-emerald-600"
                        : "bg-blue-500/15 text-blue-600"
                    )}
                  >
                    <span className="material-symbols-outlined text-[20px] font-bold animate-pulse">
                      {iconName}
                    </span>
                  </div>
                  <div>
                    <span className="text-[9.5px] font-black uppercase tracking-widest text-gray-400 block">
                      {badgeLabel}
                    </span>
                    <h3 className="font-extrabold text-sm uppercase text-black dark:text-white tracking-wide">
                      Official Broadcast
                    </h3>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              </div>

              {/* Scrollable Broadcast Body Content */}
              <div className="flex-1 overflow-y-auto py-6 space-y-5 custom-scrollbar text-left">
                {/* Headline Hero Banner */}
                <div
                  className={cn(
                    "p-5 rounded-3xl border space-y-2 text-left shadow-xs",
                    urgency === "danger"
                      ? "bg-red-500/10 border-red-500/30 text-red-900 dark:text-red-200"
                      : urgency === "warning"
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200"
                      : urgency === "emerald"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-900 dark:text-emerald-200"
                      : "bg-blue-500/10 border-blue-500/30 text-blue-900 dark:text-blue-200"
                  )}
                >
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-current/20 text-current inline-block">
                    {badgeLabel}
                  </span>
                  <h2 className="font-extrabold text-lg text-black dark:text-white leading-tight">
                    {broadcast.title}
                  </h2>
                  {broadcast.updatedAt && (
                    <p className="text-[10px] text-gray-400 font-mono font-medium">
                      Published: {new Date(broadcast.updatedAt).toLocaleString()}
                    </p>
                  )}
                </div>

                {/* Main Body Message Paragraph */}
                <div className="p-5 rounded-3xl bg-gray-50 dark:bg-gray-900 border border-gray-150 dark:border-gray-800 space-y-3">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                    Broadcast Details & Information
                  </span>
                  <p className="font-medium text-xs text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap">
                    {broadcast.message}
                  </p>
                </div>

                {/* Security Verification Footer Card */}
                <div className="p-4 rounded-2xl bg-orange-500/5 border border-orange-500/20 text-center space-y-1">
                  <p className="font-black text-xs text-[#FC7A00] uppercase">
                    E-Global Pay Verified Official Announcement
                  </p>
                  <p className="text-[10px] text-gray-400 font-medium">
                    Broadcast issued by Platform Administration • Real-time Notice
                  </p>
                </div>
              </div>

              {/* Static Bottom Action Bar */}
              <div className="pt-4 border-t border-gray-100 dark:border-gray-800 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer shadow-sm active:scale-98 border-0"
                >
                  I Understand & Acknowledge
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};
