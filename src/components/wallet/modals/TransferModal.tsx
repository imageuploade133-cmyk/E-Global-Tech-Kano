"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useLogos } from "@/lib/logos-client";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { TransactionReceipt } from "@/components/wallet/TransactionReceipt";

interface TransferModalProps {
  user: any;
  userData: any;
  config: any;
  initialMode?: "single" | "bulk";
  onClose: () => void;
  onSuccess?: () => void;
}

interface SavedRecipientItem {
  accountNumber: string;
  bankCode: string;
  bankName: string;
  accountName: string;
}

interface BulkRecipientItem {
  bankId: string;
  bankName: string;
  accountNumber: string;
  recipientName: string;
  amount: number;
}

export const TransferModal: React.FC<TransferModalProps> = ({
  user,
  userData,
  config,
  initialMode = "single",
  onClose,
  onSuccess,
}) => {
  useModalBackHandler(true, onClose);

  const { banks } = useLogos();
  const activeMinTransfer = Number(config?.minTransferAmount ?? config?.globalMinTransferAmount) || 100;

  const [isBulkMode, setIsBulkMode] = useState(initialMode === "bulk");
  const [trfStep, setTrfStep] = useState<"input" | "amount" | "confirm" | "pin" | "completion">("input");

  // Single Transfer states
  const [trfAccount, setTrfAccount] = useState("");
  const [trfAccountName, setTrfAccountName] = useState("");
  const [trfBank, setTrfBank] = useState<{ id?: string; name: string; code?: string; logoUrl?: string | null } | null>(null);
  const [trfAmount, setTrfAmount] = useState("");
  const [trfNarration, setTrfNarration] = useState("");
  const [trfFee, setTrfFee] = useState(0);
  const [trfTotalDebit, setTrfTotalDebit] = useState(0);
  const [trfPin, setTrfPin] = useState("");
  const [isResolvingAccount, setIsResolvingAccount] = useState(false);
  const [isManualFallback, setIsManualFallback] = useState(false);
  const [showTrfBankSelector, setShowTrfBankSelector] = useState(false);
  const [bankSearchQuery, setBankSearchQuery] = useState("");
  const [isExecutingTransfer, setIsExecutingTransfer] = useState(false);
  const [transferResult, setTransferResult] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);

  // Bulk Transfer states
  const [bulkRecipients, setBulkRecipients] = useState<BulkRecipientItem[]>([]);
  const [bulkBank, setBulkBank] = useState<{ id?: string; name: string; code?: string; logoUrl?: string | null } | null>(null);
  const [bulkAccount, setBulkAccount] = useState("");
  const [bulkName, setBulkName] = useState("");
  const [bulkAmountVal, setBulkAmountVal] = useState("");
  const [isBulkResolving, setIsBulkResolving] = useState(false);
  const [isExecutingBulk, setIsExecutingBulk] = useState(false);
  const [showBulkBankSelector, setShowBulkBankSelector] = useState(false);

  // Recents & Beneficiaries
  const [recents, setRecents] = useState<SavedRecipientItem[]>([]);

  useEffect(() => {
    if (!user) return;
    const loadRecentsAndBen = async () => {
      try {
        const qRec = query(
          collection(db, "recents"),
          where("userId", "==", user.uid),
          limit(5)
        );
        const snapRec = await getDocs(qRec);
        const loadedRec: SavedRecipientItem[] = [];
        snapRec.forEach((d) => loadedRec.push(d.data() as SavedRecipientItem));
        setRecents(loadedRec);
      } catch (err) {
        console.error("Failed to load recents:", err);
      }
    };
    loadRecentsAndBen();
  }, [user]);

  // Automatic Account Resolution for Single Transfer (10 digits)
  useEffect(() => {
    if (trfAccount.length === 10 && !isBulkMode) {
      const resolveAccount = async () => {
        setIsResolvingAccount(true);
        setTrfAccountName("");

        try {
          let idToken = "mock-token";
          if (user && sessionStorage.getItem("mock") !== "true") {
            idToken = await user.getIdToken();
          }

          const bodyPayload: any = { accountNumber: trfAccount, account_number: trfAccount };
          if (trfBank) {
            bodyPayload.account_bank = trfBank.code || trfBank.id;
            bodyPayload.bankCode = trfBank.code || trfBank.id;
          }

          const res = await fetch("/api/flutterwave/account-resolve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify(bodyPayload),
          });

          const data = await res.json();
          const resolvedName = data.account_name || data.accountName || data.data?.account_name || data.data?.accountName;

          if (res.ok && data.success && resolvedName) {
            setTrfAccountName(resolvedName);
            setIsManualFallback(false);
            if (data.bank_name || data.bank_code) {
              const matchedBank = banks.find(
                (b) => b.code === data.bank_code || b.id === data.bank_code || b.name.toLowerCase() === (data.bank_name || "").toLowerCase()
              );
              if (matchedBank) {
                setTrfBank(matchedBank);
              } else if (data.bank_name) {
                setTrfBank({ id: data.bank_code || "", name: data.bank_name, code: data.bank_code });
              }
            }
            toast.success("Account name verified!");
          } else {
            setIsManualFallback(true);
            toast.error(data.error || "Automatic account lookup failed. Select destination bank manually.");
          }
        } catch (err) {
          console.error("Account Resolve Error:", err);
          setIsManualFallback(true);
        } finally {
          setIsResolvingAccount(false);
        }
      };

      resolveAccount();
    }
  }, [trfAccount, trfBank, isBulkMode, user, banks]);

  // Automatic Account Resolution for Bulk Transfer (10 digits)
  useEffect(() => {
    if (bulkAccount.length === 10 && bulkBank && isBulkMode) {
      const resolveBulkAccount = async () => {
        setIsBulkResolving(true);
        setBulkName("");

        try {
          let idToken = "mock-token";
          if (user && sessionStorage.getItem("mock") !== "true") {
            idToken = await user.getIdToken();
          }

          const res = await fetch("/api/flutterwave/account-resolve", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              accountNumber: bulkAccount,
              account_number: bulkAccount,
              account_bank: bulkBank.code || bulkBank.id,
              bankCode: bulkBank.code || bulkBank.id,
            }),
          });

          const data = await res.json();
          const resolvedName = data.account_name || data.accountName || data.data?.account_name || data.data?.accountName;

          if (res.ok && data.success && resolvedName) {
            setBulkName(resolvedName);
            toast.success("Recipient verified!");
          } else {
            toast.error(data.error || "Recipient lookup failed.");
          }
        } catch (err) {
          console.error("Bulk Resolve Error:", err);
        } finally {
          setIsBulkResolving(false);
        }
      };

      resolveBulkAccount();
    }
  }, [bulkAccount, bulkBank, isBulkMode, user]);

  // Fee calculation debounce for Single Transfer
  useEffect(() => {
    if (trfStep === "amount" && trfAmount && parseFloat(trfAmount) >= activeMinTransfer) {
      const fetchFee = async () => {
        try {
          let idToken = "mock-token";
          if (user && sessionStorage.getItem("mock") !== "true") {
            idToken = await user.getIdToken();
          }

          const res = await fetch(
            `/api/flutterwave/transfer-fee?amount=${trfAmount}&currency=NGN`,
            {
              headers: { Authorization: `Bearer ${idToken}` },
            }
          );
          const data = await res.json();
          if (res.ok && data.success) {
            const calculatedFee = Number(data.fee) || 0;
            const calculatedDebit = Number(data.totalDebit) || parseFloat(trfAmount) + calculatedFee;
            setTrfFee(calculatedFee);
            setTrfTotalDebit(calculatedDebit);
          }
        } catch (err) {
          console.error("Fetch Fee Error:", err);
        }
      };

      const delayDebounce = setTimeout(fetchFee, 300);
      return () => clearTimeout(delayDebounce);
    }
  }, [trfStep, trfAmount, activeMinTransfer, user]);

  const handleSelectRecipient = (item: SavedRecipientItem) => {
    setTrfAccount(item.accountNumber);
    setTrfAccountName(item.accountName);
    setIsManualFallback(false);
    const matchedBank = banks.find((b) => b.code === item.bankCode || b.id === item.bankCode || b.name === item.bankName);
    if (matchedBank) {
      setTrfBank(matchedBank);
    } else {
      setTrfBank({ id: item.bankCode, name: item.bankName, code: item.bankCode });
    }
  };

  const handleAddBulkRecipient = () => {
    const amt = parseFloat(bulkAmountVal);
    if (isNaN(amt) || amt < activeMinTransfer) {
      toast.error(`Minimum transfer amount per recipient is ₦${activeMinTransfer.toLocaleString()}.`);
      return;
    }
    if (!bulkBank || !bulkAccount || bulkAccount.length !== 10 || !bulkName) {
      toast.error("Please enter a valid 10-digit account number and select bank.");
      return;
    }

    setBulkRecipients((prev) => [
      ...prev,
      {
        bankId: bulkBank.code || bulkBank.id || "",
        bankName: bulkBank.name,
        accountNumber: bulkAccount,
        recipientName: bulkName,
        amount: amt,
      },
    ]);

    setBulkAccount("");
    setBulkName("");
    setBulkAmountVal("");
    toast.success("Recipient added to batch list!");
  };

  const handleRemoveBulkRecipient = (index: number) => {
    setBulkRecipients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleExecuteSingleTransfer = async () => {
    if (trfPin.length !== 4) {
      toast.error("Please enter a valid 4-digit PIN.");
      return;
    }

    setIsExecutingTransfer(true);
    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const effectiveNarration = trfNarration.trim() || `Transfer To ${trfAccountName}`;

      const res = await fetch("/api/flutterwave/transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          account_bank: trfBank?.code || trfBank?.id,
          bank_name: trfBank?.name,
          account_number: trfAccount,
          accountNumber: trfAccount,
          account_name: trfAccountName,
          accountName: trfAccountName,
          recipientName: trfAccountName,
          beneficiaryName: trfAccountName,
          amount: parseFloat(trfAmount),
          narration: effectiveNarration,
          currency: "NGN",
          pin: trfPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const resultRecord = {
          reference: data.reference || data.tx_ref || `TRF-${Date.now()}`,
          amount: parseFloat(trfAmount),
          fee: trfFee,
          totalDebited: trfTotalDebit,
          type: "TRANSFER",
          category: "TRANSFER",
          recipientName: trfAccountName,
          recipientBankName: trfBank?.name || "Bank",
          recipientAccountNumber: trfAccount,
          beneficiaryName: trfAccountName,
          beneficiaryBankName: trfBank?.name,
          beneficiaryAccountNumber: trfAccount,
          narration: effectiveNarration,
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        };
        setTransferResult(resultRecord);
        setTrfStep("completion");
        toast.success("Transfer completed successfully!");
        if (onSuccess) onSuccess();
        window.dispatchEvent(new Event("app-refresh"));
      } else {
        toast.error(data.error || "Transfer failed. Please check your PIN or details.");
        setTrfPin("");
      }
    } catch (err) {
      console.error("Transfer Execution Error:", err);
      toast.error("Transfer execution failed.");
      setTrfPin("");
    } finally {
      setIsExecutingTransfer(false);
    }
  };

  const handleExecuteBulkTransfer = async () => {
    if (trfPin.length !== 4) {
      toast.error("Please enter a valid 4-digit PIN.");
      return;
    }

    setIsExecutingBulk(true);
    try {
      let idToken = "mock-token";
      if (user && sessionStorage.getItem("mock") !== "true") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/flutterwave/bulk-transfer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          recipients: bulkRecipients,
          pin: trfPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        const resultRecord = {
          reference: data.reference || `BULK-${Date.now()}`,
          amount: bulkRecipients.reduce((s, r) => s + r.amount, 0),
          fee: data.fee || 0,
          type: "BULK_TRANSFER",
          category: "TRANSFER",
          recipientName: `${bulkRecipients.length} Batch Recipients`,
          status: "SUCCESS",
          createdAt: new Date().toISOString(),
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
        };
        setTransferResult(resultRecord);
        setTrfStep("completion");
        toast.success("Bulk transfer completed successfully!");
        if (onSuccess) onSuccess();
        window.dispatchEvent(new Event("app-refresh"));
      } else {
        toast.error(data.error || "Bulk transfer failed.");
        setTrfPin("");
      }
    } catch (err) {
      console.error("Bulk Transfer Execution Error:", err);
      toast.error("Bulk transfer failed.");
      setTrfPin("");
    } finally {
      setIsExecutingBulk(false);
    }
  };

  const filteredBanks = banks.filter((b) =>
    b.name.toLowerCase().includes(bankSearchQuery.toLowerCase()) ||
    (b.code && b.code.includes(bankSearchQuery))
  );

  const bulkTotalAmount = bulkRecipients.reduce((sum, r) => sum + r.amount, 0);

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
            {trfStep !== "input" && (
              <button
                type="button"
                onClick={() => {
                  if (trfStep === "amount") setTrfStep("input");
                  else if (trfStep === "confirm") setTrfStep("amount");
                  else if (trfStep === "pin") setTrfStep("confirm");
                }}
                className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 hover:bg-gray-200"
              >
                <span className="material-symbols-outlined text-lg">arrow_back</span>
              </button>
            )}
            <h3 className="font-hanken font-extrabold text-base text-gray-900">
              {trfStep === "input" && (isBulkMode ? "Bulk Bank Transfer" : "Single Bank Transfer")}
              {trfStep === "amount" && "Enter Transfer Details"}
              {trfStep === "confirm" && "Confirm Transfer"}
              {trfStep === "pin" && "Authorize Transfer"}
              {trfStep === "completion" && "Transfer Result"}
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {/* Mode Switcher */}
        {trfStep === "input" && (
          <div className="grid grid-cols-2 bg-gray-100 p-1 rounded-2xl mb-4">
            <button
              type="button"
              onClick={() => setIsBulkMode(false)}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                !isBulkMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Single Transfer
            </button>
            <button
              type="button"
              onClick={() => setIsBulkMode(true)}
              className={`py-2 text-xs font-bold rounded-xl transition-all ${
                isBulkMode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"
              }`}
            >
              Bulk Transfer
            </button>
          </div>
        )}

        {/* STEP 1: Single Input Screen */}
        {!isBulkMode && trfStep === "input" && (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Account Number (10 Digits)</label>
              <input
                type="number"
                placeholder="e.g. 0123456789"
                value={trfAccount}
                onChange={(e) => {
                  const val = e.target.value.slice(0, 10);
                  setTrfAccount(val);
                  if (val.length !== 10) {
                    setTrfAccountName("");
                    setIsManualFallback(true);
                  }
                }}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-sm font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
              />
            </div>

            {isResolvingAccount && (
              <p className="text-xs text-[#FC7A00] font-bold animate-pulse flex items-center gap-2">
                <span className="material-symbols-outlined text-base animate-spin">sync</span> Resolving account details...
              </p>
            )}

            {trfAccountName && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase">Verified Recipient</p>
                  <p className="font-hanken text-xs font-extrabold text-emerald-900">{trfAccountName}</p>
                </div>
                <span className="material-symbols-outlined text-emerald-600 text-lg">check_circle</span>
              </div>
            )}

            {/* Bank Selector Fallback */}
            {(isManualFallback || !trfBank) && (
              <div>
                <label className="text-[10px] font-bold uppercase text-gray-400">Destination Bank</label>
                <button
                  type="button"
                  onClick={() => setShowTrfBankSelector(!showTrfBankSelector)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-200 rounded-2xl text-left font-hanken text-xs font-bold text-gray-900 flex items-center justify-between"
                >
                  <span>{trfBank ? trfBank.name : "Select Bank"}</span>
                  <span className="material-symbols-outlined text-gray-400">unfold_more</span>
                </button>
              </div>
            )}

            {showTrfBankSelector && (
              <div className="space-y-2 border border-gray-200 rounded-2xl p-3 bg-gray-50 max-h-52 overflow-y-auto">
                <input
                  type="text"
                  placeholder="Filter banks..."
                  value={bankSearchQuery}
                  onChange={(e) => setBankSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold"
                />
                {filteredBanks.map((b) => (
                  <button
                    key={b.id || b.code}
                    type="button"
                    onClick={() => {
                      setTrfBank(b);
                      setShowTrfBankSelector(false);
                    }}
                    className="w-full text-left p-2 hover:bg-gray-200 rounded-xl text-xs font-bold text-gray-800"
                  >
                    {b.name}
                  </button>
                ))}
              </div>
            )}

            {/* Recents */}
            {recents.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase text-gray-400 mb-2">Recent Transfers</p>
                <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
                  {recents.map((item) => (
                    <button
                      key={item.accountNumber}
                      type="button"
                      onClick={() => handleSelectRecipient(item)}
                      className="px-3 py-2 bg-gray-100 hover:bg-orange-50 border border-gray-200 rounded-xl flex-shrink-0 text-left"
                    >
                      <p className="font-hanken text-xs font-bold text-gray-900 truncate max-w-[120px]">{item.accountName}</p>
                      <p className="font-mono text-[10px] text-gray-500">{item.bankName}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!trfAccount || !trfBank || !trfAccountName}
              onClick={() => setTrfStep("amount")}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              Continue to Amount
            </button>
          </div>
        )}

        {/* STEP 1: Bulk Input Screen */}
        {isBulkMode && trfStep === "input" && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <h4 className="font-hanken font-bold text-xs text-gray-900">Add Recipient to Batch</h4>

              <div>
                <button
                  type="button"
                  onClick={() => setShowBulkBankSelector(!showBulkBankSelector)}
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-left text-xs font-bold text-gray-900 flex items-center justify-between"
                >
                  <span>{bulkBank ? bulkBank.name : "Select Recipient Bank"}</span>
                  <span className="material-symbols-outlined text-gray-400">unfold_more</span>
                </button>
              </div>

              {showBulkBankSelector && (
                <div className="space-y-2 border border-gray-200 rounded-xl p-2 bg-white max-h-40 overflow-y-auto">
                  <input
                    type="text"
                    placeholder="Search bank..."
                    value={bankSearchQuery}
                    onChange={(e) => setBankSearchQuery(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
                  />
                  {filteredBanks.map((b) => (
                    <button
                      key={b.id || b.code}
                      type="button"
                      onClick={() => {
                        setBulkBank(b);
                        setShowBulkBankSelector(false);
                      }}
                      className="w-full text-left p-1.5 hover:bg-gray-100 rounded-lg text-xs font-bold"
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
              )}

              <input
                type="number"
                placeholder="10-digit Account Number"
                value={bulkAccount}
                onChange={(e) => setBulkAccount(e.target.value.slice(0, 10))}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
              />

              {isBulkResolving && <p className="text-xs text-[#FC7A00] font-bold animate-pulse">Resolving recipient name...</p>}
              {bulkName && <p className="text-xs text-emerald-600 font-bold">Name: {bulkName}</p>}

              <input
                type="number"
                placeholder={`Amount (Min ₦${activeMinTransfer})`}
                value={bulkAmountVal}
                onChange={(e) => setBulkAmountVal(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
              />

              <button
                type="button"
                onClick={handleAddBulkRecipient}
                className="w-full py-3 bg-gray-900 text-white text-xs font-bold rounded-xl"
              >
                + Add to Batch
              </button>
            </div>

            {/* Recipient Batch List */}
            {bulkRecipients.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-gray-700">
                  <span>Batch Recipients ({bulkRecipients.length})</span>
                  <span className="font-mono text-[#FC7A00]">Total: ₦{bulkTotalAmount.toLocaleString()}</span>
                </div>

                <div className="max-h-40 overflow-y-auto space-y-2">
                  {bulkRecipients.map((rec, idx) => (
                    <div key={idx} className="p-3 bg-gray-50 border border-gray-200 rounded-xl flex items-center justify-between">
                      <div>
                        <p className="font-hanken text-xs font-bold text-gray-900">{rec.recipientName}</p>
                        <p className="font-mono text-[10px] text-gray-500">{rec.bankName} • {rec.accountNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-gray-900">₦{rec.amount.toLocaleString()}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveBulkRecipient(idx)}
                          className="text-rose-500 hover:text-rose-700"
                        >
                          <span className="material-symbols-outlined text-sm">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={() => setTrfStep("confirm")}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all mt-2"
                >
                  Proceed to Confirm
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 2: Enter Amount & Narration (Single Transfer) */}
        {!isBulkMode && trfStep === "amount" && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl">
              <p className="text-[10px] font-bold text-gray-400 uppercase">Transferring To</p>
              <p className="font-hanken text-sm font-black text-gray-900">{trfAccountName}</p>
              <p className="font-mono text-xs text-gray-500">{trfBank?.name} • {trfAccount}</p>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Transfer Amount (Min ₦{activeMinTransfer})</label>
              <div className="relative mt-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-lg text-gray-500">₦</span>
                <input
                  type="number"
                  placeholder="0.00"
                  value={trfAmount}
                  onChange={(e) => setTrfAmount(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-10 pr-4 py-3.5 font-mono text-lg font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00]"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase text-gray-400">Narration / Note (Optional)</label>
              <input
                type="text"
                placeholder={`e.g. Transfer To ${trfAccountName}`}
                value={trfNarration}
                onChange={(e) => setTrfNarration(e.target.value)}
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-bold text-gray-900 focus:outline-none focus:border-[#FC7A00] mt-1"
              />
            </div>

            {trfFee > 0 && (
              <div className="p-3 bg-orange-50 border border-orange-200 rounded-xl space-y-1 font-mono text-xs">
                <div className="flex justify-between text-gray-600">
                  <span>Transfer Fee:</span>
                  <span>₦{trfFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-gray-900 font-bold pt-1 border-t border-orange-200">
                  <span>Total Debit:</span>
                  <span className="text-[#FC7A00]">₦{trfTotalDebit.toFixed(2)}</span>
                </div>
              </div>
            )}

            <button
              type="button"
              disabled={!trfAmount || parseFloat(trfAmount) < activeMinTransfer}
              onClick={() => setTrfStep("confirm")}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              Review Transfer
            </button>
          </div>
        )}

        {/* STEP 3: Confirm Transfer Screen */}
        {trfStep === "confirm" && (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl space-y-3">
              <p className="text-[10px] font-bold uppercase text-gray-400">Summary</p>

              {!isBulkMode ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Recipient:</span>
                    <span className="font-extrabold text-gray-900">{trfAccountName}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Bank & Account:</span>
                    <span className="font-mono text-gray-900">{trfBank?.name} ({trfAccount})</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Amount:</span>
                    <span className="font-mono text-gray-900">₦{parseFloat(trfAmount).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Transfer Fee:</span>
                    <span className="font-mono text-gray-900">₦{trfFee.toFixed(2)}</span>
                  </div>
                  {trfNarration && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-500 font-bold">Note:</span>
                      <span className="font-bold text-gray-800">{trfNarration}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-bold border-t border-gray-200 pt-2 text-[#FC7A00]">
                    <span>Total Deduction:</span>
                    <span className="font-mono">₦{trfTotalDebit.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Total Recipients:</span>
                    <span className="font-bold text-gray-900">{bulkRecipients.length}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500 font-bold">Total Principal:</span>
                    <span className="font-mono text-gray-900">₦{bulkTotalAmount.toLocaleString()}</span>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setTrfPin("");
                setTrfStep("pin");
              }}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              Authorize PIN
            </button>
          </div>
        )}

        {/* STEP 4: Authorize PIN Screen */}
        {trfStep === "pin" && (
          <div className="space-y-5 text-center py-2">
            <div>
              <h4 className="font-hanken font-extrabold text-sm text-gray-900">Enter Your 4-Digit Transaction PIN</h4>
              <p className="font-hanken text-xs text-gray-500 mt-1">Authorize transfer of funds</p>
            </div>

            {/* PIN Indicator Dots */}
            <div className="flex items-center justify-center gap-4 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all ${
                    trfPin.length > i
                      ? "bg-[#FC7A00] border-[#FC7A00] scale-110"
                      : "border-gray-300 bg-gray-100"
                  }`}
                />
              ))}
            </div>

            {/* Numeric Keypad Grid */}
            <div className="grid grid-cols-3 gap-3 max-w-xs mx-auto">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "CLEAR", "0", "backspace"].map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === "CLEAR") {
                      setTrfPin("");
                    } else if (key === "backspace") {
                      setTrfPin((prev) => prev.slice(0, -1));
                    } else if (trfPin.length < 4) {
                      setTrfPin((prev) => prev + key);
                    }
                  }}
                  className="h-12 rounded-2xl bg-gray-100 hover:bg-gray-200 active:scale-95 font-mono text-base font-bold text-gray-900 flex items-center justify-center transition-all"
                >
                  {key === "backspace" ? (
                    <span className="material-symbols-outlined text-xl">backspace</span>
                  ) : key === "CLEAR" ? (
                    <span className="text-[10px] font-extrabold tracking-wider text-rose-500">CLR</span>
                  ) : (
                    key
                  )}
                </button>
              ))}
            </div>

            <button
              type="button"
              disabled={trfPin.length !== 4 || isExecutingTransfer || isExecutingBulk}
              onClick={isBulkMode ? handleExecuteBulkTransfer : handleExecuteSingleTransfer}
              className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:opacity-50 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
            >
              {isExecutingTransfer || isExecutingBulk ? "Processing..." : "Confirm & Send"}
            </button>
          </div>
        )}

        {/* STEP 5: Completion Screen */}
        {trfStep === "completion" && (
          <div className="space-y-4 text-center py-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-3xl">check_circle</span>
            </div>

            <h3 className="font-hanken font-extrabold text-lg text-gray-900">Transfer Completed</h3>
            <p className="font-hanken text-xs text-gray-500">Your transfer request was processed successfully.</p>

            {transferResult && (
              <button
                type="button"
                onClick={() => setShowReceiptModal(true)}
                className="py-2.5 px-5 bg-gray-100 border border-gray-200 rounded-xl font-hanken text-xs font-bold text-gray-800 hover:bg-gray-200 transition-all flex items-center gap-2 mx-auto"
              >
                <span className="material-symbols-outlined text-base">receipt_long</span>
                View Receipt
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="w-full py-3.5 bg-gray-900 text-white font-hanken text-xs font-bold rounded-2xl"
            >
              Done
            </button>
          </div>
        )}
      </motion.div>

      {/* Transaction Receipt Modal Overlay */}
      {showReceiptModal && transferResult && (
        <TransactionReceipt
          transaction={transferResult}
          onClose={() => setShowReceiptModal(false)}
        />
      )}
    </div>
  );
};

export default React.memo(TransferModal);
