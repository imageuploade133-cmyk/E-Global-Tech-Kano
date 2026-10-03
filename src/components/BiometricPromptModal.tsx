"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getBiometricLabel, getBiometricType } from "@/lib/biometrics-util";
import { triggerHaptic } from "@/lib/haptics";

export function BiometricPromptModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [promptTitle, setPromptTitle] = useState("Biometric Verification");
  const [isVerifying, setIsVerifying] = useState(false);

  const label = getBiometricLabel();
  const type = getBiometricType();

  useEffect(() => {
    const handleRequest = (e: Event) => {
      const customEvent = e as CustomEvent<{ title?: string }>;
      setPromptTitle(customEvent.detail?.title || `Verify ${label}`);
      setIsVerifying(false);
      setIsOpen(true);
      triggerHaptic();
    };

    window.addEventListener("biometric_verify_request", handleRequest);
    return () => {
      window.removeEventListener("biometric_verify_request", handleRequest);
    };
  }, [label]);

  const handleVerifySuccess = () => {
    triggerHaptic();
    setIsVerifying(true);
    setTimeout(() => {
      setIsOpen(false);
      setIsVerifying(false);
      window.dispatchEvent(
        new CustomEvent("biometric_verify_result", { detail: { verified: true } })
      );
    }, 700);
  };

  const handleCancel = () => {
    triggerHaptic();
    setIsOpen(false);
    setIsVerifying(false);
    window.dispatchEvent(
      new CustomEvent("biometric_verify_result", { detail: { verified: false } })
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCancel}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[999998]"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300, mass: 0.8 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] p-6 pb-8 z-[999999] flex flex-col items-center text-center text-black font-hanken select-none shadow-2xl"
          >
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5" />

            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              <div className="w-8" />
              <h3 className="font-hanken font-bold text-base text-black uppercase tracking-wider">
                {label} Verification
              </h3>
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
              </button>
            </div>

            {/* Scanning Biometric Icon Graphic */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="w-20 h-20 rounded-3xl bg-orange-50 border border-orange-200 text-[#FC7A00] flex items-center justify-center relative overflow-hidden shadow-inner">
                <span className="material-symbols-outlined text-[48px] font-bold">
                  {type === "faceid" ? "face_6" : "fingerprint"}
                </span>

                {isVerifying && (
                  <motion.div
                    initial={{ y: -40 }}
                    animate={{ y: [ -40, 40, -40 ] }}
                    transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#FC7A00] to-transparent shadow-md"
                  />
                )}
              </div>
            </div>

            <h4 className="font-extrabold text-base text-gray-900 mb-1">{promptTitle}</h4>
            <p className="font-semibold text-xs text-gray-500 max-w-[280px] mb-6 leading-relaxed">
              {isVerifying
                ? `Scanning and validating ${label}...`
                : `Touch sensor or align face to verify your identity with ${label}.`}
            </p>

            <div className="w-full space-y-2.5">
              <button
                type="button"
                disabled={isVerifying}
                onClick={handleVerifySuccess}
                className="w-full py-4 bg-[#FC7A00] hover:bg-[#e06600] active:scale-98 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
              >
                {isVerifying ? (
                  <>
                    <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                    <span>Verifying {label}...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[20px]">
                      {type === "faceid" ? "face_6" : "fingerprint"}
                    </span>
                    <span>Verify {label}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleCancel}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 active:scale-98 text-gray-700 font-bold text-xs uppercase tracking-widest rounded-2xl transition-all cursor-pointer border-0"
              >
                Cancel & Use Access PIN
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
