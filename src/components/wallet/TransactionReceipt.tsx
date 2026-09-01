"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";
import { useLogos } from "@/lib/logos-client";
import { BankLogoResolver } from "@/components/wallet/BankLogoResolver";
import { useAppConfig } from "@/lib/ConfigContext";

export interface Transaction {
  id: string;
  userId?: string;
  reference: string;
  type: string;
  category?: string;
  direction?: "CREDIT" | "DEBIT" | string;
  amount: number;
  currency?: "NGN" | "USD" | string;
  fee?: number;
  vat?: number;
  markup?: number;
  totalDebited?: number;
  totalCredited?: number;
  status: string;
  description: string;
  narration?: string;
  date: string;
  time: string;
  createdAt?: string;
  completedAt?: string;
  recipientName?: string;

  // Provider details
  provider?: string;
  providerReference?: string;
  providerTransactionId?: string;
  sessionId?: string;

  // Bank transfer
  recipientBankName?: string;
  recipientAccountNumber?: string;
  beneficiaryName?: string;
  beneficiaryAccountNumber?: string;
  beneficiaryBankName?: string;
  beneficiaryBankCode?: string;

  // Deposit
  fundingMethod?: string;
  virtualAccountNumber?: string;
  virtualAccountBankName?: string;
  senderName?: string;
  senderAccountNumber?: string;
  senderBankName?: string;

  // Airtime / Data
  network?: string;
  phoneNumber?: string;
  itemCode?: string;
  itemName?: string;
  planName?: string;

  // Bills
  billerCode?: string;
  billerName?: string;
  billerType?: string;
  customerId?: string;
  customerName?: string;

  // Electricity
  meterNumber?: string;
  meterType?: string;
  token?: string;

  // Cable
  smartcardNumber?: string;
  packageName?: string;

  // Swap
  sourceCurrency?: string;
  sourceAmount?: number;
  destinationCurrency?: string;
  destinationAmount?: number;
  exchangeRate?: number;

  // Wallet
  walletType?: "MAIN" | "BONUS";

  // Metadata
  metadata?: Record<string, unknown>;

  // Legacy compatibility fallbacks
  bankName?: string;
}

interface TransactionReceiptProps {
  transaction: Transaction | null;
  onClose: () => void;
}

// Clean status normalizer
const normalizeStatus = (status?: string): "SUCCESS" | "PENDING" | "FAILED" | "REFUND" => {
  const s = String(status || "").toUpperCase().trim();
  if (s === "SUCCESS" || s === "SUCCESSFUL" || s === "COMPLETED" || s === "COMPLETE" || s === "ACTIVE" || s === "DELIVERED") {
    return "SUCCESS";
  }
  if (s === "PENDING" || s === "PROCESSING") {
    return "PENDING";
  }
  if (s === "REFUND" || s === "REFUNDED" || s === "REVERSED") {
    return "REFUND";
  }
  return "FAILED";
};

