"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export const OfflineDrawer: React.FC = () => {
  const [isOffline, setIsOffline] = useState(false);
  const [showGuides, setShowPermissionGuides] = useState(false);

  useEffect(() => {
    // Check initial state
    if (typeof window !== "undefined") {
      setIsOffline(!window.navigator.onLine);

      const handleOnline = () => {
        setIsOffline(false);
        toast.success("Connection restored! Synchronizing your wallet...");
      };

      const handleOffline = () => {
        setIsOffline(true);
        toast.error("You are currently offline. Check your connection.");
      };

      window.addEventListener("online", handleOnline);
      window.addEventListener("offline", handleOffline);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
      };
    }
  }, []);

  const handleManualCheck = () => {
    if (typeof window !== "undefined") {
      const isNowOnline = window.navigator.onLine;
      if (isNowOnline) {
        setIsOffline(false);
        toast.success("Wallet synchronized successfully!");
      } else {
        toast.error("Device is still offline. Please verify settings.");
      }
    }
  };

  const handleOpenSettings = () => {
    // Try standard system settings URLs for WebView/PWAs
    try {
      if (typeof window !== "undefined") {
        // Toggle instructions guide
        setShowPermissionGuides(prev => !prev);

        // Attempt to launch device wireless settings via standard app schemes
        window.location.href = "App-Prefs:root=WIFI";
      }
    } catch {
      // Suppress exceptions
    }
  };

  const handleReload = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  return (
    <AnimatePresence>
      {isOffline && (
        <>
          {/* Backdrop Blur Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-md z-[999999] pointer-events-auto"
          />

          {/* 95% Height Draggable Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 260, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[95dvh] p-6 pb-8 z-[1000000] flex flex-col items-center shadow-none select-none"
          >
            {/* Grab handle indicator */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-2 mb-4" />

            {/* Title Header */}
            <div className="w-full flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
              <div className="w-8" />
              <h3 className="font-hanken font-bold text-base text-black text-center">Network Interrupted</h3>
              <div className="w-8" />
            </div>

            {/* Offline Animated Illustration Body */}
            <div className="flex-grow flex flex-col justify-center items-center w-full px-6 text-center overflow-y-auto">
              <div className="relative mb-6">
                {/* Pulsing outer ring */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                  className="absolute -inset-4 rounded-full bg-[#FC7A00]/20"
                />
                <div className="w-20 h-20 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00]">
                  <span className="material-symbols-outlined text-[40px] font-bold animate-pulse">
                    signal_wifi_off
                  </span>
                </div>
              </div>

              <h4 className="font-hanken font-bold text-lg text-black mb-2">No Internet Connection</h4>
              <p className="font-hanken text-xs text-gray-500 max-w-[290px] leading-relaxed mb-6">
                Your device appears to be disconnected from cellular data or Wi-Fi, or you may have run out of active subscription data.
              </p>

              {/* Collapsible interactive guide card */}
              <AnimatePresence>
                {showGuides && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="w-full bg-gray-50 rounded-2xl p-4 text-left border border-gray-100 mb-6 overflow-hidden"
                  >
                    <p className="font-hanken font-bold text-xs text-black mb-2 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">info</span>
                      How to Reconnect
                    </p>
                    <ul className="space-y-1.5 font-hanken text-[11px] text-gray-500 list-disc list-inside">
                      <li>Open your device&apos;s pull-down status bar or system settings.</li>
                      <li>Check if Airplane Mode is disabled.</li>
                      <li>Toggle your Wi-Fi or Cellular Data network off and on.</li>
                      <li>Verify your mobile data subscription status or router power.</li>
                    </ul>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Interactive Control buttons */}
            <div className="w-full flex flex-col gap-3 mt-auto">
              <button
                type="button"
                onClick={handleOpenSettings}
                className="w-full py-4 bg-[#FC7A00] hover:bg-[#D46600] active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">settings</span>
                {showGuides ? "Hide Settings Guide" : "Configure Device Network"}
              </button>

              <div className="grid grid-cols-2 gap-3 w-full">
                <button
                  type="button"
                  onClick={handleManualCheck}
                  className="py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                >
                  Verify Status
                </button>
                <button
                  type="button"
                  onClick={handleReload}
                  className="py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                >
                  Reload App
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
