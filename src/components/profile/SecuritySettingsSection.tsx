"use client";

import React from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface SecuritySettingsSectionProps {
  isPinRequired: boolean;
  isFaceIdEnabled: boolean;
  onTogglePinRequired: () => Promise<void>;
  onToggleFaceId: () => Promise<void>;
}

export function SecuritySettingsSection({
  isPinRequired,
  isFaceIdEnabled,
  onTogglePinRequired,
  onToggleFaceId,
}: SecuritySettingsSectionProps) {
  return (
    <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
      <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
        Security Settings
      </h3>

      {/* Toggle PIN */}
      <div className="flex justify-between items-center py-2">
        <div>
          <p className="font-hanken font-bold text-xs text-black">Require PIN Access</p>
          <p className="font-hanken text-[10px] text-gray-400">Enforce PIN check on login/payment flows</p>
        </div>
        <button
          onClick={onTogglePinRequired}
          className={cn(
            "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
            isPinRequired ? "bg-[#07B038]" : "bg-gray-200"
          )}
        >
          <motion.div
            layout
            className="w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: isPinRequired ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Toggle FaceID */}
      <div className="flex justify-between items-center py-2">
        <div>
          <p className="font-hanken font-bold text-xs text-black">Simulate FaceID Biometrics</p>
          <p className="font-hanken text-[10px] text-gray-400">Quick authentication via FaceID simulations</p>
        </div>
        <button
          onClick={onToggleFaceId}
          className={cn(
            "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
            isFaceIdEnabled ? "bg-[#07B038]" : "bg-gray-200"
          )}
        >
          <motion.div
            layout
            className="w-5 h-5 bg-white rounded-full shadow-md"
            animate={{ x: isFaceIdEnabled ? 24 : 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </button>
      </div>
    </section>
  );
}
