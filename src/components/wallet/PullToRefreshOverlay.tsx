"use client";

import React from "react";
import { motion } from "framer-motion";

interface PullToRefreshOverlayProps {
  pullDistance: number;
  isRefreshing: boolean;
}

export const PullToRefreshOverlay: React.FC<PullToRefreshOverlayProps> = ({
  pullDistance,
  isRefreshing,
}) => {
  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[100] transition-all duration-300 pointer-events-none"
      style={{
        top: `${Math.min(100, 64 + pullDistance)}px`,
        opacity: pullDistance > 10 || isRefreshing ? 1 : 0,
        scale: pullDistance > 10 || isRefreshing ? 1 : 0.85,
      }}
    >
      <div className="flex items-center gap-2 bg-white px-3.5 py-2 rounded-full border border-gray-150 shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
        <div className="relative w-5 h-5 flex items-center justify-center flex-shrink-0">
          <motion.div
            animate={isRefreshing ? { rotate: 360 } : { rotate: pullDistance * 4.5 }}
            transition={isRefreshing ? { repeat: Infinity, duration: 0.8, ease: "linear" } : { duration: 0 }}
            className="w-4.5 h-4.5 rounded-full border-2 border-gray-200 border-t-[#FC7A00] border-r-[#0b513d] flex items-center justify-center"
          />
        </div>
        <span className="font-hanken text-[10px] font-black uppercase tracking-wider text-gray-500 select-none">
          {isRefreshing ? "Refreshing..." : "Pull to Refresh"}
        </span>
      </div>
    </div>
  );
};
