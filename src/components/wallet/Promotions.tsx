"use client";

import React from "react";
import { cn } from "@/lib/utils";

export const Promotions: React.FC = () => {
  return (
    <section className="space-y-4 mb-stack-xl">
      <div className="flex justify-between items-end">
        <h3 className="font-headline-md text-[24px] text-on-surface font-bold">
          Privileges
        </h3>
        <a className="font-label-sm text-label-sm text-primary" href="#">
          View All
        </a>
      </div>

      <div className="glass-card rounded-xl overflow-hidden flex items-stretch">
        <div className="w-1/3 bg-primary/10 flex items-center justify-center p-4">
          <img
            className="w-full h-full object-contain"
            alt="Promotion"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDNmoQdHf_LOnaESXDKs_lPVyHSr4cGL5iwDTF0q3EOJYY9ItnlfnVB4xBRjqjAMq8OQOLtoRcsGnjPhGVGZSVgZZkKpkqYKai9oRq7L3osqKkYw8eYL3xom-MS9incdrS5PoJ3Fmdiyzfs4HCi9m3kVKMxD-VR9otIje3YP7rOjktpTQFKizNrlj0Q8Oy_uWdtULcK0xXFGju12ywxb8osmIe7PGkpZYf-lCcCJq_HoF-xMORcBpRRYs1l6DUVD47HevFJwdf39Lk"
          />
        </div>
        <div className="w-2/3 p-4 flex flex-col justify-between">
          <div>
            <h4 className="font-headline-md text-[18px] text-primary mb-1">
              Get Your Vouchers
            </h4>
            <p className="font-body-md text-label-sm text-on-surface-variant/70">
              Exclusive access to premium partner rewards and dining credits.
            </p>
          </div>
          <div className="flex justify-between items-center mt-4">
            <span className="font-label-sm text-[10px] text-on-surface-variant/50 font-bold">
              Exp: Mar 24, 2024
            </span>
            <button className="bg-primary text-surface-dim font-label-sm text-label-sm px-4 py-1.5 rounded-full hover:bg-primary-fixed-dim transition-colors">
              Redeem
            </button>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-xl p-5 border-l-4 border-secondary">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary">
              campaign
            </span>
          </div>
          <div>
            <h4 className="font-headline-md text-[18px] text-secondary mb-1">
              Cash up for grabs!
            </h4>
            <p className="font-body-md text-label-sm text-on-surface-variant/70 mb-3">
              Invite fellow captains to the fleet and earn #3,000 for each
              successful boarding.
            </p>
            <button className="text-secondary font-label-sm text-label-sm flex items-center gap-1 hover:gap-2 transition-all">
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
