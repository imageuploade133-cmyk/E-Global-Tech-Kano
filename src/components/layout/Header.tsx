"use client";

import React from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  userName: string;
  profileImage: string;
}

export const Header: React.FC<HeaderProps> = ({ userName, profileImage }) => {
  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile py-4 bg-surface-dim/80 backdrop-blur-xl shadow-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden scale-95 active:scale-90 transition-transform">
          <img
            className="w-full h-full object-cover"
            alt="Profile"
            src={profileImage}
          />
        </div>
        <div>
          <p className="font-label-sm text-[12px] text-on-surface-variant uppercase tracking-tighter font-bold">
            Welcome back
          </p>
          <h1 className="font-headline-md text-[24px] tracking-widest text-primary font-bold">
            Hi, {userName}
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button className="text-primary hover:opacity-80 transition-opacity">
          <span className="material-symbols-outlined">notifications_active</span>
        </button>
      </div>
    </header>
  );
};
