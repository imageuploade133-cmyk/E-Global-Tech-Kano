"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

export interface Transaction {
  id: string;
  reference: string;
  type: string;
  amount: number;
  currency?: "NGN" | "USD";
  description: string;
  recipientName?: string;
  bankName?: string;
  status: "SUCCESS" | "PENDING" | "FAILED";
  date: string;
  time: string;
  fee: number;
}

interface TransactionReceiptProps {
  transaction: Transaction | null;
  onClose: () => void;
}

// Map bank names to professional logos or styled placeholders
const getBankLogo = (bankName?: string) => {
  const name = (bankName || "").toLowerCase();
  if (name.includes("providus")) return "https://i.ibb.co/68Xk9X6M/providus.png";
  if (name.includes("wema font") || name.includes("wema")) return "https://i.ibb.co/vxS3P98t/wema.png";
  if (name.includes("fcmb")) return "https://i.ibb.co/3ykbNfG3/fcmb.png";
  if (name.includes("opay") || name.includes("owealth")) return "https://i.ibb.co/Lzq2S3Wq/opay.png";
  if (name.includes("access")) return "https://i.ibb.co/PZrQW8fB/access.png";
  if (name.includes("first bank") || name.includes("firstbank")) return "https://i.ibb.co/gZH0b2y1/firstbank.png";
  // Fallback to official E-Tech Logo
  return "https://i.ibb.co/WWjZrtC7/E-Tech.png";
};

