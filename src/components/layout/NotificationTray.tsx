"use client";

import React from "react";
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
}

export const NotificationTray: React.FC<NotificationTrayProps> = ({
  isOpen,
  onClose,
  notifications,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 h-full w-[85%] max-w-md bg-surface-dim border-l border-white/5 z-[101] shadow-2xl flex flex-col"
          >
            <div className="p-6 border-b border-white/5 flex justify-between items-center bg-surface-container-low">
              <div>
                <h2 className="font-headline-md text-[20px] text-primary font-bold">
                  Notifications
                </h2>
                <p className="text-on-surface-variant/60 text-[12px]">
                  Stay updated with your fleet
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant hover:text-primary transition-colors"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="flex-grow overflow-y-auto custom-scrollbar p-4 space-y-4">
              {notifications.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="w-16 h-16 rounded-full bg-surface-variant flex items-center justify-center mb-4 text-primary/40">
                    <span className="material-symbols-outlined text-[32px]">
                      notifications_off
                    </span>
                  </div>
                  <p className="text-on-surface font-bold">All clear!</p>
                  <p className="text-on-surface-variant/60 text-sm">
                    No new alerts at the moment.
                  </p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    key={n.id}
                    className={cn(
                      "p-4 rounded-2xl border transition-all",
                      n.read
                        ? "bg-surface-container-low border-white/5"
                        : "bg-surface-container border-primary/20 shadow-lg"
                    )}
                  >
                    <div className="flex gap-4">
                      <div
                        className={cn(
                          "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                          n.type === "transaction"
                            ? "bg-secondary/10 text-secondary"
                            : n.type === "security"
                            ? "bg-error-container/20 text-error"
                            : "bg-primary/10 text-primary"
                        )}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {n.type === "transaction"
                            ? "payments"
                            : n.type === "security"
                            ? "shield"
                            : "campaign"}
                        </span>
                      </div>
                      <div className="flex-grow">
                        <div className="flex justify-between items-start mb-1">
                          <h4 className="font-bold text-on-surface text-[14px]">
                            {n.title}
                          </h4>
                          <span className="text-[10px] text-on-surface-variant/40 font-mono">
                            {n.time}
                          </span>
                        </div>
                        <p className="text-on-surface-variant/70 text-[12px] leading-relaxed">
                          {n.message}
                        </p>
                        {!n.read && (
                          <div className="mt-2 flex items-center gap-1">
                            <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                            <span className="text-[10px] text-primary font-bold uppercase tracking-widest">
                              New
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/5 bg-surface-container-low">
                <button className="w-full py-3 bg-surface-variant hover:bg-surface-bright rounded-xl text-primary text-[12px] font-bold uppercase tracking-widest transition-colors">
                    Mark All as Read
                </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
