"use client";

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface UsdFundingModalProps {
  user: any;
  userData: any;
  accountData?: {
    accountNumber: string;
    bankName: string;
    routingNumber?: string;
    accountName: string;
  } | null;
  onClose: () => void;
}

export const UsdFundingModal: React.FC<UsdFundingModalProps> = ({
  user,
  userData,
  accountData,
  onClose,
}) => {
  useModalBackHandler(true, onClose);

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
          <h3 className="font-hanken font-extrabold text-base text-gray-900">
            USD Virtual Account & Funding
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        <div className="space-y-4">
          <p className="font-hanken text-xs text-gray-500">
            Deposit USD directly into your dedicated virtual account or swap NGN to USD balance.
          </p>

          {accountData ? (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400">Bank Name</p>
                <p className="font-hanken text-xs font-bold text-gray-900">{accountData.bankName}</p>
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400">Account Number</p>
                <div className="flex items-center justify-between">
                  <p className="font-mono text-sm font-bold text-[#FC7A00] select-all">{accountData.accountNumber}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(accountData.accountNumber);
                      toast.success("USD Account Number copied!");
                    }}
                    className="text-xs font-bold text-[#FC7A00] hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>

              {accountData.routingNumber && (
                <div>
                  <p className="text-[10px] font-bold uppercase text-gray-400">Routing Number / ABA</p>
                  <p className="font-mono text-xs font-bold text-gray-800">{accountData.routingNumber}</p>
                </div>
              )}

              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400">Account Name</p>
                <p className="font-hanken text-xs font-bold text-gray-800">{accountData.accountName}</p>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl text-center space-y-2">
              <span className="material-symbols-outlined text-3xl text-[#FC7A00]">swap_horizontal_circle</span>
              <p className="font-hanken text-xs font-bold text-gray-900">USD Swap Available</p>
              <p className="font-hanken text-[11px] text-gray-500">
                You can fund your USD wallet instantly by using the In-App Currency Swap feature to swap from NGN to USD.
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={onClose}
            className="w-full py-3.5 bg-gray-900 text-white font-hanken text-xs font-bold rounded-2xl"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default React.memo(UsdFundingModal);
