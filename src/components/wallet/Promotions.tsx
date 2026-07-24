"use client";

import React from "react";

export const Promotions: React.FC = () => {
  return (
    <section className="space-y-3 min-[360px]:space-y-4 mb-stack-xl">
      <div className="flex justify-between items-end">
        <h3 className="font-headline-md text-[18px] min-[360px]:text-[24px] text-on-surface font-bold">
          Privileges
        </h3>
        <a className="font-label-sm text-[11px] min-[360px]:text-label-sm text-primary font-bold" href="#">
          View All
        </a>
      </div>

      <div className="glass-card rounded-xl p-4 min-[360px]:p-5 border-l-4 border-primary relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start gap-3.5 min-[360px]:gap-4 relative z-10">
          <div className="w-10 h-10 min-[360px]:w-12 min-[360px]:h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-primary text-[20px] min-[360px]:text-[24px] font-bold">
              group_add
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-primary/20 text-primary text-[9px] min-[360px]:text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Special Offer
              </span>
              <span className="text-on-surface-variant/50 text-[9px] min-[360px]:text-[10px] font-bold">
                Limited Time
              </span>
            </div>

            <h4 className="font-headline-md text-[15px] min-[360px]:text-[18px] text-on-surface mb-1 font-bold leading-tight">
              Create 10 Accounts & Get Funded
            </h4>
            <p className="font-body-md text-[11px] min-[360px]:text-label-sm text-on-surface-variant/80 mb-3.5 leading-relaxed">
              Create 10 accounts for users and get funded. You will receive <span className="text-primary font-bold">₦5,000 Naira</span> directly credited to your wallet balance.
            </p>

            <button className="bg-primary text-surface-dim font-label-sm text-[10px] min-[360px]:text-label-sm px-4 py-1.5 min-[360px]:py-2 rounded-full hover:bg-primary/90 transition-all flex items-center gap-1.5 font-bold cursor-pointer shadow-md shadow-primary/10">
              <span>Get Started</span>
              <span className="material-symbols-outlined text-xs font-bold">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
