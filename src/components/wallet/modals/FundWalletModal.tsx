"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useLogos, matchBankLogo } from "@/lib/logos-client";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface FundWalletModalProps {
  user: any;
  userData: any;
  config: any;
  initialCurrency?: string;
  onClose: () => void;
  onSuccess?: () => void;
}

export const FundWalletModal: React.FC<FundWalletModalProps> = ({
  user,
  userData,
  config,
  initialCurrency = "NGN",
  onClose,
  onSuccess,
}) => {
  useModalBackHandler(true, onClose);

  const { banks } = useLogos();
  const [wizardStep, setWizardStep] = useState<"amount" | "methods" | "ussd-bank" | "ussd-pay" | "transfer-pay" | "success">("amount");
  const [addAmount, setAddAmount] = useState("");
  const [isInitializing, setIsInitializing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [selectedBank, setSelectedBank] = useState<{ id?: string; name: string; code?: string } | null>(null);
  const [ussdErrorMessage, setUssdErrorMessage] = useState("");
  const [ussdCode, setUssdCode] = useState("");
  const [paymentStatus, setPaymentStatus] = useState<"PENDING" | "PAID" | "EXPIRED" | "FAILED" | "CANCELED" | "REVERSED">("PENDING");
  const [txRef, setTxRef] = useState<string | null>(null);
  const [confirmedCreditedAmount, setConfirmedCreditedAmount] = useState<number | null>(null);

  const [permanentAccount, setPermanentAccount] = useState<{
    accountNumber: string;
    bankName: string;
    accountName: string;
  } | null>(null);
  const [isPermAccountLoading, setIsPermAccountLoading] = useState(false);

  const [transferDetails, setTransferDetails] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
    flwRef?: string;
    txRef?: string;
    amount?: number;
    expiresAt?: string;
  } | null>(null);

  const [timeLeft, setTimeLeft] = useState<number>(600);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const isPollingActiveRef = useRef<boolean>(false);
  const pollInFlightRef = useRef<boolean>(false);

  const activeMinTransfer = Number(config?.minTransferAmount ?? config?.globalMinTransferAmount) || 100;

  // Timer countdown for USSD/Transfer pay screens
  useEffect(() => {
    if (wizardStep === "ussd-pay" || wizardStep === "transfer-pay") {
      setTimeLeft(600);
      setPaymentStatus("PENDING");

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
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
  }, [wizardStep]);

  const stopPolling = () => {
    isPollingActiveRef.current = false;
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    pollInFlightRef.current = false;
  };

  const startPolling = (refToPoll: string) => {
    stopPolling();
    if (!user) return;

    isPollingActiveRef.current = true;

    const executePoll = async () => {
      if (!user || !isPollingActiveRef.current || pollInFlightRef.current) return;

      pollInFlightRef.current = true;
      try {
        const idToken = await user.getIdToken();
        const res = await fetch(`/api/payments/status?txRef=${encodeURIComponent(refToPoll)}`, {
          cache: "no-store",
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        const data = await res.json();

        if (!isPollingActiveRef.current) return;

        if (res.status === 401 || res.status === 403) {
          stopPolling();
          return;
        }

        if (data.status === "SUCCESS") {
          const creditedAmt = Number(data.totalCredited ?? data.fundedAmount ?? data.amount ?? 0);
          setConfirmedCreditedAmount(creditedAmt > 0 ? creditedAmt : null);
          setPaymentStatus("PAID");
          stopPolling();
          if (timerRef.current) clearInterval(timerRef.current);
          setWizardStep("success");
          toast.success("Wallet credited successfully!");
          if (onSuccess) onSuccess();
          window.dispatchEvent(new Event("app-refresh"));
        } else if (data.status === "FAILED" || data.status === "EXPIRED" || data.status === "CANCELED") {
          setConfirmedCreditedAmount(0);
          setPaymentStatus(data.status);
          stopPolling();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      } catch (err) {
        console.error("[FundWalletModal] Polling Error:", err);
      } finally {
        pollInFlightRef.current = false;
      }
    };

    executePoll().then(() => {
      if (isPollingActiveRef.current) {
        pollingRef.current = setInterval(executePoll, 4000);
      }
    });
  };

  const handleClose = () => {
    stopPolling();
    if (timerRef.current) clearInterval(timerRef.current);
    onClose();
  };

  const handleProceedToMethods = () => {
    const parsedAmount = parseFloat(addAmount);
    if (isNaN(parsedAmount) || parsedAmount < 100) {
      toast.error("Minimum allowed funding amount is ₦100.00");
      return;
    }
    // Instant step transition without artificial 800ms delay!
    setWizardStep("methods");
  };

  const handleSelectPaymentMethod = async (method: "ussd" | "bank_transfer" | "card") => {
    const parsedAmount = parseFloat(addAmount);
    if (isNaN(parsedAmount) || parsedAmount < 100) {
      toast.error("Minimum funding amount is ₦100.00");
      return;
    }

    if (method === "ussd") {
      setWizardStep("ussd-bank");
    } else if (method === "bank_transfer") {
      setIsInitializing(true);
      try {
        let idToken = "mock-token";
        if (user && sessionStorage.getItem("mock") !== "true") {
          idToken = await user.getIdToken();
        }

        const res = await fetch("/api/flutterwave/ussd", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: parsedAmount,
            currency: "NGN",
            isBankTransfer: true,
            email: user?.email || userData?.email || "customer@eglobal.com",
            fullName: userData?.fullName || userData?.name || "E-Global Customer",
            phoneNumber: userData?.phone || userData?.phoneNumber || "08000000000",
          }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.account_number) {
          setTransferDetails({
            bankName: data.bank_name || "Wema Bank / Dynamic Account",
            accountNumber: data.account_number,
            accountName: data.account_name || "E-Global Technology Wallet",
            flwRef: data.flw_ref,
            txRef: data.tx_ref,
            amount: data.amount || parsedAmount,
          });
          setTxRef(data.tx_ref || null);
          setWizardStep("transfer-pay");
          if (data.tx_ref) startPolling(data.tx_ref);
        } else {
          toast.error(data.error || "Failed to generate dynamic transfer account. Please try again.");
        }
      } catch (err) {
        console.error("Dynamic Transfer Generation Error:", err);
        toast.error("Network communication error. Please try again.");
      } finally {
        setIsInitializing(false);
      }
    } else if (method === "card") {
      setIsInitializing(true);
      try {
        let idToken = "mock-token";
        if (user && sessionStorage.getItem("mock") !== "true") {
          idToken = await user.getIdToken();
        }

        const res = await fetch("/api/flutterwave/card-charge", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            amount: parsedAmount,
            currency: "NGN",
            email: user?.email || userData?.email || "customer@eglobal.com",
            fullName: userData?.fullName || userData?.name || "E-Global Customer",
            redirectUrl: `${window.location.origin}/?verify=flw`,
          }),
        });

        const data = await res.json();
        if (res.ok && data.success && data.link) {
          window.location.href = data.link;
        } else {
          toast.error(data.error || "Unable to initialize card checkout gateway.");
        }
      } catch (err) {
        console.error("Card Charge Init Error:", err);
        toast.error("Failed to connect to checkout gateway.");
      } finally {
        setIsInitializing(false);
      }
    }
  };

  const handleSelectUssdBank = async (bank: { id?: string; name: string; code?: string }) => {
    setSelectedBank(bank);
    setIsInitializing(true);
    setUssdErrorMessage("");

    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/flutterwave/ussd", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          amount: parseFloat(addAmount),
          currency: "NGN",
          account_bank: bank.code || bank.id,
          email: user?.email || userData?.email || "customer@eglobal.com",
          fullName: userData?.fullName || userData?.name || "E-Global Customer",
          phoneNumber: userData?.phone || userData?.phoneNumber || "08000000000",
        }),
      });

      const data = await res.json();
      if (res.ok && data.success && data.payment_code) {
        setUssdCode(data.payment_code);
        setTxRef(data.tx_ref || null);
        setWizardStep("ussd-pay");
        if (data.tx_ref) startPolling(data.tx_ref);
      } else {
        setUssdErrorMessage(data.error || "USSD service unavailable for selected bank.");
        toast.error(data.error || "USSD code generation failed.");
      }
    } catch (err) {
      console.error("USSD Generation Error:", err);
      toast.error("Failed to reach USSD service.");
    } finally {
      setIsInitializing(false);
    }
  };

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (b.code && b.code.includes(searchQuery))
  );

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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
          <div className="flex items-center gap-2">
            {wizardStep !== "amount" && (
              <button
                type="button"
                onClick={() => {
                  if (wizardStep === "methods") setWizardStep("amount");
                  else if (wizardStep === "ussd-bank") setWizardStep("methods");
                  else setWizardStep("methods");
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}
            <h3 className="font-hanken font-extrabold text-base text-gray-900">
              {wizardStep === "amount" && "Add Money / Fund Wallet"}
              {wizardStep === "methods" && "Choose Payment Method"}
              {wizardStep === "ussd-bank" && "Select Bank for USSD"}
              {wizardStep === "ussd-pay" && "Dial USSD Code"}
              {wizardStep === "transfer-pay" && "Bank Transfer Payment"}
              {wizardStep === "success" && "Funding Successful"}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* STEP 1: Enter Amount */}
        {wizardStep === "amount" && (
          <div className="space-y-4">
            <p className="font-hanken text-xs text-gray-500 font-medium">
              Enter amount you wish to add to your NGN Wallet (Min ₦100.00).
            </p>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg text-gray-500">
                ₦
              </span>
              <input
                type="number"
                placeholder="1,000.00"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 font-mono text-lg font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[1000, 2000, 5000, 10000, 20000, 50000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAddAmount(amt.toString())}
                  className="py-2.5 bg-gray-100 rounded-xl font-mono text-xs font-bold text-gray-800 hover:bg-[#FC7A00]/10 hover:text-[#FC7A00] transition-all"
                >
                  +₦{amt.toLocaleString()}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleProceedToMethods}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              Continue
            </button>
          </div>
        )}

        {/* STEP 2: Choose Payment Method */}
        {wizardStep === "methods" && (
          <div className="space-y-3">
            <p className="font-hanken text-xs text-gray-500 font-medium mb-2">
              Funding ₦{parseFloat(addAmount || "0").toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>

            <button
              type="button"
              onClick={() => handleSelectPaymentMethod("bank_transfer")}
              disabled={isInitializing}
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:border-[#FC7A00] hover:bg-white text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">account_balance</span>
                </div>
                <div>
                  <h4 className="font-hanken font-bold text-sm text-gray-900">Bank Transfer</h4>
                  <p className="font-hanken text-[11px] text-gray-500">Instant Automated Bank Account Deposit</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-[#FC7A00]">chevron_right</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPaymentMethod("ussd")}
              disabled={isInitializing}
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:border-[#FC7A00] hover:bg-white text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">dialpad</span>
                </div>
                <div>
                  <h4 className="font-hanken font-bold text-sm text-gray-900">USSD Code</h4>
                  <p className="font-hanken text-[11px] text-gray-500">Pay using your bank&apos;s USSD dial code</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-[#FC7A00]">chevron_right</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPaymentMethod("card")}
              disabled={isInitializing}
              className="w-full p-4 rounded-2xl border border-gray-200 bg-gray-50 hover:border-[#FC7A00] hover:bg-white text-left flex items-center justify-between group transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-xl">credit_card</span>
                </div>
                <div>
                  <h4 className="font-hanken font-bold text-sm text-gray-900">Debit / Credit Card</h4>
                  <p className="font-hanken text-[11px] text-gray-500">Pay securely via Flutterwave Card Checkout</p>
                </div>
              </div>
              <span className="material-symbols-outlined text-gray-400 group-hover:text-[#FC7A00]">chevron_right</span>
            </button>
          </div>
        )}

        {/* STEP 3: USSD Bank Selection */}
        {wizardStep === "ussd-bank" && (
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Search your bank..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 font-hanken text-xs font-semibold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
            />

            <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
              {filteredBanks.map((bank) => {
                const logo = matchBankLogo(bank.name, banks);
                return (
                  <button
                    key={bank.id || bank.code}
                    type="button"
                    onClick={() => handleSelectUssdBank(bank)}
                    className="w-full p-3 rounded-xl border border-gray-150 bg-white hover:border-[#FC7A00] hover:bg-orange-50/30 text-left flex items-center justify-between transition-all"
                  >
                    <div className="flex items-center gap-3">
                      {logo ? (
                        <img src={logo} alt={bank.name} className="w-7 h-7 object-contain rounded-md" />
                      ) : (
                        <div className="w-7 h-7 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-[10px]">
                          {bank.name.substring(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span className="font-hanken text-xs font-bold text-gray-900">{bank.name}</span>
                    </div>
                    <span className="material-symbols-outlined text-gray-400 text-sm">chevron_right</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 4: USSD Pay Screen */}
        {wizardStep === "ussd-pay" && (
          <div className="space-y-4 text-center py-2">
            <p className="font-hanken text-xs text-gray-500">
              Dial the USSD code below on your phone line registered with {selectedBank?.name}:
            </p>

            <div className="p-4 bg-orange-50 border border-orange-200 rounded-2xl">
              <span className="font-mono text-2xl font-black text-[#FC7A00] select-all tracking-wider">
                {ussdCode}
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(ussdCode);
                toast.success("USSD code copied!");
              }}
              className="py-2.5 px-6 bg-gray-900 text-white font-hanken text-xs font-bold rounded-xl"
            >
              Copy USSD Code
            </button>

            <div className="text-[#FC7A00] font-mono text-xs font-bold mt-2">
              Time remaining: {formatTimer(timeLeft)}
            </div>
          </div>
        )}

        {/* STEP 5: Dynamic Bank Transfer Pay Screen */}
        {wizardStep === "transfer-pay" && transferDetails && (
          <div className="space-y-4 text-center py-2">
            <p className="font-hanken text-xs text-gray-500">
              Transfer exactly <strong className="font-mono text-gray-900">₦{parseFloat(addAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}</strong> to the dynamic account below:
            </p>

            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl text-left space-y-2">
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Bank Name</p>
                <p className="font-hanken text-sm font-black text-gray-900">{transferDetails.bankName}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Account Number</p>

                <div className="flex items-center justify-between">
                  <p className="font-mono text-lg font-black text-[#FC7A00] select-all">{transferDetails.accountNumber}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(transferDetails.accountNumber);
                      toast.success("Account number copied!");
                    }}
                    className="text-xs font-bold text-[#FC7A00] hover:underline"
                  >
                    Copy
                  </button>
                </div>
              </div>

              <div>
                <p className="text-[10px] uppercase font-bold text-gray-400">Account Name</p>
                <p className="font-hanken text-xs font-bold text-gray-800">{transferDetails.accountName}</p>
              </div>
            </div>

            <div className="text-[#FC7A00] font-mono text-xs font-bold">
              Expires in: {formatTimer(timeLeft)}
            </div>
          </div>
        )}

        {/* STEP 6: Success Screen */}
        {wizardStep === "success" && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>

            <h3 className="font-hanken font-extrabold text-lg text-gray-900">Payment Successful</h3>
            {confirmedCreditedAmount !== null && (
              <p className="font-mono text-2xl font-black text-emerald-600">
                +₦{confirmedCreditedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </p>
            )}

            <button
              type="button"
              onClick={handleClose}
              className="w-full py-3.5 bg-gray-900 text-white font-hanken text-xs font-bold rounded-2xl"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

export default React.memo(FundWalletModal);