export const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  onClose,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);

  // Prevent background scrolling while the full screen modal is displayed
  useEffect(() => {
    if (transaction) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [transaction]);

  const handleCopy = (text: string, label: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success(`${label} copied successfully!`);
    }
  };

  if (!transaction) return null;

  const isDeposit =
    transaction.type === "DEPOSIT" || transaction.type === "CASHOUT";
  const currencySymbol = transaction.currency === "USD" ? "$" : "₦";

  // Generate realistic bank session ID based on reference
  const generateSessionId = (ref: string) => {
    let hash = 0;
    for (let i = 0; i < ref.length; i++) {
      hash = ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash).toString().padEnd(18, "0");
    return `000003260807092${absHash.slice(0, 15)}`;
  };

  // Generate realistic masked account number based on reference
  const generateAccountNumber = (ref: string) => {
    let hash = 0;
    for (let i = 0; i < ref.length; i++) {
      hash = ref.charCodeAt(i) + ((hash << 5) - hash);
    }
    const suffix = Math.abs(hash % 1000).toString().padStart(3, "8");
    return `103****${suffix}`;
  };

  const sessionId = generateSessionId(transaction.reference);
  const mockAccountNumber = generateAccountNumber(transaction.reference);

  // Extract clean bank details
  const bankDisplayName = transaction.bankName || (isDeposit ? "Providus Bank" : "Wema Bank");
  const entityName = transaction.recipientName || (isDeposit ? "DIRECT INBOUND DEPOSIT" : "E-TECH SECURE NODE");
  const bankLogoUrl = getBankLogo(bankDisplayName);

  // Download PDF Action using html2canvas & jsPDF
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Generating professional PDF receipt...");

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190; // mm
      const pageHeight = 295; // mm
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10; // margin top

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`E-Tech_Receipt_${transaction.reference}.pdf`);
      toast.dismiss();
      toast.success("PDF Receipt downloaded successfully!");
    } catch (err: any) {
      console.error("PDF generation failed:", err);
      toast.dismiss();
      toast.error("Failed to generate PDF. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // Download Image Action using html2canvas
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Generating high-quality receipt image...");

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `E-Tech_Receipt_${transaction.reference}.png`;
      link.click();

      toast.dismiss();
      toast.success("Receipt image downloaded successfully!");
    } catch (err: any) {
      console.error("Image generation failed:", err);
      toast.dismiss();
      toast.error("Failed to generate image.");
    } finally {
      setGenerating(false);
    }
  };

  // Share PDF/Image Action using native Navigator Share API
  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Preparing receipt file for sharing...");

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.dismiss();
          toast.error("Failed to compile receipt files.");
          return;
        }

        const file = new File([blob], `Receipt_${transaction.reference}.png`, { type: "image/png" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          toast.dismiss();
          await navigator.share({
            files: [file],
            title: "Transaction Receipt",
            text: `Receipt of transaction reference ${transaction.reference} from E-Tech Global Hub`,
          });
        } else {
          toast.dismiss();
          // Fallback to downloading image if navigator share is unsupported on current client browser
          const imgData = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = imgData;
          link.download = `E-Tech_Receipt_${transaction.reference}.png`;
          link.click();
          toast.success("Share API unsupported. Receipt image downloaded to device instead.");
        }
      }, "image/png");
    } catch (err: any) {
      console.error("Sharing receipt failed:", err);
      toast.dismiss();
      toast.error("Failed to prepare share file.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 w-full h-full bg-gray-50 z-[100000] flex flex-col select-none overflow-hidden"
      >
        {/* Full-Screen Page Sticky Header */}
        <div className="safe-top bg-white border-b border-gray-100 px-6 py-4 flex justify-between items-center shrink-0 shadow-3xs">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:text-black active:scale-90 transition-all cursor-pointer shadow-3xs"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
          </button>
          <div className="text-center">
            <h2 className="font-hanken font-bold text-base text-black">
              Transaction Receipt
            </h2>
          </div>
          <div className="w-10" />
        </div>

        {/* Scrollable Receipt Canvas Container */}
        <div className="flex-1 overflow-y-auto p-margin-mobile flex flex-col items-center custom-scrollbar pb-28">

          {/* Printable Receipt Card Ref */}
          <div
            ref={receiptRef}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-sm flex flex-col space-y-5 text-black"
          >
            {/* Top Logo & Title segment */}
            <div className="text-center border-b border-dashed border-gray-200 pb-5 space-y-4">
              <div className="relative w-14 h-14 mx-auto bg-gray-50 rounded-full border border-gray-100 p-1 flex items-center justify-center overflow-hidden">
                <Image
                  src={bankLogoUrl}
                  alt={`${bankDisplayName} Logo`}
                  fill
                  className="object-contain p-1.5"
                />
              </div>

              <div className="space-y-1">
                <p className="font-hanken font-extrabold text-[10.5px] uppercase tracking-widest text-gray-400">
                  {bankDisplayName}
                </p>
                <h2 className="font-hanken font-bold text-sm text-gray-800 leading-snug">
                  {isDeposit ? `Transfer from ${entityName}` : `Transfer to ${entityName}`}
                </h2>
                <h1 className="font-mono text-3xl font-black text-black tracking-tight mt-1">
                  {currencySymbol}
                  {transaction.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h1>
              </div>

              {/* Status Indicator */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold leading-none">
                {transaction.status === "SUCCESS" ? (
                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
                    <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                    <span>Successful</span>
                  </div>
                ) : transaction.status === "PENDING" ? (
                  <div className="flex items-center gap-1 text-amber-600 bg-amber-50 px-3.5 py-1.5 rounded-full border border-amber-100">
                    <span className="material-symbols-outlined text-sm font-bold">schedule</span>
                    <span>Processing</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-red-600 bg-red-50 px-3.5 py-1.5 rounded-full border border-red-100">
                    <span className="material-symbols-outlined text-sm font-bold">cancel</span>
                    <span>Failed</span>
                  </div>
                )}
              </div>
            </div>

            {/* Outward Transfer timeline inside card */}
            {!isDeposit && transaction.status === "SUCCESS" && (
              <div className="border-b border-dashed border-gray-200 pb-5 space-y-3 text-center">
                <div className="flex items-center justify-between px-2">
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Sent</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-emerald-500 mx-2 -mt-4" />
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Processed</span>
                  </div>
                  <div className="flex-1 h-0.5 bg-emerald-500 mx-2 -mt-4" />
                  <div className="flex flex-col items-center">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center">
                      <span className="material-symbols-outlined text-[10px] font-bold">check</span>
                    </div>
                    <span className="text-[8px] font-black text-gray-400 mt-1 uppercase leading-none">Received</span>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border border-gray-100 rounded-2xl text-left">
                  <p className="text-[9px] text-gray-500 font-semibold leading-relaxed">
                    The recipient account is expected to be credited within 5 minutes, subject to notification by the bank. If you have any questions, please contact customer support.
                  </p>
                </div>
              </div>
            )}

            {/* Detailed Transaction Specifications */}
            <div className="space-y-4">
              <h3 className="font-hanken font-extrabold text-[10.5px] text-gray-400 uppercase tracking-widest leading-none">
                Transaction Details
              </h3>

              <div className="space-y-3.5 text-xs">
                <div className="flex justify-between items-start text-gray-500 font-semibold">
                  <span>{isDeposit ? "Credited to" : "Debited from"}</span>
                  <span className="text-black font-bold flex items-center gap-1">
                    Available Balance
                    <span className="material-symbols-outlined text-xs text-gray-400">chevron_right</span>
                  </span>
                </div>

                <div className="flex justify-between items-start text-gray-500 font-semibold">
                  <span>{isDeposit ? "Sender Details" : "Recipient Details"}</span>
                  <div className="text-right max-w-[200px]">
                    <p className="text-black font-bold uppercase truncate">{entityName}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5 font-semibold leading-none">
                      {bankDisplayName} | {mockAccountNumber}
                    </p>
                  </div>
                </div>

                <div className="flex justify-between items-start text-gray-500 font-semibold">
                  <span>Remark</span>
                  <span className="text-black font-bold text-right max-w-[200px] truncate">
                    {transaction.description || "web payment"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Transaction Type</span>
                  <span className="text-black font-bold">
                    {isDeposit ? "Bank Deposit" : "Bank Transfer"}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Transaction No.</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-black font-bold uppercase text-[11px]">
                      {transaction.reference}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(transaction.reference, "Transaction number")}
                      className="text-[#FC7A00] hover:brightness-90 active:scale-90 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px] font-bold">content_copy</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Transaction Date</span>
                  <span className="text-black font-bold text-right">
                    {transaction.date} {transaction.time}
                  </span>
                </div>

                <div className="flex justify-between items-center text-gray-500 font-semibold">
                  <span>Session ID</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-black font-bold uppercase text-[11px] truncate max-w-[120px]">
                      {sessionId}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(sessionId, "Session ID")}
                      className="text-[#FC7A00] hover:brightness-90 active:scale-90 flex items-center justify-center cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[13px] font-bold">content_copy</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Official footer sign-off inside card */}
            <div className="pt-5 border-t border-gray-100 flex flex-col items-center justify-center space-y-1">
              <div className="relative w-20 h-5 opacity-40">
                <Image
                  src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                  alt="E-Tech Signature"
                  fill
                  className="object-contain"
                />
              </div>
              <p className="text-[8px] text-gray-300 font-bold uppercase tracking-widest text-center">
                E-Tech Infinite Secure Ledger
              </p>
            </div>
          </div>
        </div>

        {/* Floating, Sticky bottom action drawer panel with 3 small side-by-side buttons */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 flex gap-2 shadow-lg z-10">
          <button
            type="button"
            disabled={generating}
            onClick={handleDownloadPDF}
            className="flex-1 py-2.5 bg-red-50/50 hover:bg-red-100 text-red-600 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 border border-red-200/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs font-bold">picture_as_pdf</span>
            PDF
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleDownloadImage}
            className="flex-1 py-2.5 bg-blue-50/50 hover:bg-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 border border-blue-200/40 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs font-bold">image</span>
            PNG
          </button>
          <button
            type="button"
            disabled={generating}
            onClick={handleShareReceipt}
            className="flex-1 py-2.5 bg-[#10B981] hover:bg-[#059669] text-white text-[10px] font-bold uppercase tracking-wider rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-xs font-bold">share</span>
            Share
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};
