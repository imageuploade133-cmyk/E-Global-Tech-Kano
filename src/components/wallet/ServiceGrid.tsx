"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

const primaryActions = [
  { icon: "account_balance_wallet", label: "To Opay" },
  { icon: "account_balance", label: "To Bank" },
  { icon: "outbox", label: "Withdraw" },
];

const services = [
  { icon: "cell_tower", label: "Airtime", color: "text-secondary" },
  { icon: "swap_vert", label: "Data", color: "text-secondary" },
  { icon: "sports_basketball", label: "Betting", color: "text-secondary" },
  { icon: "tv", label: "TV", color: "text-secondary" },
  { icon: "diamond", label: "Wealth", color: "text-primary", fill: true },
  { icon: "real_estate_agent", label: "Loan", color: "text-primary" },
  { icon: "volunteer_activism", label: "Impact", color: "text-primary" },
  { icon: "apps", label: "More", color: "text-primary" },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0 }
};

export const ServiceGrid: React.FC = () => {
  return (
    <section className="grid grid-cols-4 gap-4 mb-stack-lg">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="col-span-4 grid grid-cols-3 gap-3 mb-2"
      >
        {primaryActions.map((action) => (
          <motion.div
            key={action.label}
            variants={item}
            whileTap={{ scale: 0.95 }}
            className="glass-card rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer group"
          >
            <div className="w-12 h-12 rounded-full bg-surface-variant flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-surface-dim transition-colors">
              <span className="material-symbols-outlined">{action.icon}</span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
              {action.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="col-span-4 grid grid-cols-4 gap-2"
      >
        {services.map((service) => (
          <motion.button
            key={service.label}
            variants={item}
            whileTap={{ scale: 0.9 }}
            className="flex flex-col items-center gap-2 py-3 active:opacity-60 transition-opacity"
          >
            <div className="p-3 bg-surface-container rounded-lg border border-white/5">
              <span
                className={cn("material-symbols-outlined text-xl", service.color)}
                style={service.fill ? { fontVariationSettings: '"FILL" 1' } : {}}
              >
                {service.icon}
              </span>
            </div>
            <span className="font-label-sm text-label-sm text-on-surface-variant/80">
              {service.label}
            </span>
          </motion.button>
        ))}
      </motion.div>
    </section>
  );
};
