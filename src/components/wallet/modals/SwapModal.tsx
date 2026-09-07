"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface SwapModalProps {
  user: any;
  userData: any;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SwapModal: React.FC<SwapModalProps> = ({
  user,
  userData,
  onClose,
  onSuccess,
}) => {
  useModalBackHandler(true, onClose);

  const [swapStep, setSwapStep] = useState<"form" | "pin">("form");
  const [swapAmount, setSwapAmount] = useState("");
  const [swapFromCurrency, setSwapFromCurrency] = useState<string>("NGN");
  const [swapToCurrency, setSwapToCurrency] = useState<string>("USD");
  const [swapRate, setSwapRate] = useState<number | null>(null);
  const [swapFee, setSwapFee] = useState<number>(0);
  const [swapTargetAmount, setSwapTargetAmount] = useState<number>(0);
  const [isRatesLoading, setIsRatesLoading] = useState(false);
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapPin, setSwapPin] = useState("");

  // Rate lookup effect with 300ms debounce
  useEffect(() => {
    const amt = parseFloat(swapAmount);
    if (isNaN(amt) || amt <= 0) {
      setSwapRate(null);
      setSwapFee(0);
      setSwapTargetAmount(0);
      return;
    }

    const fetchRate = async () => {
      setIsRatesLoading(true);
      try {
        let idToken = "mock-token";
        if (user && sessionStorage.getItem("mock") !== "true") {
          idToken = await user.getIdToken();
        }

        const res = await fetch(
          `/api/wallets/rates?from=${swapFromCurrency}&to=${swapToCurrency}&amount=${swapAmount}`,
          {
            headers: { Authorization: `Bearer ${idToken}` },
          }
        );

        const data = await res.json();
        if (res.ok && data.success) {
          setSwapRate(data.rate);
          setSwapFee(data.fee || 0);
          setSwapTargetAmount(data.targetAmount || amt * data.rate);
        } else {
          setSwapRate(null);
        }
      } catch (err) {
        console.error("Fetch Rate Error:", err);
      } finally {
        setIsRatesLoading(false);
      }
    };

    const delay = setTimeout(fetchRate, 300);
    return () => clearTimeout(delay);
  }, [swapAmount, swapFromCurrency, swapToCurrency, user]);

  const handleSwapFormContinue = (e: React.FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(swapAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid swap amount.");
      return;
    }
    setSwapPin("");
    setSwapStep("pin");
  };

  const handleExecuteSwap = async () => {
    if (swapPin.length !== 4) {
      toast.error("Please enter your 4-digit PIN.");
      return;
    }

    setIsSwapping(true);
    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/wallets/swap", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fromCurrency: swapFromCurrency,
          toCurrency: swapToCurrency,
          amount: parseFloat(swapAmount),
          pin: swapPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Currency swap executed successfully!");
        if (onSuccess) onSuccess();
        window.dispatchEvent(new Event("app-refresh"));
        onClose();
      } else {
        toast.error(data.error || "Currency swap failed.");
        setSwapPin("");
      }
    } catch (err) {
      console.error("Swap Execution Error:", err);
      toast.error("Network error executing swap.");
      setSwapPin("");
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] flex flex-col justify-end bg-black/55">
      <motion.div
        initial={{ opacity: 0, y: "100%" }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: "100%" }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md mx-auto bg-white rounded-t-3xl p-6 shadow-2xl flex flex-col max-h-[92vh] overflow-y-auto no-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-gray-100 mb-4">
          <div className="flex items-center gap-2">
            {swapStep === "pin" && (
              <button
                type="button"
                onClick={() => setSwapStep("form")}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}
            <h3 className="font-hanken font-extrabold text-base text-gray-900">
              {swapStep === "pin" ? "Authorize Swap PIN" : "Currency Swap"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {swapStep === "form" ? (
          <form onSubmit={handleSwapFormContinue} className="space-y-4">
            {/* Direction Switcher */}
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase text-gray-400">Swap Pair</span>
              <button
                type="button"
                onClick={() => {
                  const prevFrom = swapFromCurrency;
                  const prevTo = swapToCurrency;
                  setSwapFromCurrency(prevTo);
                  setSwapToCurrency(prevFrom);
                }}
                className="text-xs font-bold text-[#FC7A00] flex items-center gap-1 hover:underline"
              >
                <span className="material-symbols-outlined text-sm">swap_horiz</span>
                Switch ({swapFromCurrency} ↔ {swapToCurrency})
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {["NGN", "USD", "XOF"].map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => {
                    if (curr !== swapToCurrency) setSwapFromCurrency(curr);
                  }}
                  className={`py-2.5 rounded-xl font-bold text-xs ${
                    swapFromCurrency === curr
                      ? "bg-[#FC7A00] text-white"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  From {curr}
                </button>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Amount to Swap ({swapFromCurrency})</label>
              <input
                type="number"
                placeholder="0.00"
                value={swapAmount}
                onChange={(e) => setSwapAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 font-mono text-base font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
              />
            </div>

            {isRatesLoading && (
              <p className="text-xs text-[#FC7A00] font-bold animate-pulse">Calculating exchange rate...</p>
            )}

            {swapRate !== null && !isRatesLoading && (
              <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl space-y-2">
                <div className="flex justify-between text-xs text-gray-600 font-bold">
                  <span>Exchange Rate:</span>
                  <span className="font-mono text-gray-900">1 {swapFromCurrency} = {swapRate.toFixed(4)} {swapToCurrency}</span>
                </div>
                <div className="flex justify-between text-sm font-black text-gray-900 border-t border-orange-200 pt-2">
                  <span>You Receive:</span>
                  <span className="font-mono text-[#FC7A00]">~{swapTargetAmount.toFixed(2)} {swapToCurrency}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!swapAmount || parseFloat(swapAmount) <= 0 || swapRate === null}
              onClick={handleSwapFormContinue}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              Continue to PIN
            </button>
          </form>
        ) : (
          <div className="space-y-5 text-center py-2">
            <div>
              <h4 className="font-hanken font-extrabold text-sm text-gray-900">Enter Your 4-Digit PIN</h4>
              <p className="font-hanken text-xs text-gray-500 mt-1">
                Swapping {swapAmount} {swapFromCurrency} → {swapTargetAmount.toFixed(2)} {swapToCurrency}
              </p>
            </div>

            {/* PIN Indicator Dots */}
            <div className="flex items-center justify-center gap-4 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    swapPin.length > i
                      ? "bg-[#FC7A00] border-[#FC7A00] scale-110"
                      : "border-gray-300 bg-gray-100"
                  }`}
                />
              ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "backspace"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "CLEAR") {
                      setSwapPin("");
                    } else if (key === "backspace") {
                      setSwapPin((prev) => prev.slice(0, -1));
                    } else if (swapPin.length < 4) {
                      setSwapPin((prev) => prev + key);
                    }
                  }}
                  className="h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 font-mono text-base font-bold text-gray-900 flex items-center justify-center transition-all"
                >
                  {key === "backspace" ? (
                    <span className="material-symbols-outlined text-xl">backspace</span>
                  ) : key === "CLEAR" ? (
                    <span className="text-[10px] font-extrabold tracking-wider text-rose-500">CLR</span>
                  ) : (
                    key
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={swapPin.length !== 4 || isSwapping}
              onClick={handleExecuteSwap}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              {isSwapping ? "Executing Swap..." : "Confirm & Swap"}
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default React.memo(SwapModal);
