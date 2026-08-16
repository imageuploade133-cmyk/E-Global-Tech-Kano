"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";

interface StoreHeaderProps {
  logoUrl?: string;
  totalCartItems: number;
  onOpenCart: () => void;
  onOpenOrders: () => void;
}

export const StoreHeader: React.FC<StoreHeaderProps> = ({
  logoUrl,
  totalCartItems,
  onOpenCart,
  onOpenOrders,
}) => {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile py-2.5 min-[375px]:py-3 bg-[#111827] text-white shadow-md border-b border-orange-500/20">
      {/* Left: Home Return + Store Branding */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0 mr-2">
        <Link
          href="/"
          className="w-9 h-9 rounded-full border border-gray-700 bg-gray-800 flex items-center justify-center text-gray-200 hover:text-white hover:border-[#FC7A00] active:scale-90 transition-all flex-shrink-0"
          title="Return to Main App"
        >
          <span className="material-symbols-outlined text-[20px]">home</span>
        </Link>

        <div className="relative w-8 h-8 flex-shrink-0 bg-black/40 border border-orange-500/30 rounded-xl p-0.5 overflow-hidden">
          <Image
            src={logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
            alt="E-Tech Store"
            fill
            sizes="32px"
            className="object-contain"
            priority
          />
        </div>

        <div className="flex-1 min-w-0">
          <h1 className="font-bodoni text-[15px] min-[375px]:text-[17px] font-black tracking-tight text-[#FC7A00] leading-tight truncate">
            E-TECH STORE
          </h1>
          <p className="font-hanken text-[9px] min-[375px]:text-[10px] text-gray-300 font-bold uppercase tracking-wider truncate">
            Boutique & Hardware Hub
          </p>
        </div>
      </div>

      {/* Right: Orders + Support + Cart */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          type="button"
          onClick={onOpenOrders}
          className="px-2.5 py-1.5 rounded-full border border-gray-700 bg-gray-800/90 text-gray-200 hover:text-white hover:border-[#FC7A00] active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
          title="My Orders"
        >
          <span className="material-symbols-outlined text-[17px] text-[#FC7A00]">receipt_long</span>
          <span className="text-[10px] font-black uppercase tracking-wider hidden sm:inline">Orders</span>
        </button>

        <Link
          href="/support"
          className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full border border-gray-700 bg-gray-800/90 flex items-center justify-center text-gray-200 hover:text-white hover:border-[#FC7A00] active:scale-90 transition-all cursor-pointer"
          title="Store VIP Support"
        >
          <span className="material-symbols-outlined text-[19px]">support_agent</span>
        </Link>

        <button
          type="button"
          onClick={onOpenCart}
          className="relative w-9 h-9 rounded-full bg-gradient-to-r from-[#FC7A00] to-orange-600 text-white flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-sm"
          title="Shopping Cart"
        >
          <span className="material-symbols-outlined text-[20px]">shopping_bag</span>
          {totalCartItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-black text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
              {totalCartItems}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
