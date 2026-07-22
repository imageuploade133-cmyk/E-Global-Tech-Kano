"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toPng, toJpeg } from "html-to-image";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

interface TransferConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transferData: {
    amount: number;
    recipientName: string;
    bankName: string;
    bankCode: string;
    accountNumber: string;
    narration?: string;
    isBulk?: boolean;
    recipientsCount?: number;
    recipients?: Array<{
      accountNumber: string;
      bankId: string;
      bankName: string;
      recipientName: string;
      amount: number;
    }>;
  };
  balance: number;
  onSuccess?: (reference: string) => void;
}

export const TransferConfirmationModal: React.FC<TransferConfirmationModalProps> = ({
  isOpen,
  onClose,
  transferData,
  balance,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [step, setTrfStep] = useState<"summary" | "pin" | "loading" | "receipt">("summary");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [, setIsProcessing] = useState(false);
  const [transferResult, setTransferResult] = useState<{
    success: boolean;
    message: string;
    reference: string;
    date: string;
    time: string;
  } | null>(null);

  const receiptRef = useRef<HTMLDivElement>(null);

  // Constants
  const flatFee = 10.00;
  const isBulkMode = !!transferData.isBulk;
  const totalAmount = isBulkMode
    ? (transferData.recipients || []).reduce((sum, r) => sum + r.amount, 0)
    : transferData.amount;
  const fee = isBulkMode
    ? (transferData.recipients || []).length * flatFee
    : flatFee;
  const totalDebit = totalAmount + fee;

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setTrfStep("summary");
      setPin("");
      setPinError("");
      setIsProcessing(false);
      setTransferResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Process actual outward transfer with Next.js backend
  const handleExecuteTransfer = async (completedPin: string) => {
    setIsProcessing(true);
    setTrfStep("loading");
    setPinError("");

    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const endpoint = isBulkMode ? "/api/flutterwave/bulk-transfer" : "/api/flutterwave/transfer";
      const transferReference = isBulkMode
        ? `bulk-${Date.now()}-${user?.uid?.slice(-6) || "guest"}`
        : `trf-${Date.now()}-${user?.uid?.slice(-6) || "guest"}`;

      const payload = isBulkMode
        ? {
            title: "Staff December Settlement",
            recipients: transferData.recipients,
            pin: completedPin,
            reference: transferReference,
          }
        : {
            amount: transferData.amount,
            account_number: transferData.accountNumber,
            accountNumber: transferData.accountNumber,
            account_bank: transferData.bankCode,
            accountBank: transferData.bankCode,
            bankCode: transferData.bankCode,
            account_name: transferData.recipientName,
            accountName: transferData.recipientName,
            currency: "NGN",
            narration: transferData.narration || `Direct outward transfer to ${transferData.recipientName}`,
            recipientName: transferData.recipientName,
            recipientAccount: transferData.accountNumber,
            reference: transferReference,
            pin: completedPin,
          };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const now = new Date();
        const formattedDate = now.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        const formattedTime = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

        setTransferResult({
          success: true,
          message: isBulkMode
            ? `Your bulk transfer of ${(transferData.recipients || []).length} recipients has been successfully processed!`
            : `Your outward bank transfer has been initiated successfully! ₦${transferData.amount.toLocaleString()} is being settled to ${transferData.recipientName}.`,
          reference: data.reference || transferReference,
          date: formattedDate,
          time: formattedTime,
        });

        setTrfStep("receipt");
        toast.success("Transfer completed successfully!");
      } else {
        setPin("");
        const backendErr = data.error || data.message || "Transfer failed. Please check details or PIN.";
        setPinError(backendErr);
        setTrfStep("pin");
        toast.error(backendErr);
      }
    } catch (err: unknown) {
      setPin("");
      const error = err as Error;
      const errMsg = error.message || "Internal connection error during transfer.";
      setPinError(errMsg);
      setTrfStep("pin");
      toast.error(errMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // PIN Press Handler
  const handlePinPress = (num: string) => {
    setPinError("");
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);
      if (nextPin.length === 4) {
        // Shorter delay before processing to feel snappy
        setTimeout(() => {
          handleExecuteTransfer(nextPin);
        }, 150);
      }
    }
  };

  const handlePinDelete = () => {
    setPin(pin.slice(0, -1));
  };

  // Receipt Exporters
  const downloadReceiptAsImage = async (format: "png" | "jpeg" = "png") => {
    if (!receiptRef.current) return;
    toast.loading("Generating receipt image...");
    try {
      const exporter = format === "png" ? toPng : toJpeg;
      const dataUrl = await exporter(receiptRef.current, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        style: {
          color: "#000000",
        }
      });
      const link = document.createElement("a");
      link.download = `receipt-${transferResult?.reference || "tx"}.${format}`;
      link.href = dataUrl;
      link.click();
      toast.dismiss();
      toast.success("Receipt downloaded as image!");
    } catch (err) {
      toast.dismiss();
      console.error("Image Export Error:", err);
      toast.error("Failed to generate image receipt.");
    }
  };

  const downloadReceiptAsPDF = async () => {
    if (!receiptRef.current) return;
    toast.loading("Generating PDF document...");
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
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

      pdf.save(`receipt-${transferResult?.reference || "tx"}.pdf`);
      toast.dismiss();
      toast.success("Receipt downloaded as PDF!");
    } catch (err) {
      toast.dismiss();
      console.error("PDF Export Error:", err);
      toast.error("Failed to generate PDF receipt.");
    }
  };

  const shareReceipt = async () => {
    if (typeof window === "undefined" || !navigator.share) {
      toast.error("Native sharing is not supported on this browser.");
      return;
    }

    try {
      await navigator.share({
        title: "Transaction Receipt",
        text: `Transaction Receipt\nReference: ${transferResult?.reference}\nRecipient: ${isBulkMode ? `${(transferData.recipients || []).length} Batch Recipients` : transferData.recipientName}\nAmount: ₦${totalAmount.toLocaleString()}\nDate: ${transferResult?.date} ${transferResult?.time}\nPowered by E-Tech Global Hub`,
        url: window.location.origin,
      });
      toast.success("Receipt shared successfully!");
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name !== "AbortError") {
        toast.error("Failed to share receipt.");
      }
    }
  };

  const copyReceiptToClipboard = () => {
    const text = `Transaction Receipt
Status: SUCCESS
Reference: ${transferResult?.reference}
Recipient: ${isBulkMode ? `${(transferData.recipients || []).length} Batch Recipients` : transferData.recipientName}
Bank: ${isBulkMode ? "Multiple Banks" : transferData.bankName}
Account: ${isBulkMode ? "Multiple Accounts" : transferData.accountNumber}
Amount: ₦${totalAmount.toLocaleString()}
Fee: ₦${fee.toLocaleString()}
Total Debit: ₦${totalDebit.toLocaleString()}
Narration: ${transferData.narration || "N/A"}
Date & Time: ${transferResult?.date} ${transferResult?.time}
Powered by E-Tech Global Hub`;

    navigator.clipboard.writeText(text);
    toast.success("Receipt text copied to clipboard!");
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100005] flex items-center justify-center p-4 font-hanken">
        {/* Backdrop glassmorphic */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={step !== "loading" ? () => {
            if (step === "receipt" && transferResult?.success && onSuccess) {
              onSuccess(transferResult.reference);
            } else {
              onClose();
            }
          } : undefined}
          className="absolute inset-0 bg-black/60 backdrop-blur-sm cursor-pointer"
        />

        {/* Modal Window Container */}
        <motion.div
          initial={{ scale: 0.9, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 20, opacity: 0 }}
          transition={{ type: "spring", damping: 25, stiffness: 350 }}
          className="relative bg-white text-black w-full max-w-md rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-gray-50 to-white">
            <span className="text-[11px] font-black uppercase text-gray-400 tracking-widest">
              {step === "summary" && "Confirm Transfer"}
              {step === "pin" && "Authorize PIN"}
              {step === "loading" && "Securing Connection"}
              {step === "receipt" && "Transaction Receipt"}
            </span>
            {step !== "loading" && (
              <button
                type="button"
                onClick={() => {
                  if (step === "receipt" && transferResult?.success && onSuccess) {
                    onSuccess(transferResult.reference);
                  } else {
                    onClose();
                  }
                }}
                className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-gray-500 text-[18px]">close</span>
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
            {/* 1. Summary Stage */}
            {step === "summary" && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-5"
              >
                <div className="text-center space-y-1 py-2">
                  <span className="text-[10px] font-bold text-[#FC7A00] bg-[#FC7A00]/10 px-2.5 py-1 rounded-full uppercase tracking-wider">
                    {isBulkMode ? "Bulk Settlement Batch" : "Single Secure Settlement"}
                  </span>
                  <p className="text-2xl font-black font-hanken text-black tracking-tight mt-1">
                    ₦{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Outward Transfer Amount</p>
                </div>

                <div className="bg-gray-50 border border-gray-200/60 rounded-2xl p-4.5 space-y-3.5 text-xs font-hanken">
                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Recipient</span>
                    <span className="font-bold text-black text-right max-w-[200px] truncate">
                      {isBulkMode ? `${(transferData.recipients || []).length} Batch Recipients` : transferData.recipientName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Destination Bank</span>
                    <span className="font-bold text-black text-right max-w-[200px] truncate">
                      {isBulkMode ? "Multiple Banks" : transferData.bankName}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Account Number</span>
                    <span className="font-bold text-black font-mono tracking-wider">
                      {isBulkMode ? "Multiple Accounts" : transferData.accountNumber}
                    </span>
                  </div>

                  <hr className="border-dashed border-gray-200 my-1" />

                  <div className="flex items-center justify-between py-0.5">
                    <span className="font-semibold text-gray-400 uppercase text-[9px] tracking-wider">Transfer Fee</span>
                    <span className="font-bold text-black">
                      ₦{fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-0.5 border-t border-gray-100 pt-2.5">
                    <span className="font-black text-gray-400 uppercase text-[9px] tracking-wider">Total Debit</span>
                    <span className="font-black text-lg text-[#FC7A00]">
                      ₦{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Account Balances and Narration */}
                <div className="bg-orange-50/40 border border-orange-100 rounded-2xl p-4.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-500">Narration:</span>
                    <span className="font-medium text-black max-w-[200px] truncate text-right">
                      {transferData.narration || "Direct outward transfer"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pt-1 border-t border-orange-100/60">
                    <span className="font-bold text-gray-500">Available Wallet Balance:</span>
                    <span className="font-bold text-black">
                      ₦{balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                {/* Validation warnings */}
                {totalDebit > balance && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-red-500 text-[18px] shrink-0">warning</span>
                    <p className="text-[11px] font-bold text-red-600 leading-tight">
                      Insufficient wallet balance to cover the transfer amount and fee. Please fund your wallet.
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full py-3.5 border border-gray-200 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-50 transition-all uppercase tracking-widest cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={totalDebit > balance}
                    onClick={() => setTrfStep("pin")}
                    className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black rounded-xl hover:brightness-105 active:scale-98 transition-all uppercase tracking-widest cursor-pointer disabled:opacity-50"
                  >
                    Confirm & Proceed
                  </button>
                </div>
              </motion.div>
            )}

            {/* 2. PIN Stage */}
            {step === "pin" && (
              <motion.div
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="space-y-6 text-center"
              >
                <div className="space-y-1">
                  <span className="material-symbols-outlined text-4xl text-[#FC7A00] mx-auto animate-pulse">lock</span>
                  <h3 className="text-base font-black text-black uppercase tracking-widest mt-1">Transaction PIN</h3>
                  <p className="text-[11px] font-bold text-gray-400 max-w-[280px] mx-auto leading-relaxed mt-0.5">
                    Provide your 4-digit transaction PIN to authenticate and authorize this outward debit settlement.
                  </p>
                </div>

                {/* PIN Dot Indicators */}
                <div className="flex items-center justify-center gap-4.5 py-4">
                  {[0, 1, 2, 3].map((index) => (
                    <motion.div
                      key={index}
                      animate={{
                        scale: pin.length > index ? [1, 1.2, 1] : 1,
                        backgroundColor: pin.length > index ? "#FC7A00" : "#E2E8F0",
                      }}
                      transition={{ duration: 0.15 }}
                      className="w-4.5 h-4.5 rounded-full border border-gray-100 shadow-inner"
                    />
                  ))}
                </div>

                {/* Pin Error */}
                {pinError && (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-[11px] font-bold text-red-600 leading-snug"
                  >
                    {pinError}
                  </motion.div>
                )}

                {/* Circular Shuffled-Style Keypad */}
                <div className="max-w-[280px] mx-auto grid grid-cols-3 gap-y-3.5 gap-x-4 pt-2">
                  {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPress(num)}
                      className="w-14 h-14 rounded-full border border-gray-200/80 bg-white font-hanken text-lg font-black text-black hover:bg-gray-100 hover:border-gray-300 active:scale-95 transition-all flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPin("")}
                    className="w-14 h-14 rounded-full border border-transparent font-hanken text-[10px] font-black uppercase text-red-500 tracking-wider hover:bg-red-50 active:scale-95 transition-all flex items-center justify-center mx-auto cursor-pointer"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPress("0")}
                    className="w-14 h-14 rounded-full border border-gray-200/80 bg-white font-hanken text-lg font-black text-black hover:bg-gray-100 hover:border-gray-300 active:scale-95 transition-all flex items-center justify-center mx-auto cursor-pointer shadow-sm"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="w-14 h-14 rounded-full border border-transparent font-hanken text-lg font-bold text-gray-500 hover:bg-gray-100 active:scale-95 transition-all flex items-center justify-center mx-auto cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[20px]">backspace</span>
                  </button>
                </div>

                {/* Keyboard Fallback Inputs for Desktop Accessibility */}
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setPin(val);
                    if (val.length === 4) handleExecuteTransfer(val);
                  }}
                  className="sr-only"
                  autoFocus
                />

                <div className="pt-2 border-t border-gray-100 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setPin("");
                      setTrfStep("summary");
                    }}
                    className="flex-1 py-3 bg-gray-50 border border-gray-100 rounded-xl text-xs font-bold text-gray-500 hover:bg-gray-100 transition-all uppercase tracking-widest cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={pin.length < 4}
                    onClick={() => handleExecuteTransfer(pin)}
                    className="flex-1 py-3 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black rounded-xl hover:brightness-105 active:scale-98 transition-all uppercase tracking-widest cursor-pointer disabled:opacity-50"
                  >
                    Verify PIN
                  </button>
                </div>
              </motion.div>
            )}

            {/* 3. Loading Stage */}
            {step === "loading" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-12 text-center space-y-6 flex flex-col items-center justify-center"
              >
                <div className="relative w-20 h-20 flex items-center justify-center">
                  {/* Premium spinning gradient ring */}
                  <div className="absolute inset-0 rounded-full border-4 border-gray-100" />
                  <div className="absolute inset-0 rounded-full border-4 border-t-[#FC7A00] border-r-[#FC7A00] animate-spin" />
                  <span className="material-symbols-outlined text-4xl text-[#FC7A00] animate-pulse">lock_open</span>
                </div>
                <div className="space-y-1 max-w-[280px]">
                  <h3 className="text-sm font-black text-black uppercase tracking-widest animate-pulse">Processing Transaction</h3>
                  <p className="text-[11px] font-medium text-gray-400 leading-normal">
                    Authorizing cryptographic signature keys, validating wallet ledger entries, and executing secure dispatch connection to the banking network...
                  </p>
                </div>
              </motion.div>
            )}

            {/* 4. Receipt Stage */}
            {step === "receipt" && transferResult && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {/* Printable Receipt Block (Captured as Image/PDF) */}
                <div
                  ref={receiptRef}
                  className="bg-white border border-gray-100 p-5 rounded-2xl shadow-inner space-y-5 text-black"
                  style={{ fontFamily: "'Inter', sans-serif" }}
                >
                  <div className="text-center space-y-2.5 pb-4 border-b border-gray-100">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto shadow-inner">
                      <span className="material-symbols-outlined text-2xl font-bold">check_circle</span>
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Transaction Successful</p>
                      <p className="text-2xl font-black font-hanken text-black tracking-tight">
                        ₦{totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3.5 text-xs">
                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Transaction Type</span>
                      <span className="font-bold text-black uppercase">Outward Bank Transfer</span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Recipient Name</span>
                      <span className="font-bold text-black text-right max-w-[200px] truncate">
                        {isBulkMode ? `${(transferData.recipients || []).length} Batch Recipients` : transferData.recipientName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Destination Bank</span>
                      <span className="font-bold text-black">
                        {isBulkMode ? "Multiple Banks" : transferData.bankName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Account Number</span>
                      <span className="font-mono font-bold text-black">
                        {isBulkMode ? "Multiple Accounts" : transferData.accountNumber}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Transfer Fee</span>
                      <span className="font-bold text-black">
                        ₦{fee.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Total Debit</span>
                      <span className="font-bold text-black">
                        ₦{totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Narration</span>
                      <span className="font-medium text-black max-w-[180px] truncate text-right">
                        {transferData.narration || "N/A"}
                      </span>
                    </div>

                    <hr className="border-gray-100 my-1.5" />

                    <div className="flex items-start justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider mt-0.5">Reference ID</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="font-mono text-[10px] font-bold text-black">{transferResult.reference}</span>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(transferResult.reference);
                            toast.success("Reference copied!");
                          }}
                          className="p-1 hover:bg-gray-100 rounded cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-gray-400 text-[14px]">content_copy</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between py-0.5">
                      <span className="text-gray-400 font-semibold uppercase text-[9px] tracking-wider">Date & Time</span>
                      <span className="font-bold text-black">
                        {transferResult.date} • {transferResult.time}
                      </span>
                    </div>
                  </div>

                  <div className="text-center pt-3 border-t border-gray-100">
                    <p className="text-[10px] font-black uppercase text-[#FC7A00] tracking-widest font-hanken">E-Tech Global Wallet</p>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Enterprise Secured Ledger</p>
                  </div>
                </div>

                {/* Exporters and Sharing Drawer */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => downloadReceiptAsImage("png")}
                      className="py-3 px-2.5 bg-gray-50 hover:bg-gray-100 text-black border border-gray-200/60 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-gray-500">image</span>
                      Download PNG
                    </button>
                    <button
                      type="button"
                      onClick={downloadReceiptAsPDF}
                      className="py-3 px-2.5 bg-gray-50 hover:bg-gray-100 text-black border border-gray-200/60 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-gray-500">picture_as_pdf</span>
                      Download PDF
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={shareReceipt}
                      className="py-3 px-2.5 bg-orange-50 hover:bg-orange-100/60 text-[#FC7A00] border border-orange-100 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">share</span>
                      Share Receipt
                    </button>
                    <button
                      type="button"
                      onClick={copyReceiptToClipboard}
                      className="py-3 px-2.5 bg-gray-50 hover:bg-gray-100 text-black border border-gray-200/60 rounded-xl text-[11px] font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                    >
                      <span className="material-symbols-outlined text-[16px] text-gray-500">content_copy</span>
                      Copy Receipt
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (onSuccess && transferResult?.success) {
                        onSuccess(transferResult.reference);
                      } else {
                        onClose();
                      }
                    }}
                    className="w-full py-4 bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl hover:bg-neutral-900 active:scale-98 transition-all cursor-pointer shadow-md"
                  >
                    Close & Finish
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
