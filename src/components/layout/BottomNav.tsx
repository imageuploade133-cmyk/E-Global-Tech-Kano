"use client";

import React from "react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: "account_balance_wallet", label: "Wealth", active: true },
  { icon: "query_stats", label: "Markets" },
  { icon: "support_agent", label: "Concierge" },
  { icon: "lock", label: "Vault" },
];

export const BottomNav: React.FC = () => {
  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-surface-container-highest/90 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_20px_rgba(212,175,55,0.1)] rounded-t-[32px]">
      {navItems.map((item) => (
        <a
          key={item.label}
          className={cn(
            "flex flex-col items-center justify-center transition-all duration-300 active:scale-95",
            item.active
              ? "text-primary font-bold"
              : "text-on-surface-variant/60 hover:text-primary/80"
          )}
          href="#"
        >
          <span
            className="material-symbols-outlined"
            style={item.active ? { fontVariationSettings: '"FILL" 1' } : {}}
          >
            {item.icon}
          </span>
          <span className="font-label-sm text-[12px]">{item.label}</span>
        </a>
      ))}
    </nav>
  );
};
