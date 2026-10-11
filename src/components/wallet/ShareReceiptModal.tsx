"use client";

import React, { useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import { AppLogo } from "@/components/AppLogo";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { useAppConfig } from "@/lib/ConfigContext";
import { Transaction } from "./TransactionReceipt";

export interface ShareReceiptModalProps {
  isOpen: boolean;
  transaction: Transaction | null;
  currencySymbol: string;
  displayAmount: number;
  statusText: string;
  formattedDateTime: string;
  recipientNameDisplay: string;
  recipientBankAndAcc: string;
  senderNameDisplay: string;
  senderBankAndAcc: string;
  txTypeDisplay: string;
  displayNarration: string;
  onClose: () => void;
}

export const ShareReceiptModal: React.FC<ShareReceiptModalProps> = ({
  isOpen,
  transaction,
  currencySymbol,
  displayAmount,
  statusText,
  formattedDateTime,
  recipientNameDisplay,
  recipientBankAndAcc,
  senderNameDisplay,
  senderBankAndAcc,
  txTypeDisplay,
  displayNarration,
  onClose,
}) => {
  const shareReceiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const { config } = useAppConfig();

  // Intercept mobile/hardware back button to close ONLY ShareReceiptModal
  useModalBackHandler(isOpen, onClose, "share-receipt-modal");

  if (!isOpen || !transaction) return null;

  const generateReceiptBlob = async (): Promise<Blob | null> => {
    if (!shareReceiptRef.current) return null;
    try {
      const canvas = await html2canvas(shareReceiptRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      return new Promise<Blob | null>((resolve) => {
        canvas.toBlob((blob) => resolve(blob), "image/png", 0.95);
      });
    } catch (err) {
      console.error("HTML2Canvas generation failed:", err);
      return null;
    }
  };

  const handleShareImageFromModal = async () => {
    if (generating) return;
    setGenerating(true);
    toast.loading("Generating shareable receipt image...", { id: "share-image" });

    try {
      const blob = await generateReceiptBlob();
      toast.dismiss("share-image");
      setGenerating(false);

      if (!blob) {
        toast.error("Failed to generate receipt image.");
        return;
      }

      const ref = transaction.reference || "transfer";
      const file = new File([blob], `Receipt_${ref}.png`, { type: "image/png" });
      const summaryText = `Transaction Receipt from ${config.appName || "E-Global Pay"}\nRef: ${ref}\nAmount: ${currencySymbol}${displayAmount.toLocaleString()}`;

      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: "Transaction Receipt",
          text: summaryText,
          files: [file],
        });
        toast.success("Receipt shared successfully!");
      } else if (navigator.share) {
        await navigator.share({
          title: "Transaction Receipt",
          text: summaryText,
        });
        toast.success("Receipt text shared successfully!");
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Receipt_${ref}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success("Receipt image downloaded!");
      }
    } catch (err: any) {
      toast.dismiss("share-image");
      setGenerating(false);
      if (err?.name !== "AbortError") {
        console.warn("Share error:", err);
        toast.error("Unable to share receipt image.");
      }
    }
  };

  const handleDownloadPDFFromModal = async () => {
    if (generating) return;
    setGenerating(true);
    toast.loading("Exporting PDF receipt...", { id: "export-pdf" });

    try {
      const blob = await generateReceiptBlob();
      toast.dismiss("export-pdf");
      setGenerating(false);

      if (!blob) {
        toast.error("Failed to export PDF receipt.");
        return;
      }

      const ref = transaction.reference || "transfer";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Receipt_${ref}.png`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Receipt saved successfully!");
    } catch (err) {
      toast.dismiss("export-pdf");
      setGenerating(false);
      console.error("PDF export error:", err);
      toast.error("Failed to export receipt.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          className="fixed inset-0 w-full h-full bg-[#F5F6F8] z-[100005] flex flex-col select-none overflow-hidden text-black font-hanken"
        >
          {/* Modal Top Navigation */}
          <div className="safe-top bg-[#F5F6F8] px-5 py-4 flex items-center justify-between shrink-0 border-b border-gray-200/50">
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-2 text-gray-800 font-semibold text-base active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-2xl font-bold">arrow_back</span>
              <span>Share Receipt</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-200/60 flex items-center justify-center text-gray-700 hover:text-black transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-lg font-bold">close</span>
            </button>
          </div>

          {/* Ticket Card Container */}
          <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col items-center custom-scrollbar pb-28">
            <div
              ref={shareReceiptRef}
              className="relative w-full max-w-sm bg-white rounded-[24px] p-6 shadow-sm flex flex-col space-y-4 text-black border border-gray-100/80 overflow-hidden"
            >
              {/* Optional Background Image Layer */}
              {config.receiptBgImageEnabled && config.receiptBgImageUrl && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden rounded-[24px]">
                  <img
                    src={config.receiptBgImageUrl}
                    alt="Receipt Background"
                    style={{
                      opacity: config.receiptBgImageOpacity ?? 0.15,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                </div>
              )}

              {/* Top Header: App Logo & Receipt Label */}
              <div className="relative z-10 flex justify-between items-center pb-2">
                <div className="flex items-center gap-2">
                  <AppLogo size={32} />
                  <span className="font-extrabold text-lg text-black tracking-tight">{config.appName || "E-Global Pay"}</span>
                </div>
                <span className="text-xs font-semibold text-gray-500">Transaction Receipt</span>
              </div>

              {/* Amount & Status */}
              <div className="relative z-10 text-center py-2 space-y-1">
                <h1 className="font-mono text-3xl font-extrabold text-[#00B96B]">
                  {currencySymbol}{displayAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </h1>
                <p className="font-bold text-sm text-gray-900">{statusText}</p>
                <p className="text-[11px] text-gray-400 font-medium">{formattedDateTime}</p>
              </div>

              <div className="relative z-10 border-b border-gray-100" />

              {/* Transaction Details */}
              <div className="relative z-10 space-y-3.5 text-xs">
                {/* Recipient Details */}
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 font-medium shrink-0 pt-0.5">Recipient Details</span>
                  <div className="text-right flex flex-col items-end pl-3">
                    <span className="font-bold text-gray-900 leading-tight">{recipientNameDisplay}</span>
                    <span className="text-gray-500 text-[11px] font-medium leading-tight mt-0.5">{recipientBankAndAcc}</span>
                  </div>
                </div>

                {/* Sender Details */}
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 font-medium shrink-0 pt-0.5">Sender Details</span>
                  <div className="text-right flex flex-col items-end pl-3">
                    <span className="font-bold text-gray-900 leading-tight">{senderNameDisplay}</span>
                    <span className="text-gray-500 text-[11px] font-medium leading-tight mt-0.5">{senderBankAndAcc}</span>
                  </div>
                </div>

                {/* Transaction Type */}
                {txTypeDisplay && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400 font-medium">Transaction Type</span>
                    <span className="font-bold text-gray-900 text-right">{txTypeDisplay}</span>
                  </div>
                )}

                {/* Remark / Narration */}
                {displayNarration && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400 font-medium shrink-0">Remark</span>
                    <span className="font-bold text-gray-900 text-right pl-3 break-words max-w-[250px] leading-snug">{displayNarration}</span>
                  </div>
                )}

                {/* Transaction No. */}
                <div className="flex justify-between items-start">
                  <span className="text-gray-400 font-medium shrink-0">Transaction No.</span>
                  <span className="font-mono font-semibold text-gray-900 text-right text-[11px] pl-3 break-all">{transaction.reference}</span>
                </div>

                {/* Session ID */}
                {transaction.sessionId && (
                  <div className="flex justify-between items-start">
                    <span className="text-gray-400 font-medium shrink-0">Session ID</span>
                    <span className="font-mono font-semibold text-gray-900 text-right text-[11px] pl-3 break-all">{transaction.sessionId}</span>
                  </div>
                )}
              </div>

              {/* Card Disclaimer Footer */}
              <div className="relative z-10 pt-3 border-t border-gray-100">
                <p className="text-[10px] text-gray-400 leading-relaxed font-normal">
                  {config.receiptCbnText || "E-Global Pay is a Fintech app powered by Flutterwave, licensed by CBN and insured by NDIC."}
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Share Actions Bar */}
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex items-center justify-around shadow-lg z-20">
            <button
              type="button"
              disabled={generating}
              onClick={handleShareImageFromModal}
              className="flex-1 py-3 flex items-center justify-center gap-2 text-[#00B96B] font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all rounded-xl cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg font-bold">image</span>
              <span>Share as image</span>
            </button>

            <div className="w-[1px] h-6 bg-gray-200 my-auto" />

            <button
              type="button"
              disabled={generating}
              onClick={handleDownloadPDFFromModal}
              className="flex-1 py-3 flex items-center justify-center gap-2 text-[#00B96B] font-bold text-sm hover:bg-gray-50 active:scale-95 transition-all rounded-xl cursor-pointer disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-lg font-bold">picture_as_pdf</span>
              <span>Save PDF</span>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
