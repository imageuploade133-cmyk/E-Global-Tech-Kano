"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  type: "transaction" | "security" | "promo";
  read: boolean;
}

interface NotificationTrayProps {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  onMarkAllRead: () => void;
  onDeleteNotification: (id: string) => void;
  onToggleRead: (id: string) => void;
}

export const NotificationTray: React.FC<NotificationTrayProps> = ({
  isOpen,
  onClose,
  notifications,
  onMarkAllRead,
  onDeleteNotification,
  onToggleRead,
}) => {
  const [trayLoading, setTrayLoading] = useState(true);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  const hasPushedState = useRef(false);
  const hasPushedDetailState = useRef(false);

  // Sync state with browser back history for the Main Notifications Tray
  useEffect(() => {
    if (isOpen && !selectedNotification) {
      window.history.pushState({ notificationsOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        onClose();
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
  }, [isOpen, onClose, selectedNotification]);

  // Sync state with browser back history for the 90% Height Detail Drawer
  useEffect(() => {
    if (selectedNotification) {
      window.history.pushState({ detailOpen: true }, "");
      hasPushedDetailState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedDetailState.current = false;
        setSelectedNotification(null);
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedDetailState.current) {
          window.history.back();
          hasPushedDetailState.current = false;
        }
      };
    }
  }, [selectedNotification]);

  // Simulate skeleton loader when opening the tray
  useEffect(() => {
    if (isOpen) {
      setTrayLoading(true);
      const timer = setTimeout(() => {
        setTrayLoading(false);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Prevent background scrolling while tray or detail is open
  useEffect(() => {
    if (isOpen || selectedNotification) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen, selectedNotification]);

  // Handle drag to dismiss for the 90% detail drawer
  const handleDetailDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      setSelectedNotification(null);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    onToggleRead(n.id);
    setSelectedNotification(n);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
          className="fixed inset-0 w-full h-full bg-white z-[10000] flex flex-col"
        >
          {/* Top Sticky App Header */}
          <div className="safe-top px-margin-mobile py-4 border-b border-gray-100 flex justify-between items-center bg-white">
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
            <div className="text-center">
              <h2 className="font-hanken font-bold text-lg text-black">
                Notifications
              </h2>
            </div>
            {notifications.length > 0 && !trayLoading ? (
              <button
                onClick={onMarkAllRead}
                className="text-[12px] font-bold text-[#d4af37] uppercase tracking-wider hover:brightness-110 cursor-pointer"
              >
                Clear All
              </button>
            ) : (
              <div className="w-10" />
            )}
          </div>

          {/* Scrollable Notifications Area */}
          <div className="flex-grow overflow-y-auto p-margin-mobile space-y-4 custom-scrollbar bg-gray-50/50">
            {trayLoading ? (
              /* High-fidelity Skeleton Loading */
              <div className="space-y-3">
                {[...Array(3)].map((_, idx) => (
                  <div
                    key={idx}
                    className="p-4 rounded-2xl border border-gray-100 bg-white flex gap-4 animate-pulse"
                  >
                    <div className="w-11 h-11 rounded-full bg-gray-100 shrink-0" />
                    <div className="flex-grow space-y-2">
                      <div className="h-4 bg-gray-100 rounded w-1/3" />
                      <div className="h-3 bg-gray-100 rounded w-5/6" />
                      <div className="h-3 bg-gray-100 rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : notifications.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-4 text-gray-400">
                  <span className="material-symbols-outlined text-[36px]">
                    notifications_off
                  </span>
                </div>
                <h3 className="font-hanken font-bold text-lg text-black mb-1">All Caught Up!</h3>
                <p className="text-gray-400 text-sm max-w-[240px]">
                  You have cleared all alerts and messages in your secure inbox.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((n) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={n.id}
                    onClick={() => handleNotificationClick(n)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer select-none shadow-none relative overflow-hidden",
                      n.read
                        ? "bg-white border-gray-100 text-gray-500"
                        : "bg-white border-[#d4af37]/35 text-black"
                    )}
                  >
                    {!n.read && (
                      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-gradient-to-b from-[#d4af37] to-[#f2ca50]" />
                    )}

                    <div className="flex gap-4">
                      {/* Interactive type icons */}
                      <div
                        className={cn(
                          "w-11 h-11 rounded-full flex items-center justify-center shrink-0",
                          n.type === "transaction"
                            ? "bg-[#0b513d]/10 text-[#0b513d]"
                            : n.type === "security"
                            ? "bg-[#dc3545]/10 text-[#dc3545]"
                            : "bg-[#d4af37]/10 text-[#d4af37]"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px] font-bold">
                          {n.type === "transaction"
                            ? "payments"
                            : n.type === "security"
                            ? "gpp_maybe"
                            : "campaign"}
                        </span>
                      </div>

                      <div className="flex-grow pr-6">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className={cn("text-[14px] leading-tight font-hanken", n.read ? "font-medium text-gray-700" : "font-bold text-black")}>
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap ml-2">
                            {n.time}
                          </span>
                        </div>
                        <p className={cn("text-[12px] leading-relaxed font-hanken", n.read ? "text-gray-400" : "text-gray-600")}>
                          {n.message}
                        </p>
                      </div>

                      {/* Delete notification button */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNotification(n.id);
                        }}
                        className="absolute right-3 top-3 w-7 h-7 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-400 hover:text-red-500 hover:border-red-200 transition-all cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[13px] font-bold">close</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* 90% Height Bottom Detail Drawer Sheet */}
          <AnimatePresence>
            {selectedNotification && (
              <>
                {/* Secondary overlay backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setSelectedNotification(null)}
                  className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[20000]"
                />

                {/* 90% Height Bottom Sheet Drawer */}
                <motion.div
                  initial={{ y: "100%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                  drag="y"
                  dragDirectionLock
                  dragConstraints={{ top: 0, bottom: 450 }}
                  dragElastic={{ top: 0, bottom: 0.2 }}
                  onDragEnd={handleDetailDragEnd}
                  className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] z-[20001] flex flex-col items-center select-none cursor-default shadow-none touch-none"
                >
                  {/* Drag Handle */}
                  <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-4 mb-4 cursor-grab active:cursor-grabbing" />

                  {/* Header */}
                  <div className="w-full px-6 flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                    <div className="w-8" />
                    <h3 className="font-hanken font-bold text-base text-black text-center">
                      Detail Information
                    </h3>
                    <button
                      type="button"
                      onClick={() => setSelectedNotification(null)}
                      className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                    </button>
                  </div>

                  {/* Detail Body Content */}
                  <div className="flex-grow overflow-y-auto px-6 w-full custom-scrollbar pb-10">
                    <div className="flex flex-col items-center text-center mt-2 mb-6">
                      <div
                        className={cn(
                          "w-16 h-16 rounded-full flex items-center justify-center mb-4",
                          selectedNotification.type === "transaction"
                            ? "bg-[#0b513d]/10 text-[#0b513d]"
                            : selectedNotification.type === "security"
                            ? "bg-[#dc3545]/10 text-[#dc3545]"
                            : "bg-[#d4af37]/10 text-[#d4af37]"
                        )}
                      >
                        <span className="material-symbols-outlined text-[32px] font-bold">
                          {selectedNotification.type === "transaction"
                            ? "payments"
                            : selectedNotification.type === "security"
                            ? "gpp_maybe"
                            : "campaign"}
                        </span>
                      </div>
                      <h4 className="font-hanken font-bold text-lg text-black mb-1">
                        {selectedNotification.title}
                      </h4>
                      <p className="text-[12px] text-gray-400 font-mono">
                        Received: {selectedNotification.time}
                      </p>
                    </div>

                    {/* Conditional rendering based on Type */}
                    {selectedNotification.type === "transaction" ? (
                      /* High-fidelity Receipt Style details for transactions */
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                        <div className="text-center border-b border-dashed border-gray-200 pb-4">
                          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">Transaction Amount</p>
                          <h2 className="text-3xl font-display-lg text-[#0b513d] font-bold mt-1">₦25,000.00</h2>
                        </div>
                        <div className="space-y-3 pt-2 text-sm font-hanken">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Payment Channel</span>
                            <span className="text-black font-semibold">Opay Wallet</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Recipient Alias</span>
                            <span className="text-black font-semibold">STEVE</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Status</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                              SUCCESSFUL
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Transaction Fee</span>
                            <span className="text-black font-semibold">₦0.00</span>
                          </div>
                          <div className="flex justify-between border-t border-gray-100 pt-3">
                            <span className="text-gray-400">Reference ID</span>
                            <span className="text-black font-mono text-xs">TXN-589210-ETG</span>
                          </div>
                        </div>
                      </div>
                    ) : selectedNotification.type === "security" ? (
                      /* Detailed Access Log information for Security type alerts */
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4">
                        <div className="text-center border-b border-dashed border-gray-200 pb-4">
                          <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">Security Status</p>
                          <h2 className="text-2xl font-hanken text-black font-bold mt-1">LOG SECURED</h2>
                        </div>
                        <div className="space-y-3 pt-2 text-sm font-hanken">
                          <div className="flex justify-between">
                            <span className="text-gray-400">Device Platform</span>
                            <span className="text-black font-semibold">iPhone 15 Pro</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Location origin</span>
                            <span className="text-black font-semibold">Lagos, Nigeria</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">IP Address</span>
                            <span className="text-black font-mono text-xs">102.89.44.12</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-400">Security Check</span>
                            <span className="text-emerald-600 font-bold flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]" style={{ fontVariationSettings: '"FILL" 1' }}>verified_user</span>
                              PIN VERIFIED
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Promotional Detail Layout */
                      <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100 space-y-4 text-center">
                        <p className="text-[11px] text-gray-400 uppercase tracking-widest font-bold">Infinite Exclusive Pass</p>
                        <h2 className="text-2xl font-display-lg text-[#d4af37] font-bold">ZUMA LOUNGE 15% OFF</h2>
                        <p className="font-hanken text-sm text-gray-500 max-w-[280px] mx-auto leading-relaxed pt-2 border-t border-dashed border-gray-200">
                          To redeem, present your E-Tech Infinite diamond digital status card at check-in or checkout. Use promo reference code below.
                        </p>
                        <div className="bg-white border border-[#d4af37]/30 py-3 px-4 rounded-xl inline-block mt-4">
                          <span className="font-mono font-bold text-black tracking-widest text-lg">ETGINFINITE15</span>
                        </div>
                      </div>
                    )}

                    <div className="mt-8 flex flex-col gap-3">
                      <button
                        type="button"
                        onClick={() => setSelectedNotification(null)}
                        className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                      >
                        Acknowledge Alert
                      </button>
                    </div>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
