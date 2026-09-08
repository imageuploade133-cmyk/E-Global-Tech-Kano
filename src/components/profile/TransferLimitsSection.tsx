"use client";

import React from "react";
import { cn } from "@/lib/utils";

const LIMIT_CATEGORIES = [
  {
    id: "standard",
    label: "Standard",
    limit: 500000,
    description: "Standard daily limit",
    icon: "account_balance_wallet",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-[#FC7A00] bg-[#FC7A00]/5 text-black ring-1 ring-[#FC7A00]"
  },
  {
    id: "silver",
    label: "Silver Elite",
    limit: 2000000,
    description: "Higher transfer capacity",
    icon: "shield",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-[#0b513d] bg-[#0b513d]/5 text-black ring-1 ring-[#0b513d]"
  },
  {
    id: "gold",
    label: "Gold VIP",
    limit: 5000000,
    description: "Premium elite limit",
    icon: "workspace_premium",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-amber-500 bg-amber-500/5 text-black ring-1 ring-amber-500"
  },
  {
    id: "diamond",
    label: "Infinite Diamond",
    limit: 10000000,
    description: "Ultimate max capacity",
    icon: "diamond",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-emerald-500 bg-emerald-500/5 text-black ring-1 ring-emerald-500"
  }
];

interface TransferLimitsSectionProps {
  dailyLimit: number;
  onSelectLimitCategory: (limit: number) => Promise<void>;
}

export function TransferLimitsSection({
  dailyLimit,
  onSelectLimitCategory,
}: TransferLimitsSectionProps) {
  return (
    <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
      <div className="border-b border-gray-100/60 pb-2.5">
        <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500">
          Daily Transfer Limit Categories
        </h3>
        <p className="font-hanken text-[10px] text-gray-400 mt-0.5">Select a category to change your daily limit</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {LIMIT_CATEGORIES.map((cat) => {
          const isSelected = dailyLimit === cat.limit;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectLimitCategory(cat.limit)}
              className={cn(
                "p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all duration-300 cursor-pointer",
                isSelected ? cat.activeColor : cat.color + " hover:bg-gray-50 bg-white"
              )}
            >
              <div className="flex justify-between items-start w-full">
                <span className={cn(
                  "material-symbols-outlined text-[20px]",
                  isSelected ? "text-inherit" : "text-gray-400"
                )} style={isSelected && cat.id === "diamond" ? { fontVariationSettings: '"FILL" 1' } : {}}>
                  {cat.icon}
                </span>
                {isSelected && (
                  <span className="material-symbols-outlined text-[16px] text-emerald-500 font-bold">check_circle</span>
                )}
              </div>
              <div>
                <p className="font-hanken font-bold text-xs text-black">{cat.label}</p>
                <p className="font-hanken font-black text-sm text-black mt-0.5">
                  ₦{new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(cat.limit / 1000)}K
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
