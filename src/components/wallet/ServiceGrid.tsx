"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import Link from "next/link";
import { toast } from "sonner";

const primaryActions = [
  { icon: "account_balance_wallet", label: "To Opay" },
  { icon: "account_balance", label: "To Bank" },
  { icon: "outbox", label: "Withdraw" },
];

const services = [
  { icon: "cell_tower", label: "Airtime", color: "text-secondary", href: "/bills?type=airtime" },
  { icon: "swap_vert", label: "Data", color: "text-secondary", href: "/bills?type=data" },
  { icon: "sports_basketball", label: "Betting", color: "text-secondary", href: "/bills?type=betting" },
  { icon: "tv", label: "TV", color: "text-secondary", href: "/bills?type=cable" },
  { icon: "credit_card", label: "Cards", color: "text-primary", href: "/cards", fill: true },
  { icon: "real_estate_agent", label: "Loan", color: "text-primary", href: "#" },
  { icon: "diamond", label: "Wealth", color: "text-primary", href: "#" },
  { icon: "apps", label: "More", color: "text-primary", href: "#" },
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
  const handlePrimaryClick = (label: string) => {
    toast.info(`${label} action initiated. Secure payment rails are loading...`);
  };

  const handleServiceClick = (service: typeof services[0]) => {
    if (service.href === "#") {
      toast.info(`E-Tech Concierge: ${service.label} utility is being optimized. It will be active shortly!`);
    }
  };

  return (
    <section className="grid grid-cols-4 gap-3 min-[360px]:gap-4 mb-stack-lg">
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="col-span-4 grid grid-cols-3 gap-2 min-[360px]:gap-3 mb-1 min-[360px]:mb-2"
      >
        {primaryActions.map((action) => (
          <motion.div
            key={action.label}
            variants={item}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePrimaryClick(action.label)}
            className="glass-card rounded-xl p-2.5 min-[360px]:p-3.5 min-[390px]:p-4 flex flex-col items-center justify-center gap-1.5 min-[360px]:gap-2 cursor-pointer group min-w-0"
          >
            <div className="w-9 h-9 min-[360px]:w-11 min-[360px]:h-11 min-[390px]:w-12 min-[390px]:h-12 rounded-full bg-surface-variant flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-surface-dim transition-colors flex-shrink-0">
              <span className="material-symbols-outlined text-[18px] min-[360px]:text-[22px] min-[390px]:text-[24px]">{action.icon}</span>
            </div>
            <span className="font-label-sm text-[10px] min-[360px]:text-[11px] min-[390px]:text-xs text-on-surface-variant font-bold truncate w-full text-center">
              {action.label}
            </span>
          </motion.div>
        ))}
      </motion.div>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="col-span-4 grid grid-cols-4 gap-1 min-[360px]:gap-2"
      >
        {services.map((service) => {
          const isLink = service.href !== "#";
          const content = (
            <div className="flex flex-col items-center gap-1 min-[360px]:gap-1.5 py-1.5 min-[360px]:py-2.5 min-w-0 w-full">
              <div className="p-2 min-[360px]:p-2.5 min-[390px]:p-3 bg-surface-container rounded-lg border border-white/5 flex items-center justify-center flex-shrink-0">
                <span
                  className={cn("material-symbols-outlined text-[16px] min-[360px]:text-[18px] min-[390px]:text-xl", service.color)}
                  style={service.fill ? { fontVariationSettings: '"FILL" 1' } : {}}
                >
                  {service.icon}
                </span>
              </div>
              <span className="font-label-sm text-[9px] min-[360px]:text-[10px] min-[390px]:text-xs text-on-surface-variant/80 truncate w-full text-center">
                {service.label}
              </span>
            </div>
          );

          if (isLink) {
            return (
              <Link href={service.href} key={service.label} className="w-full flex justify-center">
                <motion.button
                  variants={item}
                  whileTap={{ scale: 0.9 }}
                  className="w-full flex flex-col items-center cursor-pointer"
                >
                  {content}
                </motion.button>
              </Link>
            );
          }

          return (
            <motion.button
              key={service.label}
              variants={item}
              whileTap={{ scale: 0.9 }}
              onClick={() => handleServiceClick(service)}
              className="flex flex-col items-center cursor-pointer w-full"
            >
              {content}
            </motion.button>
          );
        })}
      </motion.div>
    </section>
  );
};
