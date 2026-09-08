"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OrderRecord } from "./types";

interface StoreOrderHistoryModalProps {
  isOpen: boolean;
  myOrders: OrderRecord[];
  isLoadingMyOrders: boolean;
  onClose: () => void;
}

export const StoreOrderHistoryModal: React.FC<StoreOrderHistoryModalProps> = ({
  isOpen,
  myOrders,
  isLoadingMyOrders,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100003] bg-white flex flex-col justify-between overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 350 }}
            className="w-full h-full flex flex-col text-black max-w-md mx-auto overflow-hidden will-change-transform"
          >
            {/* Header */}
            <div className="px-4 py-3 flex items-center justify-between flex-shrink-0 border-b border-gray-100 bg-white/95 backdrop-blur-md">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 transition-colors cursor-pointer border-0"
                  title="Back"
                >
                  <span className="material-symbols-outlined text-[20px]">arrow_back</span>
                </button>
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">history</span>
                <h2 className="font-hanken font-extrabold text-base text-black uppercase tracking-wide">
                  Order History
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-colors cursor-pointer border-0"
                title="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3.5 custom-scrollbar pb-24">
              {isLoadingMyOrders ? (
                <div className="py-16 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                  Loading Order History...
                </div>
              ) : myOrders.length === 0 ? (
                <div className="py-16 text-center space-y-2">
                  <span className="material-symbols-outlined text-[48px] text-gray-300">
                    shopping_bag
                  </span>
                  <p className="font-bold text-xs text-gray-500">
                    You have not placed any store orders yet.
                  </p>
                </div>
              ) : (
                myOrders.map((ord) => (
                  <div
                    key={ord.id}
                    className="p-4 bg-gray-50 border-0 rounded-2xl space-y-2.5 shadow-3xs"
                  >
                    <div className="flex items-center justify-between pb-2">
                      <div>
                        <span className="font-mono font-black text-xs text-[#FC7A00]">
                          {ord.id}
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          {new Date(ord.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border-0 bg-orange-100 text-orange-800">
                        {ord.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-gray-700">
                        <span>Items ({ord.items?.length || 0}):</span>
                        <span>₦{ord.totalAmount?.toLocaleString()}</span>
                      </div>
                      <p className="text-[10.5px] text-gray-500 line-clamp-2">
                        {ord.items?.map((i: any) => `${i.title} (x${i.quantity})`).join(", ")}
                      </p>
                    </div>

                    {ord.adminNotes && (
                      <div className="p-2 rounded-xl bg-orange-50 border-0 text-[10px] text-orange-800 font-medium">
                        <strong>Admin Note:</strong> {ord.adminNotes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
