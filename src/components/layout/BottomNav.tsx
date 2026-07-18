"use client";

import React from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { icon: "account_balance_wallet", label: "Wealth", href: "/" },
  { icon: "credit_card", label: "Cards", href: "/cards" },
  { icon: "history", label: "History", href: "/history" },
  { icon: "storefront", label: "Store", href: "/bills?type=data" },
  { icon: "trending_up", label: "Investment", href: "/investment" },
  { icon: "person", label: "Profile", href: "/profile" },
];

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 w-full z-50 flex justify-around items-center px-0.5 pb-3.5 min-[360px]:pb-5.5 pt-2 bg-surface-container-highest/90 backdrop-blur-2xl border-t border-white/10 shadow-[0_-4px_20px_rgba(252,122,0,0.08)] rounded-t-[20px] min-[360px]:rounded-t-[28px]">
      {navItems.map((item) => {
        const isActive = pathname === item.href || (item.href.startsWith("/bills") && pathname === "/bills");
        return (
          <Link
            key={item.label}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center transition-all duration-300 active:scale-95 cursor-pointer flex-1 min-w-0 px-0.5",
              isActive
                ? "text-primary font-bold animate-pulse-subtle"
                : "text-on-surface-variant/60 hover:text-primary/80"
            )}
          >
            <span
              className="material-symbols-outlined text-[15px] min-[360px]:text-[19px] min-[400px]:text-[22px]"
              style={isActive ? { fontVariationSettings: '"FILL" 1' } : {}}
            >
              {item.icon}
            </span>
            <span className="font-label-sm text-[7.5px] min-[360px]:text-[9px] min-[400px]:text-[10px] truncate w-full text-center mt-0.5 tracking-tight font-medium">
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
};
