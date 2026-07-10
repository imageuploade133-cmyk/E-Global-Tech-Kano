"use client";

import React, { useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo, useAnimation } from "framer-motion";

interface LogoutDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const LogoutDrawer: React.FC<LogoutDrawerProps> = ({ isOpen, onClose, onConfirm }) => {
  const controls = useAnimation();
  const hasPushedState = useRef(false);

  // Sync state with browser back history (device physical/swipe back button support)
  useEffect(() => {
    if (isOpen) {
      // Push state to history so back button closes drawer instead of leaving page
      window.history.pushState({ drawerOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        onClose();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        // If drawer is closed through click (not back button), pop the state we pushed
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [isOpen, onClose]);

  // Handle drag to dismiss gesture
  const handleDragEnd = async (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    } else {
      controls.start({ y: 0 });
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Blur/Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 pointer-events-auto"
          />

          {/* Bottom Drawer Sheet */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 220 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 400 }}
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] border-t border-gray-100 p-6 pb-10 z-50 flex flex-col items-center select-none cursor-default shadow-none touch-none"
          >
            {/* Draggable indicator bar */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-6 cursor-grab active:cursor-grabbing" />

            <div className="w-16 h-16 rounded-full bg-[#dc3545]/10 flex items-center justify-center text-[#dc3545] mb-4">
              <span className="material-symbols-outlined text-[32px]">logout</span>
            </div>

            <h2 className="font-hanken font-bold text-xl text-black text-center mb-2">
              Confirm Sign Out
            </h2>
            <p className="font-hanken text-sm text-gray-500 text-center max-w-[280px] mb-8 leading-relaxed">
              Are you sure you want to log out of your secure E-Tech account? You will need your login details and PIN to gain access again.
            </p>

            <div className="flex flex-col gap-3 w-full">
              <button
                type="button"
                onClick={onConfirm}
                className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none"
              >
                Log Out
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
