"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface StatementPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromDate: string;
  toDate: string;
  deliveryMethod: "download" | "email";
  onExecute: (pin: string) => Promise<void>;
}

export const StatementPinModal: React.FC<StatementPinModalProps> = ({
  isOpen,
  onClose,
  fromDate,
  toDate,
  deliveryMethod,
  onExecute,
}) => {
  const [pin, setPin] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  useModalBackHandler(isOpen, onClose, "statement-pin-modal");

  useEffect(() => {
    if (isOpen) {
      setPin("");
      setIsVerifying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = (numStr: string) => {
    if (isVerifying) return;
    if (pin.length < 4) {
      const newPin = pin + numStr;
      setPin(newPin);
      if (newPin.length === 4) {
        setIsVerifying(true);
        onExecute(newPin).finally(() => {
          setIsVerifying(false);
        });
      }
    }
  };

  const handleBackspace = () => {
    if (isVerifying) return;
    setPin((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    if (isVerifying) return;
    setPin("");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100005] bg-white flex flex-col justify-between overflow-hidden text-black">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          className="w-full h-full flex flex-col justify-between max-w-md mx-auto p-6 pb-8"
        >
          {/* Header Bar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00]">
                <span className="material-symbols-outlined text-[20px]">lock</span>
              </div>
              <div>
                <h3 className="font-hanken font-extrabold text-base text-black uppercase tracking-wide">
                  Authorize Statement
                </h3>
                <p className="font-hanken text-[9.5px] text-gray-400 font-bold uppercase tracking-widest">
                  Enter 4-Digit Security PIN
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors cursor-pointer border-0"
              title="Close"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          </div>

          {/* Center PIN Indicators */}
          <div className="text-center space-y-4 my-auto py-6">
            <div className="w-12 h-12 rounded-2xl bg-orange-50 border border-orange-200/80 text-[#FC7A00] flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">verified_user</span>
            </div>
            <div>
              <p className="font-hanken font-bold text-sm text-black">
                {deliveryMethod === "download" ? "Confirm PDF Download" : "Confirm Email Dispatch"}
              </p>
              <p className="font-hanken text-xs text-gray-500 mt-1">
                Statement Range: <strong>{fromDate}</strong> to <strong>{toDate}</strong>
              </p>
            </div>

            {/* 4 PIN Box Indicators */}
            <div className="flex justify-center gap-3 pt-2">
              {[0, 1, 2, 3].map((index) => (
                <div
                  key={index}
                  className={`w-12 h-12 rounded-2xl border-2 flex items-center justify-center text-xl font-bold transition-all ${
                    pin.length > index
                      ? "border-[#FC7A00] bg-orange-50/50 text-[#FC7A00] scale-105"
                      : "border-gray-200 bg-gray-50 text-gray-300"
                  }`}
                >
                  {pin.length > index ? "•" : ""}
                </div>
              ))}
            </div>
          </div>

          {/* Standardized Sequential Numeric Keypad Grid */}
          <div className="max-w-xs mx-auto w-full space-y-3">
            <div className="grid grid-cols-3 gap-3">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  type="button"
                  disabled={isVerifying}
                  onClick={() => handleKeyPress(num)}
                  className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-black font-hanken font-extrabold text-xl rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
                >
                  {num}
                </button>
              ))}

              <button
                type="button"
                disabled={isVerifying}
                onClick={handleClear}
                className="h-14 bg-red-50 hover:bg-red-100 text-red-600 font-hanken font-bold text-xs uppercase tracking-wider rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              >
                CLEAR
              </button>

              <button
                type="button"
                disabled={isVerifying}
                onClick={() => handleKeyPress("0")}
                className="h-14 bg-gray-50 hover:bg-gray-100 active:bg-gray-200 text-black font-hanken font-extrabold text-xl rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              >
                0
              </button>

              <button
                type="button"
                disabled={isVerifying}
                onClick={handleBackspace}
                className="h-14 bg-gray-100 hover:bg-gray-200 text-gray-700 font-hanken font-bold rounded-2xl flex items-center justify-center transition-all cursor-pointer disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[20px]">backspace</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
