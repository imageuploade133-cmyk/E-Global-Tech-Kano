"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
  const hasPushedState = useRef(false);

  // Sync state with browser back history (device physical/swipe back button support)
  useEffect(() => {
    if (isOpen) {
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
  }, [isOpen, onClose]);

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

  // Prevent background scrolling while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

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
              /* High-fidelity Skeleton Loading mimicking native production apps */
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
                    onClick={() => onToggleRead(n.id)}
                    className={cn(
                      "p-4 rounded-2xl border transition-all cursor-pointer select-none shadow-none relative overflow-hidden",
                      n.read
                        ? "bg-white border-gray-100 text-gray-500"
                        : "bg-white border-[#d4af37]/35 text-black"
                    )}
                  >
                    {/* Left Colored Stripe for Unread alerts */}
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

                      {/* Delete notification button upgraded with a gorgeous gray border circle */}
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
        </motion.div>
      )}
    </AnimatePresence>
  );
};
