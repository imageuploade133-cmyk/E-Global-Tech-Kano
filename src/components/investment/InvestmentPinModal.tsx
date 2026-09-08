"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface InvestmentPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  isSubmitting: boolean;
  onPinSubmit: (pin: string) => void;
}

export function InvestmentPinModal({
  isOpen,
  onClose,
  title = "Authorize Transaction",
  description = "Enter your 4-digit transaction PIN to proceed.",
  isSubmitting,
  onPinSubmit,
}: InvestmentPinModalProps) {
  const [pin, setPin] = useState("");

  useModalBackHandler(isOpen, onClose, "investment-pin-modal");

  useEffect(() => {
    if (isOpen) {
      setPin("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (num: string) => {
    if (isSubmitting) return;
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        onPinSubmit(nextPin);
      }
    }
  };

  const handleClear = () => {
    if (isSubmitting) return;
    setPin("");
  };

  const handleBackspace = () => {
    if (isSubmitting) return;
    setPin((prev) => prev.slice(0, -1));
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm">
        <div className="absolute inset-0" onClick={() => !isSubmitting && onClose()} />

        <motion.div
          initial={{ y: "100%" }}
          animate={{ y: 0 }}
          exit={{ y: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative bg-white w-full max-w-md rounded-t-[32px] p-6 shadow-2xl border-t border-gray-100 z-10 select-none"
        >
          <div className="w-12 h-1 bg-gray-200 rounded-full mx-auto mb-5" />

          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center mb-2 text-primary">
              <span className="material-symbols-outlined text-[24px]">lock</span>
            </div>
            <h3 className="font-bodoni text-[18px] font-bold text-black">{title}</h3>
            <p className="font-hanken text-[11px] text-gray-500 max-w-[260px] mt-0.5 font-semibold leading-relaxed">
              {description}
            </p>
          </div>

          {/* PIN Indicator Dots */}
          <div className="flex justify-center gap-3 mb-6">
            {[0, 1, 2, 3].map((idx) => (
              <div
                key={idx}
                className={`w-12 h-12 rounded-2xl border flex items-center justify-center text-lg font-extrabold font-mono transition-all ${
                  pin.length > idx
                    ? "border-primary bg-primary/10 text-primary shadow-sm"
                    : "border-gray-200 bg-gray-50 text-gray-300"
                }`}
              >
                {pin.length > idx ? "•" : ""}
              </div>
            ))}
          </div>

          {/* Keypad */}
          <div className="max-w-xs mx-auto grid grid-cols-3 gap-3 mb-4">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
              <button
                key={num}
                type="button"
                disabled={isSubmitting}
                onClick={() => handleKeyPress(num)}
                className="h-12 rounded-2xl bg-gray-50 border border-gray-100 font-hanken text-lg font-bold text-black active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
              >
                {num}
              </button>
            ))}
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleClear}
              className="h-12 rounded-2xl bg-gray-50 border border-gray-100 font-hanken text-xs font-bold text-gray-500 active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              CLEAR
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleKeyPress("0")}
              className="h-12 rounded-2xl bg-gray-50 border border-gray-100 font-hanken text-lg font-bold text-black active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              0
            </button>
            <button
              type="button"
              disabled={isSubmitting}
              onClick={handleBackspace}
              className="h-12 rounded-2xl bg-gray-50 border border-gray-100 font-hanken text-gray-500 active:bg-gray-200 active:scale-95 transition-all flex items-center justify-center cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">backspace</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={onClose}
            className="w-full py-3 border border-gray-200 text-gray-500 hover:text-black rounded-xl font-hanken text-[12px] font-bold tracking-wide active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
