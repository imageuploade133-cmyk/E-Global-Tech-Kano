"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "account_balance_wallet", label: "Wealth", href: "/" },
  { icon: "query_stats", label: "Markets", href: "#" },
  { icon: "support_agent", label: "Concierge", href: "#" },
  { icon: "person", label: "Profile", href: "/profile" },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-4 pb-6 pt-3 bg-surface-container-highest/90 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_20px_rgba(212,175,55,0.1)] rounded-t-[32px]">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer",
              isActive
                ? "text-primary font-bold"
                : "text-on-surface-variant/60 hover:text-primary/80"
            )}
          >
            <span
              className="material-symbols-outlined"
              style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
            >
              {item.icon}
            </span>
            <span className="font-label-sm text-[12px]">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
};
