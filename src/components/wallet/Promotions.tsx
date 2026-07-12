"use client";

import React from "react";
import Image from "next/image";

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

      <div className="glass-card rounded-xl overflow-hidden flex items-stretch">
        <div className="w-1/3 bg-primary/10 flex items-center justify-center p-2.5 min-[360px]:p-4 relative min-h-[100px] min-[360px]:min-h-[120px]">
          <Image
            className="object-contain p-1 min-[360px]:p-2"
            alt="Promotion"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNmoQdHf_LOnaESXDKs_lPVyHSr4cGL5iwDTF0q3EOJYY9ItnlfnVB4xBRjqjAMq8OQOLtoRcsGnjPhGVGZSVgZZkKpkqYKai9oRq7L3osqKkYw8eYL3xom-MS9incdrS5PoJ3Fmdiyzfs4HCi9m3kVKMxD-VR9otIje3YP7rOjktpTQFKizNrlj0Q8Oy_uWdtULcK0xXFGju12ywxb8osmIe7PGkpZYf-lCcCJq_HoF-xMORcBpRRYs1l6DUVD47HevFJwdf39Lk"
            fill
            sizes="(max-width: 768px) 33vw, 200px"
          />
        </div>
        <div className="w-2/3 p-2.5 min-[360px]:p-4 flex flex-col justify-between min-w-0">
          <div>
            <h4 className="font-headline-md text-[14px] min-[360px]:text-[18px] text-primary mb-0.5 min-[360px]:mb-1 truncate font-bold">
              Get Your Vouchers
            </h4>
            <p className="font-body-md text-[10px] min-[360px]:text-label-sm text-on-surface-variant/70 leading-relaxed line-clamp-2">
              Exclusive access to premium partner rewards and dining credits.
            </p>
          </div>
          <div className="flex justify-between items-center mt-2 min-[360px]:mt-4 gap-2">
            <span className="font-label-sm text-[8px] min-[360px]:text-[10px] text-on-surface-variant/50 font-bold truncate">
              Exp: Mar 24, 2024
            </span>
            <button className="bg-primary text-surface-dim font-label-sm text-[10px] min-[360px]:text-label-sm px-2.5 min-[360px]:px-4 py-1 min-[360px]:py-1.5 rounded-full hover:bg-primary-fixed-dim transition-colors flex-shrink-0 font-bold cursor-pointer">
              Redeem
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-3.5 min-[360px]:p-4 min-[390px]:p-5 border-l-4 border-secondary">
        <div className="flex items-start gap-2.5 min-[360px]:gap-4">
          <div className="w-9 h-9 min-[360px]:w-11 min-[360px]:h-11 min-[390px]:w-12 min-[390px]:h-12 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary text-[18px] min-[360px]:text-[22px] min-[390px]:text-xl">
              campaign
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-headline-md text-[14px] min-[360px]:text-[18px] text-secondary mb-0.5 min-[360px]:mb-1 font-bold truncate">
              Cash up for grabs!
            </h4>
            <p className="font-body-md text-[10px] min-[360px]:text-label-sm text-on-surface-variant/70 mb-2 min-[360px]:mb-3 leading-relaxed line-clamp-2">
              Invite fellow captains to the fleet and earn #3,000 for each
              successful boarding.
            </p>
            <button className="text-secondary font-label-sm text-[10px] min-[360px]:text-label-sm flex items-center gap-1 hover:gap-2 transition-all font-bold cursor-pointer">
              Refer Friends Now
              <span className="material-symbols-outlined text-sm">
                arrow_forward
              </span>
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
