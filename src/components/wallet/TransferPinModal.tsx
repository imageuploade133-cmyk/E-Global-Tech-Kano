"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { TwoFactorOtpVerificationView } from "@/components/auth/TwoFactorOtpVerificationView";
import { getBiometricLabel, getBiometricType, authenticateBiometricDetailed } from "@/lib/biometrics-util";
import { triggerHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface TransferPinModalProps {
  isOpen: boolean;
  recipientName: string;
  bankName: string;
  accountNumber: string;
  amount: number;
  fee: number;
  totalDebit: number;
  walletBalance: number;
  onClose: () => void;
  onExecuteTransfer: (pin?: string, isBiometricAuthenticated?: boolean) => void;
}

export const TransferPinModal: React.FC<TransferPinModalProps> = ({
  isOpen,
  recipientName,
  bankName,
  accountNumber,
  amount,
  fee,
  totalDebit,
  walletBalance,
  onClose,
  onExecuteTransfer,
}) => {
  const { user, userData, updateUserData } = useAuth();
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [is2faStage, setIs2faStage] = useState(false);
  const [verifiedPin, setVerifiedPin] = useState("");

  useEffect(() => {
    if (isOpen) {
      setEnteredPin("");
      setIs2faStage(false);
      setVerifiedPin("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const is2faActive = userData?.is2faOtpEnabled === true;
  const isBiometricEnabled =
    userData?.isBiometricTransferEnabled === true ||
    userData?.isBiometricLoginEnabled === true ||
    userData?.isFaceIdEnabled === true;

  const biometricLabel = getBiometricLabel();
  const biometricType = getBiometricType();

  const handlePinPress = (num: string) => {
    triggerHaptic();
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      if (nextPin.length === 4) {
        if (is2faActive) {
          setVerifiedPin(nextPin);
          setIs2faStage(true);
        } else {
          onExecuteTransfer(nextPin);
        }
      }
    }
  };

  const handlePinDelete = () => {
    triggerHaptic();
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  const handleBiometricAuth = async () => {
    if (!navigator.onLine) {
      toast.error("Internet connection required to verify biometrics.");
      return;
    }
    toast.loading(`Authenticating ${biometricLabel}...`);
    const res = await authenticateBiometricDetailed(`Authorize ₦${totalDebit.toLocaleString()} transfer`);
    toast.dismiss();

    if (res.success) {
      toast.success(`${biometricLabel} Authenticated!`);
      if (userData?.isBiometricTransferEnabled !== true) {
        updateUserData?.({ isBiometricTransferEnabled: true, isBiometricLoginEnabled: true, isFaceIdEnabled: true })?.catch(() => {});
      }
      if (is2faActive) {
        setVerifiedPin("");
        setIs2faStage(true);
      } else {
        onExecuteTransfer(undefined, true);
      }
    } else if (res.cancelled) {
      // User cancelled biometric prompt cleanly
    } else {
      toast.error(res.message || `${biometricLabel} authentication failed.`);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", damping: 25, stiffness: 280 }}
          className="fixed inset-0 bg-white z-[200000] p-6 flex flex-col justify-between text-black max-w-md mx-auto"
        >
          {/* Header row */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer shadow-none"
              title="Close Pin Pad"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">arrow_back</span>
            </button>
            <h3 className="font-hanken font-black text-xs text-black uppercase tracking-wider">
              Authorize Transfer
            </h3>
            <div className="w-9" />
          </div>

          {/* Central Body Container */}
          <div className="flex-grow flex flex-col items-center justify-center space-y-4 py-4 overflow-y-auto custom-scrollbar">
            {is2faStage ? (
              <TwoFactorOtpVerificationView
                user={user}
                title="2FA Transfer Verification"
                description={`PIN/Biometrics verified! Complete 2FA OTP verification to authorize ₦${totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} transfer.`}
                onVerifiedSuccess={() => onExecuteTransfer(verifiedPin || undefined, !verifiedPin)}
                onCancel={() => {
                  setIs2faStage(false);
                  setEnteredPin("");
                }}
              />
            ) : (
              <>
                {/* Visual Lock Icon Badge */}
                <div className="w-12 h-12 bg-orange-50 border border-orange-100 text-[#FC7A00] rounded-full flex items-center justify-center shadow-sm shrink-0">
                  <span className="material-symbols-outlined text-[24px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    lock
                  </span>
                </div>

                {/* Transfer Summary Card */}
                <div className="text-center space-y-1.5 w-full">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Total Debit Deduction
                  </p>
                  <p className="font-mono text-2xl font-black text-[#E11D48]">
                    ₦{totalDebit.toLocaleString("en-NG", { minimumFractionDigits: 2 })}
                  </p>

                  <div className="bg-gray-50 border border-gray-200/80 rounded-2xl p-3.5 space-y-1.5 font-hanken text-left text-xs w-full mt-2">
                    <div className="flex justify-between items-center">
                      <span className="text-gray-400 font-bold uppercase text-[9px]">Recipient</span>
                      <span className="font-extrabold text-black uppercase truncate max-w-[200px]">{recipientName}</span>
                    </div>
                    <div className="flex justify-between items-center border-t border-gray-200/60 pt-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[9px]">Destination Bank</span>
                      <span className="font-semibold text-gray-800 uppercase truncate max-w-[180px]">{bankName}</span>
                    </div>
                    {accountNumber && (
                      <div className="flex justify-between items-center border-t border-gray-200/60 pt-1.5">
                        <span className="text-gray-400 font-bold uppercase text-[9px]">Account Number</span>
                        <span className="font-mono font-bold text-black select-all">{accountNumber}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center border-t border-gray-200/60 pt-1.5">
                      <span className="text-gray-400 font-bold uppercase text-[9px]">My Wallet Balance</span>
                      <span className="font-mono font-bold text-gray-600">₦{walletBalance.toLocaleString("en-NG", { minimumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                </div>

                {/* 4 Box PIN Indicators */}
                <div className="space-y-2 w-full flex flex-col items-center">
                  <p className="font-hanken text-[10.5px] text-gray-400 text-center">
                    Enter your secure 4-digit PIN to authorize.
                  </p>

                  <div className="flex justify-center gap-2 pt-0.5">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-black transition-all ${
                          enteredPin.length > idx
                            ? "border-[#FC7A00] bg-orange-50/40 text-black"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        {enteredPin[idx] ? "•" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Keypad Grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-1 w-full max-w-xs mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPress(num.toString())}
                      className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-base font-black text-black cursor-pointer active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => { triggerHaptic(); setEnteredPin(""); }}
                    className="py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer active:scale-95 transition-all"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPress("0")}
                    className="py-3 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-base font-black text-black cursor-pointer active:scale-95 transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="py-3 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">backspace</span>
                  </button>
                </div>

                {/* Biometric Option */}
                {isBiometricEnabled && (
                  <button
                    type="button"
                    onClick={handleBiometricAuth}
                    className="w-full max-w-xs mx-auto py-2.5 bg-[#07B038] hover:bg-[#058a2f] text-white text-[11px] font-black uppercase tracking-wider rounded-xl cursor-pointer shadow-sm transition-all active:scale-98 flex items-center justify-center gap-1.5 mt-1"
                  >
                    <span className="material-symbols-outlined text-[18px]">
                      {biometricType === "faceid" ? "face_6" : "fingerprint"}
                    </span>
                    <span>Authorize via {biometricLabel}</span>
                  </button>
                )}
              </>
            )}
          </div>

          <div className="h-1" />
        </motion.div>
      )}
    </AnimatePresence>
  );
};
