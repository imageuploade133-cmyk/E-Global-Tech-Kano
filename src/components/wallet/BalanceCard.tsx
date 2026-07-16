"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";

interface BalanceCardProps {
  balance: number;
  currency: string;
  userName?: string;
}

export const BalanceCard: React.FC<BalanceCardProps> = ({ balance, currency, userName }) => {
  const [isVisible, setIsVisible] = useState(true);
  const { userData, user } = useAuth();
  const { config } = useAppConfig();
  const [totalInvestment, setTotalInvestment] = useState<number>(0);

  // Add Money Wizard States
  const [isAddMoneyOpen, setIsAddMoneyOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<"amount" | "methods" | "ussd-bank" | "ussd-pay" | "transfer-pay" | "success">("amount");
  const [addAmount, setAddAmount] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Dynamic Bank Discovery States
  const [banksList, setBanksList] = useState<Array<{ name: string; code: string }>>([]);
  const [isBanksLoading, setIsBanksLoading] = useState(false);
  const [selectedBank, setSelectedBank] = useState<{ name: string; code: string } | null>(null);
  const [ussdErrorMessage, setUssdErrorMessage] = useState("");

  // Permanent Virtual Account States
  const [permanentAccount, setPermanentAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null>(null);
  const [isPermAccountLoading, setIsPermAccountLoading] = useState(false);

  // Active checkout data
  const [activeTxRef, setActiveTxRef] = useState("");
  const [ussdCode, setUssdCode] = useState("");
  const [transferDetails, setTransferDetails] = useState<{
    transferAccount: string;
    transferBank: string;
    transferAmount: number;
    transferReference: string;
    transferNote: string;
  } | null>(null);

  // Timer & Polling Refs
  const [timeLeft, setTimeLeft] = useState(600); // 10 minutes default
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PROCESSING" | "PAID" | "EXPIRED" | "FAILED">("PENDING");
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const resolvedName = (
    userName ||
    userData?.name ||
    user?.displayName ||
    "THE CAPTAIN"
  ).toUpperCase();

  // Load or create the permanent virtual account dynamically from server-side API (idempotent check)
  const fetchPermanentVirtualAccount = async () => {
    const isMock = sessionStorage.getItem("mock") === "true";
    if (isMock) {
      setPermanentAccount({
        bankName: "Wema Bank",
        accountNumber: "9921473281",
        accountName: resolvedName,
      });
      return;
    }

    setIsPermAccountLoading(true);
    try {
      let idToken = "";
      if (user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/flutterwave/create-virtual-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.account) {
          setPermanentAccount({
            bankName: data.account.bankName,
            accountNumber: data.account.accountNumber,
            accountName: data.account.accountName,
          });
        }
      }
    } catch (err) {
      console.error("Error loading permanent account:", err);
    } finally {
      setIsPermAccountLoading(false);
    }
  };

  useEffect(() => {
    if (isAddMoneyOpen) {
      fetchPermanentVirtualAccount();
    }
  }, [isAddMoneyOpen]);

  // Fetch banks dynamically from our Discovery API endpoint
  const fetchBanks = async () => {
    setIsBanksLoading(true);
    try {
      const res = await fetch("/api/payments/banks");
      if (res.ok) {
        const data = await res.json();
        setBanksList(data);
      } else {
        console.warn("Failed to retrieve dynamic bank codes. Using local cache.");
      }
    } catch (err) {
      console.error("Error retrieving bank codes from server:", err);
    } finally {
      setIsBanksLoading(false);
    }
  };

  // Trigger bank fetch on opening the modal to reduce startup lag
  useEffect(() => {
    if (isAddMoneyOpen && banksList.length === 0) {
      fetchBanks();
    }
  }, [isAddMoneyOpen, banksList.length]);

  // Safely calculate active locked savings from sessionStorage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem("active_investments");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const sum = list.reduce((acc: number, curr: { amount: number }) => acc + (parseFloat(curr.amount.toString()) || 0), 0);
            setTotalInvestment(sum);
          }
        } catch {
          // ignore
        }
      }
    }

    const interval = setInterval(() => {
      const saved = sessionStorage.getItem("active_investments");
      if (saved) {
        try {
          const list = JSON.parse(saved);
          if (Array.isArray(list)) {
            const sum = list.reduce((acc: number, curr: { amount: number }) => acc + (parseFloat(curr.amount.toString()) || 0), 0);
            setTotalInvestment(sum);
          }
        } catch {
          // ignore
        }
      } else {
        setTotalInvestment(0);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    if (isAddMoneyOpen && (wizardStep === "ussd-pay" || wizardStep === "transfer-pay")) {
      setTimeLeft(600);
      setPaymentStatus("PENDING");

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setPaymentStatus("EXPIRED");
            stopPolling();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isAddMoneyOpen, wizardStep]);

  // Status Polling Effect
  const startPolling = (txRef: string) => {
    stopPolling();
    console.log(`[Polling Started] Checking status for txRef: ${txRef}`);

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/status?txRef=${txRef}`);
        const data = await res.json();

        if (data.success) {
          if (data.status === "SUCCESS") {
            setPaymentStatus("PAID");
            stopPolling();
            if (timerRef.current) clearInterval(timerRef.current);
            setWizardStep("success");
            toast.success("Wallet credited successfully!");
          } else if (data.status === "FAILED") {
            setPaymentStatus("FAILED");
            stopPolling();
            if (timerRef.current) clearInterval(timerRef.current);
          }
        }
      } catch (err) {
        console.error("Polling Error:", err);
      }
    }, 4000); // Poll every 4 seconds
  };

  const stopPolling = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  };

  // Clean up polling and timers when closing modal
  const handleCloseModal = () => {
    setIsAddMoneyOpen(false);
    stopPolling();
    if (timerRef.current) clearInterval(timerRef.current);
    // Reset steps
    setTimeout(() => {
      setWizardStep("amount");
      setAddAmount("");
      setSearchQuery("");
      setSelectedBank(null);
      setUssdCode("");
      setTransferDetails(null);
      setUssdErrorMessage("");
    }, 300);
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const formattedBalance = new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
  }).format(balance);

  const balanceStr = isVisible ? formattedBalance : "₦ •••,•••.••";

  // Dynamic font scaling
  let fontSizeClass = "text-[20px] min-[360px]:text-[24px] min-[400px]:text-[30px] md:text-[36px] lg:text-[40px]";
  if (balanceStr.length > 24) {
    fontSizeClass = "text-[12px] min-[360px]:text-[14px] min-[400px]:text-[16px]";
  } else if (balanceStr.length > 20) {
    fontSizeClass = "text-[14px] min-[360px]:text-[16px] min-[400px]:text-[18px]";
  } else if (balanceStr.length > 16) {
    fontSizeClass = "text-[16px] min-[360px]:text-[18px] min-[400px]:text-[20px]";
  } else if (balanceStr.length > 12) {
    fontSizeClass = "text-[18px] min-[360px]:text-[21px] min-[400px]:text-[24px]";
  }

  const handlePresetClick = (val: number) => {
    setAddAmount(val.toString());
  };

  const handleAmountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(addAmount);

    if (isNaN(parsedAmount) || parsedAmount < 100) {
      toast.error("Minimum allowed funding amount is ₦100.00");
      return;
    }

    setWizardStep("methods");
  };

  // Card payment initialization (using safest/existing hosted checkout approach as allowed)
  const handleCardPaymentSubmit = async () => {
    setIsInitializing(true);
    toast.loading("Contacting Flutterwave secure payment element...");

    try {
      const payload = {
        amount: parseFloat(addAmount),
        currency: "NGN",
        email: user?.email || "captain@example.com",
        name: userData?.name || user?.displayName || "Captain Wallet",
        userId: user?.uid || "anon",
        redirectUrl: `${window.location.origin}/?verify=flw`,
      };

      const res = await fetch("/api/flutterwave/initialize-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      toast.dismiss();

      if (data.success && data.paymentLink) {
        toast.success("Redirecting to secure card gateway...");
        window.location.href = data.paymentLink;
      } else {
        toast.error(data.error || "Failed to initialize payment gateway.");
      }
    } catch {
      toast.dismiss();
      toast.error("Network communication error.");
    } finally {
      setIsInitializing(false);
    }
  };

  // USSD Bank Selection Action
  const handleBankSelect = async (bank: { name: string; code: string }) => {
    setSelectedBank(bank);
    setUssdErrorMessage("");
    setIsInitializing(true);
    toast.loading(`Generating USSD dialing instructions for ${bank.name}...`);

    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/payments/ussd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          currency: "NGN",
          bankCode: bank.code,
          email: user?.email || "captain@example.com",
          name: userData?.name || user?.displayName || "Captain Wallet",
          phone: userData?.phoneNumber || "08012345678",
        }),
      });

      const data = await res.json();
      toast.dismiss();

      if (res.ok && data.success) {
        setUssdCode(data.ussdCode);
        setActiveTxRef(data.txRef);
        setWizardStep("ussd-pay");
        startPolling(data.txRef);
      } else {
        // Step 7 Fallback handling for unsupported USSD banks
        const errMsg = data.error || "Selected bank is temporarily offline.";
        console.warn("USSD initiation error:", errMsg);
        setUssdErrorMessage("USSD payments are currently unavailable for this bank. Please choose another bank or use Bank Transfer.");
        toast.error("USSD is not supported for this bank.");
      }
    } catch {
      toast.dismiss();
      setUssdErrorMessage("USSD payments are currently unavailable for this bank. Please choose another bank or use Bank Transfer.");
      toast.error("Internal connection error.");
    } finally {
      setIsInitializing(false);
    }
  };

  // Bank Transfer Payment Generation Action
  const handleBankTransferInit = async () => {
    setIsInitializing(true);
    toast.loading("Allocating secure dynamic Wema virtual account...");

    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/payments/bank-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          currency: "NGN",
          email: user?.email || "captain@example.com",
          name: userData?.name || user?.displayName || "Captain Wallet",
          phone: userData?.phoneNumber || "08012345678",
        }),
      });

      const data = await res.json();
      toast.dismiss();

      if (data.success) {
        setTransferDetails({
          transferAccount: data.transferAccount,
          transferBank: data.transferBank,
          transferAmount: data.transferAmount,
          transferReference: data.transferReference,
          transferNote: data.transferNote,
        });
        setActiveTxRef(data.txRef);
        setWizardStep("transfer-pay");
        startPolling(data.txRef);
      } else {
        toast.error(data.error || "Dynamic account allocation failed.");
      }
    } catch {
      toast.dismiss();
      toast.error("Internal connection error.");
    } finally {
      setIsInitializing(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Filter bank query
  const filteredBanks = banksList.filter(b =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
    <motion.section
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="mb-stack-lg text-black w-full"
    >
      {/* Physical Card Design */}
      <div className="relative aspect-[1.586/1] w-full rounded-2xl overflow-hidden shadow-2xl border border-white/10 group min-h-[175px] min-[360px]:min-h-[195px]">
        <div className="absolute inset-0 bg-[#0c1324]">
            <div className="absolute inset-0 opacity-40"
                 style={{
                    backgroundImage: `radial-gradient(circle at 20% 30%, #FC7A00 0%, transparent 40%),
                                     radial-gradient(circle at 80% 70%, #95d3ba 0%, transparent 40%)`
                 }}
            />
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10"></div>
            <div className="absolute inset-0 gold-shimmer opacity-20"></div>
        </div>

        <div className="relative h-full p-3.5 min-[360px]:p-5 md:p-6 flex flex-col justify-between z-10 w-full overflow-hidden">
          {/* Top Row: Label and Chip */}
          <div className="flex justify-between items-start gap-2 w-full overflow-hidden flex-shrink-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 overflow-hidden">
                <div className="relative w-4.5 h-4.5 min-[360px]:w-5 min-[360px]:h-5 flex-shrink-0 bg-white/10 rounded-sm p-0.5">
                  <img
                    src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
                    alt="E-Tech Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <span className="font-label-sm text-[8px] min-[360px]:text-[10px] uppercase tracking-[0.12em] text-[#FFFFFF] font-bold truncate">
                  E-TECH GLOBAL HUB
                </span>
              </div>
            </div>
            {/* SIM Chip Icon */}
            <div className="w-7 h-5 min-[360px]:w-9 min-[360px]:h-7 rounded-md bg-gradient-to-br from-[#FC7A00]/80 to-[#FFB870] border border-[#FC7A00]/20 flex flex-col justify-around p-1 overflow-hidden flex-shrink-0">
                <div className="w-full h-[1px] bg-black/20"></div>
                <div className="w-full h-[1px] bg-black/20"></div>
            </div>
          </div>

          {/* Middle: Balance & Available Label */}
          <div className="flex flex-col justify-center gap-0.5 w-full overflow-hidden my-auto py-1 flex-grow">
            <div className="flex justify-between items-center w-full">
              <p className="font-label-sm text-[8px] min-[360px]:text-[10px] text-[#FFFFFF]/70 font-medium">Available Balance</p>
              <div className="flex items-center gap-1 bg-white/10 px-2 py-0.5 rounded-md border border-white/5 backdrop-blur-xs">
                <span className="material-symbols-outlined text-[9px] text-[#FC7A00] font-bold">lock_clock</span>
                <span className="font-label-sm text-[7.5px] min-[360px]:text-[8.5px] text-[#FFFFFF]/95 font-bold uppercase tracking-wider">
                  Savings: ₦{isVisible ? totalInvestment.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "•••,•••"}
                </span>
              </div>
            </div>
            <AnimatePresence mode="wait">
              <motion.div
                key={isVisible ? "visible" : "hidden"}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="flex items-center justify-between gap-1.5 w-full overflow-hidden"
              >
                <div className="flex-1 min-w-0">
                  <h2 className={`${fontSizeClass} font-display-lg text-[#FFFFFF] font-bold tracking-tight truncate leading-none`} title={formattedBalance}>
                    {balanceStr}
                  </h2>
                </div>
                <button
                  onClick={() => setIsVisible(!isVisible)}
                  className="text-[#FFFFFF]/80 hover:text-[#FFFFFF] transition-colors p-1 flex-shrink-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[15px] min-[360px]:text-[18px] text-[#FFFFFF] block leading-none">
                    {isVisible ? "visibility" : "visibility_off"}
                  </span>
                </button>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Bottom section: Card Number, User Name, Expiry/infinite badge */}
          <div className="space-y-1.5 w-full overflow-hidden flex-shrink-0">
            <div className="font-mono text-[9px] min-[360px]:text-[11px] text-[#FFFFFF]/80 tracking-[0.15em] uppercase truncate max-w-full" title={resolvedName}>
              {resolvedName}
            </div>

            <div className="flex justify-between items-end gap-2 w-full overflow-hidden">
              <div className="flex-1 min-w-0">
                  <p className="font-label-sm text-[7px] min-[360px]:text-[8px] uppercase tracking-wider text-[#FFFFFF]/60 mb-0.5 font-medium truncate">Account Holder</p>
                  <p className="font-label-sm text-[10px] min-[360px]:text-[12px] text-[#FFFFFF] uppercase tracking-widest font-bold truncate leading-none" title={resolvedName}>
                    {resolvedName}
                  </p>
              </div>
              <div className="flex flex-col items-end flex-shrink-0 bg-white/10 px-2 py-0.5 rounded border border-white/15 backdrop-blur-xs select-none">
                   <span className="font-mono text-[9px] min-[360px]:text-[11px] text-[#FFFFFF] font-black tracking-wider leading-none">NGN</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons Below Card */}
      <div className="mt-4 min-[360px]:mt-5 flex gap-2.5 min-[360px]:gap-4">
        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          onClick={() => setIsAddMoneyOpen(true)}
          className="flex-grow py-2.5 min-[360px]:py-3.5 px-2 bg-gradient-to-r from-[#045C1D] via-[#07B038] to-[#034A17] border border-white/10 rounded-xl min-[360px]:rounded-2xl flex items-center justify-center gap-1 min-[360px]:gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none min-w-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
          <div className="w-5.5 h-5.5 min-[360px]:w-7 min-[360px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[12px] min-[360px]:text-[16px] font-bold block">add_card</span>
          </div>
          <span className="font-label-sm text-[10px] min-[360px]:text-[12px] text-white tracking-wide uppercase font-bold truncate">
            Add Money
          </span>
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.96 }}
          whileHover={{ scale: 1.03, y: -1 }}
          className="flex-grow py-2.5 min-[360px]:py-3.5 px-2 bg-gradient-to-r from-[#B35200] via-[#FC7A00] to-[#8C4000] border border-white/10 rounded-xl min-[360px]:rounded-2xl flex items-center justify-center gap-1 min-[360px]:gap-2 hover:brightness-110 active:brightness-95 transition-all duration-300 group cursor-pointer relative overflow-hidden shadow-none min-w-0"
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out" />
          <div className="w-5.5 h-5.5 min-[360px]:w-7 min-[360px]:h-7 rounded-full bg-white/20 backdrop-blur-md border border-white/30 flex items-center justify-center shadow-inner group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
            <span className="material-symbols-outlined text-white text-[12px] min-[360px]:text-[16px] font-bold block">send</span>
          </div>
          <span className="font-label-sm text-[10px] min-[360px]:text-[12px] text-white tracking-wide uppercase font-bold truncate">
            Transfer
          </span>
        </motion.button>
      </div>
    </motion.section>

    {/* Add Money Bottom Sheet Overlay Modal */}
    <AnimatePresence>
      {isAddMoneyOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleCloseModal}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
          />

          {/* Bottom Sheet form container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 shadow-none text-black overflow-y-auto max-h-[85vh] no-scrollbar"
          >
            {/* Drag handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto cursor-grab" />

            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
              {wizardStep !== "amount" && wizardStep !== "success" ? (
                <button
                  type="button"
                  onClick={() => {
                    if (wizardStep === "methods") setWizardStep("amount");
                    else if (wizardStep === "ussd-bank") setWizardStep("methods");
                    else if (wizardStep === "ussd-pay") {
                      stopPolling();
                      setWizardStep("ussd-bank");
                    } else if (wizardStep === "transfer-pay") {
                      stopPolling();
                      setWizardStep("methods");
                    }
                  }}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">arrow_back</span>
                </button>
              ) : (
                <div className="w-8" />
              )}
              <h3 className="font-hanken font-bold text-base text-black text-center">
                Fund Wallet (Direct Checkout)
              </h3>
              <button
                type="button"
                onClick={handleCloseModal}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
              </button>
            </div>

            <AnimatePresence mode="wait">
              {/* STEP 1: Enter Amount */}
              {wizardStep === "amount" && (
                <motion.form
                  key="step-amount"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  onSubmit={handleAmountSubmit}
                  className="space-y-5"
                >
                  {/* Personal Permanent Virtual Account display widget (Premium moniepoint/kuda style) */}
                  {isPermAccountLoading ? (
                    <div className="p-4 bg-gray-50 rounded-2xl animate-pulse space-y-2">
                      <div className="h-3 bg-gray-200 rounded w-1/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2" />
                    </div>
                  ) : permanentAccount ? (
                    <div className="bg-gradient-to-r from-[#1E293B] to-[#0F172A] border border-white/5 rounded-2xl p-4 text-white relative overflow-hidden select-none">
                      <div className="absolute right-0 bottom-0 opacity-15 text-[100px] select-none pointer-events-none translate-x-1/4 translate-y-1/4">
                        <span className="material-symbols-outlined font-black text-white">account_balance</span>
                      </div>

                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1.5">
                          <span className="material-symbols-outlined text-green-400 text-[15px] font-black">check_circle</span>
                          <span className="font-hanken text-[9px] text-gray-300 font-bold uppercase tracking-wider">Your Personal Funding Account</span>
                        </div>
                        <span className="font-mono text-[8px] bg-green-500/20 text-green-400 px-1.5 py-0.5 rounded uppercase font-bold">indefinite use</span>
                      </div>

                      <div className="flex justify-between items-start gap-4">
                        <div>
                          <p className="font-hanken font-bold text-xs text-gray-300 leading-tight">Bank: <strong className="text-white">{permanentAccount.bankName}</strong></p>
                          <p className="font-mono font-black text-sm text-[#FC7A00] tracking-wider mt-1 select-all">{permanentAccount.accountNumber}</p>
                          <p className="font-hanken text-[9px] text-gray-400 font-bold uppercase mt-1 truncate max-w-[200px]">{permanentAccount.accountName}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(permanentAccount.accountNumber, "Account number")}
                          className="bg-white/10 hover:bg-white/20 hover:text-white px-2.5 py-1.5 rounded-lg text-gray-200 text-[10px] font-bold tracking-wide active:scale-95 transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[13px]">content_copy</span>
                          Copy
                        </button>
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Amount to Fund (NGN)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg text-gray-500">₦</span>
                      <input
                        type="number"
                        value={addAmount}
                        onChange={(e) => setAddAmount(e.target.value)}
                        placeholder="Enter amount (e.g. 5000)"
                        required
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-4 font-mono font-black text-lg text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
                      />
                    </div>
                    <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wide mt-1">Minimum funding threshold is ₦100.00</p>
                  </div>

                  {/* Preset select */}
                  <div className="grid grid-cols-4 gap-2">
                    {[1000, 5000, 10000, 20000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handlePresetClick(preset)}
                        className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-150 text-xs font-mono font-bold text-gray-800 rounded-xl transition-all cursor-pointer text-center"
                      >
                        +₦{preset / 1000}K
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-col gap-2.5 pt-3">
                    <button
                      type="submit"
                      className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                    >
                      Choose Payment Method
                    </button>
                  </div>
                </motion.form>
              )}

              {/* STEP 2: Choose Payment Method */}
              {wizardStep === "methods" && (
                <motion.div
                  key="step-methods"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <p className="text-left font-hanken text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                    Select Your Preferred Option for ₦{parseFloat(addAmount).toLocaleString()}
                  </p>

                  <div className="flex flex-col gap-3">
                    {/* Method: Card */}
                    <button
                      type="button"
                      disabled={isInitializing}
                      onClick={handleCardPaymentSubmit}
                      className="w-full p-4 rounded-2xl border border-gray-150 hover:border-[#FC7A00] bg-gray-50 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">credit_card</span>
                        </div>
                        <div className="text-left">
                          <p className="font-hanken font-extrabold text-xs text-black">Pay with Card</p>
                          <p className="font-hanken text-[10px] text-gray-400">Secure Direct Checkout Element</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 text-[18px]">chevron_right</span>
                    </button>

                    {/* Method: USSD */}
                    <button
                      type="button"
                      disabled={isInitializing}
                      onClick={() => setWizardStep("ussd-bank")}
                      className="w-full p-4 rounded-2xl border border-gray-150 hover:border-[#FC7A00] bg-gray-50 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">cell_tower</span>
                        </div>
                        <div className="text-left">
                          <p className="font-hanken font-extrabold text-xs text-black">Pay with USSD Dial Code</p>
                          <p className="font-hanken text-[10px] text-gray-400">Instant code generation for all bank dials</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 text-[18px]">chevron_right</span>
                    </button>

                    {/* Method: Bank Transfer */}
                    <button
                      type="button"
                      disabled={isInitializing}
                      onClick={handleBankTransferInit}
                      className="w-full p-4 rounded-2xl border border-gray-150 hover:border-[#FC7A00] bg-gray-50 flex items-center justify-between cursor-pointer transition-all active:scale-98"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center">
                          <span className="material-symbols-outlined text-[20px]">account_balance</span>
                        </div>
                        <div className="text-left">
                          <p className="font-hanken font-extrabold text-xs text-black">Pay with Direct Bank Transfer</p>
                          <p className="font-hanken text-[10px] text-gray-400">Generate temporary Wema Virtual Account</p>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-gray-400 text-[18px]">chevron_right</span>
                    </button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: USSD Bank Selector */}
              {wizardStep === "ussd-bank" && (
                <motion.div
                  key="step-ussd-bank"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-4"
                >
                  <p className="text-left font-hanken text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Select Your Bank
                  </p>

                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">
                      search
                    </span>
                    <input
                      type="text"
                      placeholder="Search bank (e.g. GTBank, Opay, Moniepoint)..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-3 font-hanken text-xs font-semibold text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
                    />
                  </div>

                  {ussdErrorMessage && (
                    <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-xl font-hanken text-[10.5px] font-bold text-left leading-relaxed">
                      {ussdErrorMessage}
                    </div>
                  )}

                  <div className="max-h-[220px] overflow-y-auto border border-gray-150 rounded-2xl flex flex-col no-scrollbar">
                    {isBanksLoading ? (
                      <div className="p-4 space-y-3.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="flex justify-between items-center animate-pulse">
                            <div className="h-4 bg-gray-100 rounded w-1/3" />
                            <div className="h-3 bg-gray-100 rounded w-10" />
                          </div>
                        ))}
                      </div>
                    ) : filteredBanks.length === 0 ? (
                      <p className="py-8 text-center text-gray-400 font-hanken text-xs font-semibold">No banks matched.</p>
                    ) : (
                      filteredBanks.map((bank) => (
                        <button
                          key={bank.code}
                          type="button"
                          onClick={() => handleBankSelect(bank)}
                          className="w-full px-4 py-3.5 hover:bg-[#FFF9F5] border-b border-gray-50 text-left font-hanken text-xs font-extrabold text-gray-800 transition-colors cursor-pointer flex items-center justify-between"
                        >
                          <span>{bank.name}</span>
                          <span className="text-[10px] bg-gray-100 px-2.5 py-0.5 rounded text-gray-500 font-mono font-bold">
                            Select
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.div>
              )}

              {/* STEP 4: USSD Checkout/Status Dial Screen */}
              {wizardStep === "ussd-pay" && (
                <motion.div
                  key="step-ussd-pay"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-5 text-center flex flex-col items-center"
                >
                  <div className="w-14 h-14 bg-orange-50 border border-orange-100 text-orange-600 rounded-full flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-[28px]">cell_tower</span>
                  </div>

                  <div>
                    <h4 className="font-hanken font-extrabold text-base text-black">Dial to Complete Payment</h4>
                    <p className="font-hanken text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                      Please dial the secure USSD code below on your registered phone to approve the transaction.
                    </p>
                  </div>

                  {/* Code Card */}
                  <div className="w-full bg-[#FFF9F5] border border-[#FFECD8] rounded-2xl p-5 space-y-3">
                    <div className="flex justify-between font-hanken text-[11px] border-b border-[#FFECD8] pb-2 text-gray-500">
                      <span className="font-bold">Bank Name</span>
                      <span className="text-black font-extrabold">{selectedBank?.name}</span>
                    </div>
                    <div className="flex justify-between font-hanken text-[11px] border-b border-[#FFECD8] pb-2 text-gray-500">
                      <span className="font-bold">Amount to Pay</span>
                      <span className="text-emerald-600 font-black">₦{parseFloat(addAmount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div className="flex justify-between font-hanken text-[11px] border-b border-[#FFECD8] pb-2 text-gray-500">
                      <span className="font-bold">Payment Reference</span>
                      <span className="text-black font-mono font-semibold truncate max-w-[180px]">{activeTxRef}</span>
                    </div>

                    <div className="py-2.5 bg-white border border-[#FFECD8] rounded-xl flex items-center justify-between px-4 mt-2">
                      <p className="font-mono font-extrabold text-sm text-black select-all tracking-wide">
                        {ussdCode}
                      </p>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(ussdCode, "USSD code")}
                        className="text-xs font-bold text-primary hover:text-primary-dark font-hanken bg-[#FFF0E0] px-2.5 py-1 rounded-md"
                      >
                        Copy
                      </button>
                    </div>

                    {/* Direct dial anchor */}
                    <a
                      href={`tel:${ussdCode.replace("#", "%23")}`}
                      className="w-full inline-flex py-3 bg-primary hover:bg-primary-dark text-white rounded-xl font-hanken text-xs font-extrabold tracking-wide active:scale-98 transition-all items-center justify-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[16px]">call</span>
                      Dial Instantly
                    </a>
                  </div>

                  {/* Polling / Pending status indicators */}
                  <div className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span className="font-hanken text-[11px] text-gray-500 font-extrabold">
                        {paymentStatus === "PROCESSING" ? "Processing checkout..." : "Waiting for payment..."}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block font-hanken text-[9px] text-gray-400 font-bold uppercase tracking-wide">Expires In</span>
                      <span className="font-mono text-[11px] font-black text-rose-500">
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 5: Bank Transfer dynamic screen */}
              {wizardStep === "transfer-pay" && transferDetails && (
                <motion.div
                  key="step-transfer-pay"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="space-y-5 text-center flex flex-col items-center"
                >
                  <div className="w-14 h-14 bg-green-50 border border-green-100 text-green-600 rounded-full flex items-center justify-center animate-pulse">
                    <span className="material-symbols-outlined text-[28px]">account_balance_wallet</span>
                  </div>

                  <div>
                    <h4 className="font-hanken font-extrabold text-base text-black">Make Direct Transfer</h4>
                    <p className="font-hanken text-[11px] text-gray-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
                      Please transfer the exact amount to the allocated temporary virtual account below.
                    </p>
                  </div>

                  {/* Code Card */}
                  <div className="w-full bg-gray-50 border border-gray-200 rounded-2xl p-5 space-y-3.5 text-left">
                    <div className="flex justify-between font-hanken text-[11px] border-b border-gray-200/60 pb-2 text-gray-500">
                      <span className="font-bold">Bank Name</span>
                      <span className="text-black font-extrabold">{transferDetails.transferBank}</span>
                    </div>

                    <div className="flex justify-between font-hanken text-[11px] border-b border-gray-200/60 pb-2 text-gray-500">
                      <span className="font-bold">Account Holder Name</span>
                      <span className="text-black font-extrabold">E-Tech Global Hub</span>
                    </div>

                    <div className="flex justify-between font-hanken text-[11px] border-b border-gray-200/60 pb-2 text-gray-500">
                      <span className="font-bold">Amount to Transfer</span>
                      <span className="text-emerald-600 font-black text-xs">₦{transferDetails.transferAmount.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
                    </div>

                    <div className="flex justify-between font-hanken text-[11px] border-b border-gray-200/60 pb-2 text-gray-500">
                      <span className="font-bold">Transfer Reference</span>
                      <span className="text-black font-mono font-bold select-all">{transferDetails.transferReference}</span>
                    </div>

                    {/* Account Number element */}
                    <div className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">Account Number</p>
                        <p className="font-mono font-black text-base text-black tracking-widest mt-0.5 select-all">
                          {transferDetails.transferAccount}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(transferDetails.transferAccount, "Account number")}
                        className="text-xs font-bold text-primary hover:text-primary-dark font-hanken bg-[#FFF0E0] px-3.5 py-2.5 rounded-xl transition-all active:scale-95 flex items-center gap-1.5"
                      >
                        <span className="material-symbols-outlined text-[15px]">content_copy</span>
                        Copy
                      </button>
                    </div>
                  </div>

                  {/* Polling status indicator */}
                  <div className="w-full bg-gray-50 border border-gray-150 rounded-xl p-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-primary text-[18px] animate-spin">
                        progress_activity
                      </span>
                      <span className="font-hanken text-[11px] text-gray-500 font-extrabold">
                        {paymentStatus === "PROCESSING" ? "Processing transfer..." : "Waiting for payment..."}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="block font-hanken text-[9px] text-gray-400 font-bold uppercase tracking-wide">Expires In</span>
                      <span className="font-mono text-[11px] font-black text-rose-500">
                        {formatTime(timeLeft)}
                      </span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* STEP 6: Direct Success Screen */}
              {wizardStep === "success" && (
                <motion.div
                  key="step-success"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  className="space-y-5 text-center flex flex-col items-center py-4"
                >
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner animate-bounce">
                    <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
                  </div>

                  <div>
                    <h4 className="font-hanken font-black text-lg text-gray-900 leading-tight">Payment Successful!</h4>
                    <p className="font-hanken text-xs text-gray-500 mt-1 font-semibold leading-relaxed max-w-[280px]">
                      Your wallet has been automatically credited and a receipt generated in your ledger.
                    </p>
                  </div>

                  <div className="w-full bg-gray-50 rounded-2xl p-4 border border-gray-150">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Credited Amount</p>
                    <p className="font-mono text-2xl font-black text-emerald-600 mt-0.5">
                      +₦{parseFloat(addAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                  >
                    Back to Dashboard
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </>
      )}
    </AnimatePresence>
    </>
  );
};
