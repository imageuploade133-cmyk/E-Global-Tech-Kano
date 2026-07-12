"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "account_balance_wallet", label: "Wealth", href: "/" },
  { icon: "credit_card", label: "Cards", href: "/cards" },
  { icon: "history", label: "History", href: "/history" },
  { icon: "support_agent", label: "Concierge", href: "/support" },
  { icon: "person", label: "Profile", href: "/profile" },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-1 pb-4 min-[360px]:pb-6 pt-2.5 min-[360px]:pt-3 bg-surface-container-highest/90 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_20px_rgba(212,175,55,0.1)] rounded-t-[24px] min-[360px]:rounded-t-[32px]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer flex-1 min-w-0",
              isActive
                ? "text-primary font-bold"
                : "text-on-surface-variant/60 hover:text-primary/80"
            )}
          >
            <span
              className="material-symbols-outlined text-[18px] min-[360px]:text-[22px]"
              style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
            >
              {item.icon}
            </span>
            <span className="font-label-sm text-[9px] min-[360px]:text-[11px] truncate w-full text-center">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
