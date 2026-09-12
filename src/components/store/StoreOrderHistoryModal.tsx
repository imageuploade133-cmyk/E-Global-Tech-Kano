"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { OrderRecord } from "./types";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

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
  const [selectedOrder, setSelectedOrder] = useState<OrderRecord | null>(null);

  useModalBackHandler(Boolean(selectedOrder), () => setSelectedOrder(null), "store-order-detail-modal");

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
                    onClick={() => setSelectedOrder(ord)}
                    className="p-4 bg-gray-50 hover:bg-gray-100/80 border border-gray-150 hover:border-[#FC7A00] rounded-2xl space-y-2.5 shadow-3xs cursor-pointer transition-all active:scale-98"
                  >
                    <div className="flex items-center justify-between pb-2 border-b border-gray-200/50">
                      <div>
                        <span className="font-mono font-black text-xs text-[#FC7A00]">
                          {ord.id}
                        </span>
                        <span className="text-[10px] text-gray-400 block">
                          {new Date(ord.createdAt).toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase border-0 bg-orange-100 text-orange-800">
                          {ord.status || "Pending"}
                        </span>
                        <span className="material-symbols-outlined text-gray-400 text-[18px]">chevron_right</span>
                      </div>
                    </div>

                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between font-bold text-gray-800">
                        <span>Items Purchased ({ord.items?.length || 0}):</span>
                        <span className="font-mono font-black text-[#FC7A00]">₦{ord.totalAmount?.toLocaleString()}</span>
                      </div>
                      <p className="text-[10.5px] text-gray-500 line-clamp-2">
                        {ord.items?.map((i: any) => `${i.title} (x${i.quantity})`).join(", ")}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-1 text-[10px] font-bold text-[#FC7A00]">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px]">visibility</span>
                        Tap to View Full Order Details
                      </span>
                      <span className="text-gray-400 font-normal">
                        {(ord as any).paymentChannel || (ord.paymentMethod === "CARD_CHECKOUT" ? "Card Payment" : "Main Wallet")}
                      </span>
                    </div>

                    {ord.adminNotes && (
                      <div className="p-2 rounded-xl bg-orange-50 border border-orange-100 text-[10px] text-orange-800 font-medium">
                        <strong>Admin Note:</strong> {ord.adminNotes}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Selected Order Full Details Modal Drawer */}
            <AnimatePresence>
              {selectedOrder && (
                <div className="fixed inset-0 z-[100005] bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <motion.div
                    initial={{ opacity: 0, y: "100%" }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: "100%" }}
                    transition={{ type: "spring", damping: 30, stiffness: 300 }}
                    className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-5 text-black space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar border-0"
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedOrder(null)}
                          className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 cursor-pointer border-0"
                          title="Back"
                        >
                          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        </button>
                        <div>
                          <h3 className="font-hanken font-extrabold text-sm text-black uppercase tracking-wide">
                            Order Specifications
                          </h3>
                          <span className="font-mono text-xs font-black text-[#FC7A00]">
                            {selectedOrder.id}
                          </span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black cursor-pointer border-0"
                        title="Close"
                      >
                        <span className="material-symbols-outlined text-[18px]">close</span>
                      </button>
                    </div>

                    {/* Order & Payment Status Badges */}
                    <div className="p-3.5 bg-gray-50 rounded-2xl space-y-2 border border-gray-150">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Order Status</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-orange-100 text-orange-800">
                          {selectedOrder.status || "Pending"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-gray-200/60 pt-2">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Payment Status</span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-100 text-emerald-800">
                          {(selectedOrder as any).paymentStatus || "PAID"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-gray-200/60 pt-2">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Fulfillment Method</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase inline-flex items-center gap-1 ${
                          (selectedOrder.deliveryType === "PICKUP" || (selectedOrder.deliveryAddress || "").toUpperCase().includes("PICKUP"))
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}>
                          <span className="material-symbols-outlined text-[13px]">
                            {(selectedOrder.deliveryType === "PICKUP" || (selectedOrder.deliveryAddress || "").toUpperCase().includes("PICKUP")) ? "storefront" : "local_shipping"}
                          </span>
                          <span>{(selectedOrder.deliveryType === "PICKUP" || (selectedOrder.deliveryAddress || "").toUpperCase().includes("PICKUP")) ? "In-Store Pickup" : "Home Delivery"}</span>
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-xs border-t border-gray-200/60 pt-2">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Date Placed</span>
                        <span className="font-bold text-gray-800 text-[11px]">
                          {new Date(selectedOrder.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Purchased Items List */}
                    <div className="space-y-2">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                        Purchased Items ({selectedOrder.items?.length || 0})
                      </span>
                      <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar pr-1">
                        {selectedOrder.items?.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="p-3 bg-gray-50 border border-gray-150 rounded-xl flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              {item.imageUrl && (
                                <img
                                  src={item.imageUrl}
                                  alt={item.title}
                                  className="w-10 h-10 object-contain rounded-lg border border-gray-200 bg-white shrink-0 p-0.5"
                                />
                              )}
                              <div className="min-w-0">
                                <h4 className="font-extrabold text-xs text-black truncate uppercase">
                                  {item.title}
                                </h4>
                                <p className="text-[10px] text-gray-500 font-medium">
                                  {item.quantity} x ₦{Number(item.price || 0).toLocaleString()}
                                </p>
                              </div>
                            </div>
                            <span className="font-mono font-black text-xs text-black shrink-0">
                              ₦{Number((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Charge Summary & Payment Channel */}
                    <div className="p-3.5 bg-gray-50 rounded-2xl space-y-2 border border-gray-150 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Payment Channel</span>
                        <span className="font-extrabold text-gray-800">
                          {(selectedOrder as any).paymentChannel || (selectedOrder.paymentMethod === "CARD_CHECKOUT" ? "Checkout with Card Payment" : "Main NGN Wallet")}
                        </span>
                      </div>
                      <div className="flex justify-between items-center border-t border-gray-200/60 pt-2">
                        <span className="text-gray-500 font-bold uppercase text-[10px]">Total Order Charge</span>
                        <span className="font-mono font-black text-sm text-[#FC7A00]">
                          ₦{selectedOrder.totalAmount?.toLocaleString()}
                        </span>
                      </div>
                    </div>

                    {/* Customer Delivery Information */}
                    <div className="p-3.5 bg-gray-50 rounded-2xl space-y-1.5 border border-gray-150 text-xs">
                      <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                        Customer Delivery Details
                      </span>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">Recipient:</span>
                        <span className="font-extrabold text-black uppercase">{selectedOrder.customerName}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500 font-bold">Contact Phone:</span>
                        <span className="font-mono font-bold text-black">{selectedOrder.customerPhone}</span>
                      </div>
                      <div>
                        <span className="text-gray-500 font-bold block">Delivery Address / Notes:</span>
                        <p className="font-medium text-[#222] text-[11px] mt-0.5 leading-relaxed bg-white p-2 rounded-lg border border-gray-200/80">
                          {selectedOrder.deliveryAddress}
                        </p>
                      </div>
                    </div>

                    {/* Admin Notes */}
                    {selectedOrder.adminNotes && (
                      <div className="p-3 rounded-2xl bg-orange-50 border border-orange-200 text-xs text-orange-900 space-y-1">
                        <span className="font-black uppercase tracking-wider text-[10px] text-orange-700 block">
                          Administrator Updates / Notes
                        </span>
                        <p className="font-medium leading-relaxed">{selectedOrder.adminNotes}</p>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="pt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedOrder.id);
                          toast.success("Order ID copied to clipboard!");
                        }}
                        className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 flex items-center justify-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[16px]">content_copy</span>
                        Copy Order ID
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(null)}
                        className="flex-1 py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 shadow-xs"
                      >
                        Close Details
                      </button>
                    </div>
                  </motion.div>
                </div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