export const TransactionReceipt: React.FC<TransactionReceiptProps> = ({
  transaction,
  onClose,
}) => {
  const receiptRef = useRef<HTMLDivElement>(null);
  const [generating, setGenerating] = useState(false);
  const { getBillerLogo, getBankLogo, getStoreLogo } = useLogos();
  const { config } = useAppConfig();

  // Prevent background scrolling while modal is open
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

  const normalizedStatus = normalizeStatus(transaction.status);
  const currencySymbol = transaction.currency === "USD" ? "$" : "₦";

  // Transaction Category Classification
  const txType = (transaction.type || "").toUpperCase();
  const cat = (transaction.category || "").toUpperCase();
  const desc = (transaction.description || "").toLowerCase();

  const isSwap = txType.includes("SWAP") || cat.includes("SWAP") || desc.includes("swap") || desc.includes("exchange");
  const isStore = txType.includes("STORE") || cat.includes("STORE") || desc.includes("store");
  const isAirtime = !isSwap && (txType === "AIRTIME" || cat === "AIRTIME" || desc.includes("airtime"));
  const isData = !isSwap && (txType === "DATA" || cat === "DATA" || desc.includes("data"));
  const isCable = !isSwap && (txType === "CABLE" || cat === "CABLE" || desc.includes("cable") || desc.includes("dstv") || desc.includes("gotv") || desc.includes("startimes"));
  const isElectricity = !isSwap && (txType === "ELECTRICITY" || cat === "ELECTRICITY" || desc.includes("electricity") || desc.includes("meter"));
  const isWaec = !isSwap && (txType === "WAEC" || cat === "WAEC" || desc.includes("waec") || desc.includes("exam"));
  const isBill = !isSwap && (isAirtime || isData || isCable || isElectricity || isWaec || txType === "BILLS" || cat === "BILLS" || txType === "BILL_PAYMENT");

  const isTransfer = !isSwap && (txType === "TRANSFER" || cat === "TRANSFER" || txType === "WITHDRAWAL" || (desc.includes("transfer") && !desc.includes("bank transfer") && !desc.includes("virtual account")));
  const isDeposit = !isSwap && (txType === "DEPOSIT" || cat === "DEPOSIT" || txType === "VIRTUAL_ACCOUNT_DEPOSIT" || txType === "CASHOUT" || desc.includes("deposit") || desc.includes("virtual account"));
  const isInvestment = !isSwap && (txType === "INVESTMENT" || cat === "INVESTMENT" || desc.includes("investment") || desc.includes("fixed deposit"));

  // Pure presentation values
  const fee = transaction.fee ?? 0;
  const vat = transaction.vat ?? 0;
  const markup = transaction.markup ?? 0;
  const totalDebited = transaction.totalDebited ?? (transaction.amount + fee + vat);

  // Logo Resolution
  const matchedLogo = isStore
    ? (getBillerLogo("store") || getStoreLogo())
    : isSwap
    ? getBillerLogo("swap")
    : isInvestment
    ? getBillerLogo("investment")
    : isDeposit
    ? (getBillerLogo("deposit") || getBillerLogo("Cash Deposit") || getBankLogo(transaction.senderBankName || transaction.bankName || ""))
    : isBill
    ? (getBillerLogo(transaction.network || transaction.billerName || transaction.billerCode || "") || getBillerLogo(desc))
    : (getBankLogo(transaction.beneficiaryBankName || transaction.bankName || "") || getBankLogo(desc));

  const logoUrl = matchedLogo || config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png";

  // PDF Export
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Generating PDF receipt...");

      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF("p", "mm", "a4");
      const imgWidth = 190;
      const pageHeight = 295;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let heightLeft = imgHeight;
      let position = 10;

      pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft >= 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Receipt_${transaction.reference}.pdf`);
      toast.dismiss();
      toast.success("PDF Receipt downloaded!");
    } catch (err) {
      console.error("PDF generation failed:", err);
      toast.dismiss();
      toast.error("Failed to generate PDF.");
    } finally {
      setGenerating(false);
    }
  };

  // Image Export
  const handleDownloadImage = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Generating PNG image...");

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 3,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      const imgData = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.href = imgData;
      link.download = `Receipt_${transaction.reference}.png`;
      link.click();

      toast.dismiss();
      toast.success("Image downloaded!");
    } catch (err) {
      console.error("Image generation failed:", err);
      toast.dismiss();
      toast.error("Failed to generate image.");
    } finally {
      setGenerating(false);
    }
  };

  // Share Receipt
  const handleShareReceipt = async () => {
    if (!receiptRef.current) return;
    try {
      setGenerating(true);
      toast.loading("Preparing receipt for sharing...");

      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#FFFFFF",
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          toast.dismiss();
          toast.error("Failed to compile receipt.");
          return;
        }

        const file = new File([blob], `Receipt_${transaction.reference}.png`, { type: "image/png" });

        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
          toast.dismiss();
          await navigator.share({
            files: [file],
            title: "Transaction Receipt",
            text: `Transaction Receipt - ${transaction.reference}`,
          });
        } else {
          toast.dismiss();
          const imgData = canvas.toDataURL("image/png");
          const link = document.createElement("a");
          link.href = imgData;
          link.download = `Receipt_${transaction.reference}.png`;
          link.click();
          toast.success("Downloaded receipt to device.");
        }
      }, "image/png");
    } catch (err) {
      console.error("Share failed:", err);
      toast.dismiss();
      toast.error("Failed to share receipt.");
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
        {/* Sticky Header */}
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

        {/* Scrollable Receipt Canvas */}
        <div className="flex-1 overflow-y-auto p-margin-mobile flex flex-col items-center custom-scrollbar pb-28">
          <div
            ref={receiptRef}
            className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-sm flex flex-col space-y-5 text-black"
          >
            {/* Header / Logo */}
            <div className="text-center border-b border-dashed border-gray-200 pb-5 space-y-3">
              <div className="relative w-14 h-14 mx-auto bg-gray-50 rounded-full border border-gray-100 p-1 flex items-center justify-center overflow-hidden">
                <Image
                  src={logoUrl}
                  alt="Receipt Logo"
                  fill
                  className="object-contain p-1.5"
                />
              </div>

              <div>
                <p className="font-hanken font-extrabold text-[10.5px] uppercase tracking-widest text-gray-400">
                  E-TECH GLOBAL HUB
                </p>
                <h2 className="font-hanken font-bold text-sm text-gray-800 leading-snug mt-0.5">
                  {isSwap
                    ? "Currency Exchange Swap"
                    : isDeposit
                    ? (transaction.senderName ? `Transfer From ${transaction.senderName}` : "Transfer From Virtual Account")
                    : isTransfer
                    ? (`Transfer To ${transaction.beneficiaryName || transaction.recipientName || "Beneficiary"}`)
                    : isAirtime
                    ? "Airtime Top-up"
                    : isData
                    ? "Data Bundle Recharge"
                    : isElectricity
                    ? "Electricity Utility Tokens"
                    : isCable
                    ? "Cable TV Subscription"
                    : isWaec
                    ? "WAEC Scratch Card Pin"
                    : isStore
                    ? "Store Order Payment"
                    : "Payment Transaction"}
                </h2>
                <h1 className="font-mono text-3xl font-black text-black tracking-tight mt-1">
                  {currencySymbol}
                  {transaction.amount.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </h1>
              </div>

              {/* Status Badge */}
              <div className="flex items-center justify-center gap-1.5 text-xs font-bold leading-none">
                {normalizedStatus === "SUCCESS" ? (
                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-3.5 py-1.5 rounded-full border border-emerald-100">
                    <span className="material-symbols-outlined text-sm font-bold">check_circle</span>
                    <span>Successful</span>
                  </div>
                ) : normalizedStatus === "REFUND" ? (
                  <div className="flex items-center gap-1 text-blue-600 bg-blue-50 px-3.5 py-1.5 rounded-full border border-blue-100">
                    <span className="material-symbols-outlined text-sm font-bold">keyboard_backup_api</span>
                    <span>Refunded</span>
                  </div>
                ) : normalizedStatus === "PENDING" ? (
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

            {/* Type-Aware Structured Details */}
            <div className="space-y-4">
              <h3 className="font-hanken font-extrabold text-[10.5px] text-gray-400 uppercase tracking-widest leading-none">
                Payment Specifications
              </h3>

              <div className="space-y-3 text-xs">
                {/* 1. BANK TRANSFER */}
                {isTransfer && (
                  <>
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Transfer To</span>
                      <span className="text-black font-bold uppercase text-right max-w-[200px] truncate">
                        {transaction.beneficiaryName || transaction.recipientName || "Not available"}
                      </span>
                    </div>

                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Recipient Details</span>
                      <div className="flex flex-col items-end text-right max-w-[220px]">
                        <span className="text-black font-bold uppercase">
                          {transaction.beneficiaryName || transaction.recipientName || "Not available"}
                        </span>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <BankLogoResolver
                            bankName={transaction.beneficiaryBankName || transaction.recipientBankName || transaction.bankName}
                            bankCode={transaction.beneficiaryBankCode}
                            className="w-5 h-5"
                          />
                          <span className="text-gray-900 font-extrabold text-[11.5px]">
                            {transaction.beneficiaryBankName || transaction.recipientBankName || transaction.bankName || "Bank"}
                          </span>
                        </div>
                        {(transaction.beneficiaryAccountNumber || transaction.recipientAccountNumber) && (
                          <span className="font-mono text-gray-600 font-bold text-[11px] mt-0.5">
                            Account: {transaction.beneficiaryAccountNumber || transaction.recipientAccountNumber}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Category</span>
                      <span className="text-black font-bold">Transfer</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Amount</span>
                      <span className="text-black font-bold">{currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Transfer Fee</span>
                      <span className="text-black font-bold">{currencySymbol}{fee.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {vat > 0 && (
                      <div className="flex justify-between items-center text-gray-500 font-semibold">
                        <span>VAT</span>
                        <span className="text-black font-bold">{currencySymbol}{vat.toFixed(2)}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center border-t border-gray-100 pt-2 text-gray-500 font-semibold">
                      <span>Total Debited</span>
                      <span className="text-black font-bold text-sm">{currencySymbol}{totalDebited.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {/* 2. AIRTIME & DATA */}
                {(isAirtime || isData) && (
                  <>
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Network Provider</span>
                      <span className="text-black font-bold uppercase">{transaction.network || transaction.billerName || "Not available"}</span>
                    </div>

                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Mobile Number</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-black font-bold">
                          {transaction.phoneNumber || transaction.customerId || "Not available"}
                        </span>
                        {(transaction.phoneNumber || transaction.customerId) && (
                          <button
                            type="button"
                            onClick={() => handleCopy(transaction.phoneNumber || transaction.customerId!, "Phone number")}
                            className="text-[#FC7A00]"
                          >
                            <span className="material-symbols-outlined text-[12px] font-bold">content_copy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {isData && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Data Plan</span>
                        <span className="text-black font-bold text-right max-w-[180px] truncate">
                          {transaction.planName || transaction.itemName || "Data Package"}
                        </span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Amount</span>
                      <span className="text-black font-bold">{currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {/* 3. ELECTRICITY */}
                {isElectricity && (
                  <>
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>DISCO Operator</span>
                      <span className="text-black font-bold uppercase">{transaction.billerName || "Electricity Provider"}</span>
                    </div>

                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Meter Number</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-black font-bold">
                          {transaction.meterNumber || transaction.customerId || "Not available"}
                        </span>
                        {(transaction.meterNumber || transaction.customerId) && (
                          <button
                            type="button"
                            onClick={() => handleCopy(transaction.meterNumber || transaction.customerId!, "Meter number")}
                            className="text-[#FC7A00]"
                          >
                            <span className="material-symbols-outlined text-[12px] font-bold">content_copy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {transaction.customerName && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Customer Name</span>
                        <span className="text-black font-bold text-right uppercase">{transaction.customerName}</span>
                      </div>
                    )}

                    {transaction.token && (
                      <div className="p-3 bg-amber-50 border border-amber-200/60 rounded-2xl space-y-1 my-1">
                        <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider block">Meter Token Code</span>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm font-black text-black tracking-widest">{transaction.token}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(transaction.token!, "Meter token")}
                            className="text-[#FC7A00] hover:brightness-90 active:scale-90"
                          >
                            <span className="material-symbols-outlined text-sm font-bold">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Amount Paid</span>
                      <span className="text-black font-bold">{currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {/* 4. CABLE TV */}
                {isCable && (
                  <>
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Cable Operator</span>
                      <span className="text-black font-bold uppercase">{transaction.billerName || "Cable Provider"}</span>
                    </div>

                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Smartcard / UIC Number</span>
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-black font-bold">
                          {transaction.smartcardNumber || transaction.customerId || "Not available"}
                        </span>
                        {(transaction.smartcardNumber || transaction.customerId) && (
                          <button
                            type="button"
                            onClick={() => handleCopy(transaction.smartcardNumber || transaction.customerId!, "Smartcard number")}
                            className="text-[#FC7A00]"
                          >
                            <span className="material-symbols-outlined text-[12px] font-bold">content_copy</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {transaction.packageName && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Package Plan</span>
                        <span className="text-black font-bold text-right">{transaction.packageName}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Subscription Fee</span>
                      <span className="text-black font-bold">{currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {/* 5. CURRENCY SWAP */}
                {isSwap && (
                  <>
                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Source Exchange</span>
                      <span className="text-black font-bold">{transaction.sourceCurrency || "NGN"} {transaction.sourceAmount?.toLocaleString() || transaction.amount.toLocaleString()}</span>
                    </div>

                    {transaction.exchangeRate && (
                      <div className="flex justify-between items-center text-gray-500 font-semibold">
                        <span>Applied Rate</span>
                        <span className="text-black font-bold font-mono">1 {transaction.sourceCurrency} = {transaction.exchangeRate} {transaction.destinationCurrency}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Destination Yield</span>
                      <span className="text-emerald-600 font-extrabold">{transaction.destinationCurrency || "USD"} {transaction.destinationAmount?.toLocaleString() || "Not available"}</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Swap Processing Fee</span>
                      <span className="text-black font-bold">{currencySymbol}{fee.toLocaleString()}</span>
                    </div>
                  </>
                )}

                {/* 6. DEPOSIT */}
                {isDeposit && (
                  <>
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Transfer From</span>
                      <span className="text-black font-bold uppercase text-right max-w-[200px] truncate">
                        {transaction.senderName || "Bank Transfer"}
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Credited to</span>
                      <span className="text-black font-bold">Available Balance</span>
                    </div>

                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Funding Method</span>
                      <span className="text-black font-bold">Your bank Account</span>
                    </div>

                    {(transaction.senderName || transaction.senderBankName || transaction.senderAccountNumber) && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Sender Details</span>
                        <div className="flex flex-col items-end text-right max-w-[220px]">
                          {transaction.senderName && (
                            <span className="text-black font-bold uppercase">
                              {transaction.senderName}
                            </span>
                          )}
                          {transaction.senderBankName && (
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <BankLogoResolver
                                bankName={transaction.senderBankName}
                                className="w-5 h-5"
                              />
                              <span className="text-gray-900 font-extrabold text-[11.5px]">
                                {transaction.senderBankName}
                              </span>
                            </div>
                          )}
                          {transaction.senderAccountNumber && (
                            <span className="font-mono text-gray-600 font-bold text-[11px] mt-0.5">
                              Account: {transaction.senderAccountNumber}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {transaction.virtualAccountNumber && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Virtual Account Number</span>
                        <div className="flex items-center gap-1">
                          <span className="font-mono text-black font-bold">{transaction.virtualAccountNumber}</span>
                          <button
                            type="button"
                            onClick={() => handleCopy(transaction.virtualAccountNumber!, "Virtual account number")}
                            className="text-[#FC7A00]"
                          >
                            <span className="material-symbols-outlined text-[12px] font-bold">content_copy</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {transaction.virtualAccountBankName && (
                      <div className="flex justify-between items-start text-gray-500 font-semibold">
                        <span>Virtual Account Bank</span>
                        <span className="text-black font-bold">{transaction.virtualAccountBankName}</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center text-gray-500 font-semibold border-t border-gray-100 pt-2">
                      <span>Credited Amount</span>
                      <span className="text-emerald-600 font-extrabold">{currencySymbol}{transaction.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  </>
                )}

                {/* UNIFIED METADATA */}
                <div className="border-t border-gray-100 pt-3 space-y-3">
                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Transaction Number</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-black font-bold uppercase text-[11px]">
                        {transaction.reference}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopy(transaction.reference, "Transaction number")}
                        className="text-[#FC7A00] hover:brightness-90 active:scale-90"
                      >
                        <span className="material-symbols-outlined text-[13px] font-bold">content_copy</span>
                      </button>
                    </div>
                  </div>

                  {transaction.providerReference && (
                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>Provider Reference</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-black font-bold uppercase text-[11px] truncate max-w-[140px]">
                          {transaction.providerReference}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(transaction.providerReference!, "Provider reference")}
                          className="text-[#FC7A00] hover:brightness-90 active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[13px] font-bold">content_copy</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {transaction.sessionId && (
                    <div className="flex justify-between items-center text-gray-500 font-semibold">
                      <span>NIBSS Session ID</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-black font-bold uppercase text-[11px] truncate max-w-[140px]">
                          {transaction.sessionId}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopy(transaction.sessionId!, "Session ID")}
                          className="text-[#FC7A00] hover:brightness-90 active:scale-90"
                        >
                          <span className="material-symbols-outlined text-[13px] font-bold">content_copy</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Transaction Date</span>
                    <span className="text-black font-bold text-right">
                      {transaction.date} {transaction.time}
                    </span>
                  </div>

                  {transaction.narration && (
                    <div className="flex justify-between items-start text-gray-500 font-semibold">
                      <span>Narration</span>
                      <span className="text-black font-bold text-right max-w-[180px] truncate">{transaction.narration}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-center text-gray-500 font-semibold">
                    <span>Provider Channel</span>
                    <span className="text-black font-bold">{transaction.provider || "E-Tech Gateway"}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
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

        {/* Action Buttons Panel */}
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
