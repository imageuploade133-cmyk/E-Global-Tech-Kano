"use client";

import React from "react";
import { motion } from "framer-motion";
import { AppLogo } from "@/components/AppLogo";
import { useAppConfig } from "@/lib/ConfigContext";

interface PullToRefreshOverlayProps {
  pullDistance: number;
  isRefreshing: boolean;
}

export const PullToRefreshOverlay: React.FC<PullToRefreshOverlayProps> = ({
  pullDistance,
  isRefreshing,
}) => {
  const { config } = useAppConfig();
  const isThresholdReached = pullDistance >= 50;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-200 pointer-events-none select-none"
      style={{
        top: `${Math.min(110, 56 + pullDistance * 0.85)}px`,
        opacity: pullDistance > 12 || isRefreshing ? 1 : 0,
        transform: `translateX(-50%) scale(${
          isRefreshing
            ? 1
            : Math.min(1.1, 0.7 + (pullDistance / 60) * 0.4)
        })`,
      }}
    >
      <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3.5 py-2 rounded-full border border-gray-150 shadow-[0_6px_20px_rgba(0,0,0,0.12)]">
        {/* Native App Logo Spinner Icon */}
        <div className="relative w-6 h-6 flex items-center justify-center flex-shrink-0">
          <motion.div
            animate={
              isRefreshing
                ? { rotate: 360, scale: [1, 1.08, 1] }
                : { rotate: pullDistance * 6, scale: isThresholdReached ? 1.15 : 1 }
            }
            transition={
              isRefreshing
                ? {
                    rotate: { repeat: Infinity, duration: 1.1, ease: "linear" },
                    scale: { repeat: Infinity, duration: 1.1, ease: "easeInOut" },
                  }
                : { duration: 0 }
            }
            className="w-6 h-6 flex items-center justify-center"
          >
            <AppLogo logoUrl={config?.logoUrl} size={22} />
          </motion.div>
        </div>

        <span
          className={`font-hanken text-[10px] font-black uppercase tracking-wider select-none transition-colors ${
            isRefreshing || isThresholdReached ? "text-[#FC7A00]" : "text-gray-500"
          }`}
        >
          {isRefreshing
            ? "Syncing..."
            : isThresholdReached
            ? "Release to Sync"
            : "Pull to Refresh"}
        </span>
      </div>
    </div>
  );
};
