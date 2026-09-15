"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { db } from "@/lib/firebase";
import { collection, query, where, orderBy, getDocs } from "firebase/firestore";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Transaction } from "@/components/wallet/TransactionReceipt";
import { formatTransactionDateTime } from "@/lib/date-utils";
import { isCreditTransaction, getTransactionDisplayAmount } from "@/lib/transaction-status-normalizer";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface StatementModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Helper to load image as HTMLImageElement
const loadImage = (url: string): Promise<HTMLImageElement | null> => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

export const StatementModal: React.FC<StatementModalProps> = ({ isOpen, onClose }) => {
  const { user, userData } = useAuth();
  const { config } = useAppConfig();

  // Intercept hardware and browser back button presses to close full-screen modal cleanly
  useModalBackHandler(isOpen, onClose, "statement-modal-drawer");

  // Default dates: From 1 month ago to today
  const todayStr = new Date().toISOString().split("T")[0];
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
  const oneMonthAgoStr = oneMonthAgo.toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState<string>(oneMonthAgoStr);
  const [toDate, setToDate] = useState<string>(todayStr);
  const [deliveryMethod, setDeliveryMethod] = useState<"download" | "email">("download");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);

  if (!isOpen) return null;

  const validateDates = (): { valid: boolean; startIso: string; endIso: string } => {
    if (!fromDate || !toDate) {
      toast.error("Please select both From Date and To Date.");
      return { valid: false, startIso: "", endIso: "" };
    }

    const start = new Date(fromDate + "T00:00:00.000Z");
    const end = new Date(toDate + "T23:59:59.999Z");

    if (start > end) {
      toast.error("From Date cannot be later than To Date.");
      return { valid: false, startIso: "", endIso: "" };
    }

    // Enforce max 6-month range constraint (~183 days)
    const sixMonthsInMs = 183 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > sixMonthsInMs) {
      toast.error("Statements are limited to a maximum range of 6 months at a time.");
      return { valid: false, startIso: "", endIso: "" };
    }

    return { valid: true, startIso: start.toISOString(), endIso: end.toISOString() };
  };

  const handleGenerate = async () => {
    const { valid, startIso, endIso } = validateDates();
    if (!valid || !user) return;

    setIsGenerating(true);
    toast.loading(deliveryMethod === "download" ? "Generating PDF Bank Statement..." : "Sending Statement to Email...", { id: "statement-gen" });

    try {
      if (deliveryMethod === "download") {
        // Fetch client-side Firestore transactions
        const q = query(
          collection(db, "transactions"),
          where("userId", "==", user.uid),
          where("createdAt", ">=", startIso),
          where("createdAt", "<=", endIso),
          orderBy("createdAt", "desc")
        );

        const snap = await getDocs(q);
        const txList: Transaction[] = [];
        snap.forEach((d) => {
          txList.push({ ...d.data() } as Transaction);
        });

        if (txList.length === 0) {
          toast.dismiss("statement-gen");
          toast.info("No transactions found for the selected date range.");
          setIsGenerating(false);
          return;
        }

        const userName = userData?.name || user.displayName || "E-Global Pay Customer";
        const userEmail = userData?.email || user.email || "";

        // Resolve images and watermark configs for PDF statement
        const statementLogoUrl = config.statementLogoUrl || config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png";
        const signatureUrl = config.statementSignatureUrl || "";
        const stampUrl = config.statementStampUrl || "";
        const watermarkUrl = config.statementWatermarkUrl || "";
        const watermarkSize = config.statementWatermarkSize || 100;
        const watermarkOpacity = config.statementWatermarkOpacity ?? 0.15;

        const [logoImg, sigImg, stampImg, watermarkImg] = await Promise.all([
          loadImage(statementLogoUrl),
          loadImage(signatureUrl),
          loadImage(stampUrl),
          loadImage(watermarkUrl),
        ]);

        // Calculate Total Inflow vs Total Outflow
        let totalInflow = 0;
        let totalOutflow = 0;
        txList.forEach((tx) => {
          const displayAmt = getTransactionDisplayAmount(tx);
          if (isCreditTransaction(tx)) totalInflow += displayAmt;
          else totalOutflow += displayAmt;
        });

        // Generate PDF using jsPDF + autoTable
        const doc = new jsPDF({
          orientation: "p",
          unit: "mm",
          format: "a4",
        });

        // Brand Banner Bar
        doc.setFillColor(252, 122, 0); // #FC7A00
        doc.rect(14, 12, 182, 24, "F");

        if (logoImg) {
          try {
            doc.addImage(logoImg, "PNG", 18, 14, 20, 20);
          } catch {}
        }

        doc.setFontSize(16);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text("E-GLOBAL PAY", logoImg ? 42 : 20, 23);

        doc.setFontSize(8);
        doc.setFont("helvetica", "normal");
        doc.text("OFFICIAL ELECTRONIC BANK STATEMENT OF ACCOUNT", logoImg ? 42 : 20, 29);

        // Overview Summary Box
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(14, 40, 182, 28, 3, 3, "F");

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("ACCOUNT HOLDER", 20, 47);
        doc.text("EMAIL", 85, 47);
        doc.text("STATEMENT PERIOD", 145, 47);

        doc.setFontSize(8.5);
        doc.setTextColor(15, 23, 42);
        doc.text(String(userName).slice(0, 32), 20, 53);
        doc.text(String(userEmail).slice(0, 28), 85, 53);
        doc.text(`${fromDate} to ${toDate}`, 145, 53);

        doc.setFontSize(7.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(100, 116, 139);
        doc.text("TOTAL TRANSACTIONS", 20, 60);
        doc.text("TOTAL MONEY IN", 85, 60);
        doc.text("TOTAL MONEY OUT", 145, 60);

        doc.setFontSize(8.5);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(252, 122, 0);
        doc.text(`${txList.length} Record(s)`, 20, 65);

        doc.setTextColor(16, 185, 129);
        doc.text(`+N${totalInflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 85, 65);

        doc.setTextColor(15, 23, 42);
        doc.text(`-N${totalOutflow.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 145, 65);

        // Table Body Data
        const tableBody = txList.map((tx) => {
          const { dateTime } = formatTransactionDateTime(tx.createdAt, tx.date, tx.time);
          const isCredit = isCreditTransaction(tx);
          const displayAmt = getTransactionDisplayAmount(tx);
          const sign = isCredit ? "+" : "-";

          return [
            dateTime,
            String(tx.reference || tx.id || "").slice(0, 20),
            String(tx.description || tx.title || "Transaction"),
            String(tx.type || "PAYMENT").toUpperCase(),
            `${sign}N${displayAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
          ];
        });

        autoTable(doc, {
          startY: 74,
          margin: { left: 14, right: 14, top: 20, bottom: 25 },
          head: [["DATE & TIME", "REFERENCE", "DESCRIPTION", "TYPE", "AMOUNT (NGN)"]],
          body: tableBody,
          headStyles: {
            fillColor: [252, 122, 0], // #FC7A00
            textColor: [255, 255, 255],
            fontStyle: "bold",
            fontSize: 8,
            halign: "left",
          },
          bodyStyles: {
            fontSize: 7.5,
            textColor: [15, 23, 42],
            cellPadding: 3,
          },
          alternateRowStyles: {
            fillColor: [248, 250, 252],
          },
          columnStyles: {
            0: { cellWidth: 32 },
            1: { cellWidth: 32, fontStyle: "bold" },
            2: { cellWidth: 62 },
            3: { cellWidth: 22, fontStyle: "bold" },
            4: { cellWidth: 34, halign: "right", fontStyle: "bold" },
          },
          didParseCell: (data) => {
            if (data.section === "body" && data.column.index === 4) {
              const rawVal = String(data.cell.raw || "");
              const isCredit = rawVal.startsWith("+");
              data.cell.styles.textColor = isCredit ? [16, 185, 129] : [15, 23, 42];
            }
          },
          didDrawPage: () => {
            if (watermarkImg) {
              try {
                const naturalWidth = watermarkImg.naturalWidth || watermarkImg.width || 100;
                const naturalHeight = watermarkImg.naturalHeight || watermarkImg.height || 100;
                const aspectRatio = naturalHeight / naturalWidth;

                let w = watermarkSize;
                let h = watermarkSize * aspectRatio;
                if (h > 240) {
                  h = 240;
                  w = 240 / aspectRatio;
                }
                const x = (210 - w) / 2;
                const y = (297 - h) / 2;

                doc.saveGraphicsState();
                const gState = new (doc as any).GState({ opacity: watermarkOpacity });
                doc.setGState(gState);
                doc.addImage(watermarkImg, "PNG", x, y, w, h);
                doc.restoreGraphicsState();
              } catch (err) {
                console.warn("[Statement Watermark Render Warning]:", err);
              }
            }
          },
        });

        let finalY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 10 : 200;

        if (finalY > 250) {
          doc.addPage();
          finalY = 30;
        }

        // Add Signature & Official Stamp
        if (sigImg || stampImg) {
          doc.setDrawColor(226, 232, 240);
          doc.line(14, finalY, 196, finalY);
          finalY += 6;

          if (sigImg) {
            try {
              doc.setFontSize(7.5);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(100, 116, 139);
              doc.text("AUTHORIZED SIGNATORY", 16, finalY);
              doc.addImage(sigImg, "PNG", 16, finalY + 2, 35, 16);
            } catch {}
          }

          if (stampImg) {
            try {
              doc.setFontSize(7.5);
              doc.setFont("helvetica", "bold");
              doc.setTextColor(100, 116, 139);
              doc.text("OFFICIAL STAMP", 148, finalY);
              doc.addImage(stampImg, "PNG", 148, finalY + 2, 24, 24);
            } catch {}
          }
        }

        // Add Page Numbers
        const totalPages = (doc as any).internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(7);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(148, 163, 184);
          doc.text("Official E-Global Pay Automated Electronic Bank Statement • Confidential", 14, 288);
          doc.text(`Page ${i} of ${totalPages}`, 196, 288, { align: "right" });
        }

        doc.save(`EGlobalPay_Statement_${fromDate}_to_${toDate}.pdf`);
        toast.dismiss("statement-gen");
        toast.success("Bank Statement PDF generated and downloaded successfully!");
        onClose();
      } else {
        // Call S2S API route to dispatch statement to user email
        let idToken = "";
        if (user && typeof user.getIdToken === "function") {
          idToken = await user.getIdToken();
        }

        const res = await fetch("/api/history/statement/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
          },
          body: JSON.stringify({ fromDate, toDate }),
        });

        const data = await res.json();
        toast.dismiss("statement-gen");

        if (res.ok && data.success) {
          toast.success(data.message || "Statement of Account sent to your email!");
          onClose();
        } else {
          toast.error(data.error || "Failed to dispatch email statement.");
        }
      }
    } catch (err: any) {
      console.error("[Generate Statement Error]:", err);
      toast.dismiss("statement-gen");
      toast.error("Failed to generate statement: " + (err.message || "Unknown error"));
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] bg-white flex flex-col justify-between overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 350 }}
            className="w-full h-full flex flex-col text-black max-w-md mx-auto overflow-hidden will-change-transform"
          >
            {/* Drawer Top Header Bar */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0 border-b border-gray-100 bg-white/95 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] flex-shrink-0">
                  <span className="material-symbols-outlined text-[20px]">description</span>
                </div>
                <div>
                  <h2 className="font-hanken font-extrabold text-base text-black uppercase tracking-wide">
                    Statement of Account
                  </h2>
                  <p className="font-hanken text-[9.5px] text-gray-400 font-bold uppercase tracking-widest">
                    Generate Financial Records
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-colors cursor-pointer border-0 flex-shrink-0"
                title="Close"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Main Full-Screen Form Container */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              {/* Brand Banner Card */}
              <div className="p-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] rounded-2xl text-white shadow-sm flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">E-Global Pay</h3>
                  <p className="text-[10.5px] opacity-90 font-medium">Official Electronic Bank Statements</p>
                </div>
                <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                  <span className="material-symbols-outlined text-white text-[24px]">description</span>
                </div>
              </div>

              {/* 6-Month Constraint Guidance Note */}
              <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-3">
                <span className="material-symbols-outlined text-amber-600 text-[20px] shrink-0 mt-0.5">info</span>
                <p className="font-hanken text-xs text-amber-900 leading-snug">
                  Statements can be generated for up to <strong>6 months</strong> of transaction history per request.
                </p>
              </div>

              {/* Date Selection Grid */}
              <div className="space-y-3.5">
                <div>
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    value={fromDate}
                    max={todayStr}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold text-black outline-none focus:border-[#FC7A00]"
                  />
                </div>

                <div>
                  <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 block mb-1">
                    To Date *
                  </label>
                  <input
                    type="date"
                    value={toDate}
                    max={todayStr}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-xs font-bold text-black outline-none focus:border-[#FC7A00]"
                  />
                </div>
              </div>

              {/* Delivery Option Selector */}
              <div className="space-y-2">
                <label className="text-[10.5px] font-black uppercase tracking-wider text-gray-500 block">
                  Delivery Format / Action
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("download")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      deliveryMethod === "download"
                        ? "border-[#FC7A00] bg-orange-50/90 text-black font-extrabold shadow-3xs"
                        : "border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">picture_as_pdf</span>
                      {deliveryMethod === "download" && (
                        <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-xs uppercase font-extrabold block">PDF Download</span>
                      <span className="text-[9.5px] text-gray-400 font-semibold block">Save file to device</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeliveryMethod("email")}
                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                      deliveryMethod === "email"
                        ? "border-[#FC7A00] bg-orange-50/90 text-black font-extrabold shadow-3xs"
                        : "border-gray-200 bg-white text-gray-600 font-bold hover:bg-gray-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">mail</span>
                      {deliveryMethod === "email" && (
                        <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">check_circle</span>
                      )}
                    </div>
                    <div className="mt-2">
                      <span className="text-xs uppercase font-extrabold block">Send to Email</span>
                      <span className="text-[9.5px] text-gray-400 font-semibold block">Deliver to registered inbox</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Bottom Action Footer */}
            <div className="p-5 border-t border-gray-100 bg-white shadow-lg flex-shrink-0">
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerate}
                className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 border-0"
              >
                {isGenerating ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Processing Statement...</span>
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined text-[18px]">
                      {deliveryMethod === "download" ? "download" : "send"}
                    </span>
                    <span>{deliveryMethod === "download" ? "Download PDF Statement" : "Send Statement to Email"}</span>
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
