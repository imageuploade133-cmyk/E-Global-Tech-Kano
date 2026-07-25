"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import Image from "next/image";

interface Biller {
  id: number;
  name: string;
  biller_code: string;
  logo: string;
}

interface BillItem {
  id: number;
  biller_code: string;
  name: string;
  item_code: string;
  amount: number;
  is_fixed_amount: boolean;
}

const AIRTIME_PRESETS = [100, 200, 500, 1000, 2000, 5000];

export default function GenericBillPage() {
  const { userData, user } = useAuth();
  const searchParams = useSearchParams();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [pagePreloading, setPagePreloading] = useState(true);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const timer = setTimeout(() => {
      setPagePreloading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Wallet Balance sync
  const balance = Number(userData?.balance) || 0;

  // Determine Category from URL query or default to AIRTIME
  const pageCategory = (searchParams.get("type") || "AIRTIME").toUpperCase();

  // Dynamic States
  const [billers, setBillers] = useState<Biller[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);

  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedItem, setSelectedItem] = useState<BillItem | null>(null);

  const [customerId, setCustomerId] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [validatedName, setValidatedName] = useState<string>("");

  // Loading States
  const [isBillersLoading, setIsBillersLoading] = useState<boolean>(false);
  const [isItemsLoading, setIsItemsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // PIN Pad Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([]);

  // Payment Success Screen States
  const [successReceipt, setSuccessReceipt] = useState<{ reference?: string; tx_ref?: string; amount?: number } | null>(null);

  const getPageTitle = () => {
    switch (pageCategory) {
      case "AIRTIME": return "Buy Airtime";
      case "DATA": return "Buy Mobile Data";
      case "BETTING": return "Betting Account Funding";
      case "CABLE": return "Cable TV Bills";
      case "UTILITY": return "Electricity Utility Bills";
      case "INTERNET": return "Internet Subscriptions";
      default: return "Bill Payments";
    }
  };

  const getPageIcon = () => {
    switch (pageCategory) {
      case "AIRTIME": return "call";
      case "DATA": return "network_wifi";
      case "BETTING": return "sports_basketball";
      case "CABLE": return "tv";
      case "UTILITY": return "bolt";
      case "INTERNET": return "language";
      default: return "payments";
    }
  };

  // Suffle Keypad logic matching Auth PIN Page
  const shuffleKeypad = () => {
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    setKeypadNumbers(numbers);
  };

  useEffect(() => {
    shuffleKeypad();
  }, [isPinModalOpen]);

  // Prevent background scrolling while pay bills PIN keypad modal is active
  useEffect(() => {
    if (isPinModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPinModalOpen]);

  // Fetch billers when pageCategory changes
  useEffect(() => {
    async function fetchBillers() {
      setIsBillersLoading(true);
      setSelectedBiller(null);
      setSelectedItem(null);
      setItems([]);
      setCustomerId("");
      setCustomAmount("");
      setValidatedName("");

      try {
        // Map page category to API expected category code
        const apiCategory = pageCategory === "DATA" ? "MOBILEDATA" : pageCategory;
        const res = await fetch(`/api/bills/billers?category=${apiCategory}`);
        if (!res.ok) throw new Error("Failed to load billing providers.");
        const data = await res.json();
        setBillers(data.data || []);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error fetching billers:", error.message);
        toast.error("Unable to load billing providers.");
      } finally {
        setIsBillersLoading(false);
      }
    }
    fetchBillers();
  }, [pageCategory]);

  // Fetch items/packages when selectedBiller changes
  useEffect(() => {
    if (!selectedBiller) return;

    async function fetchItems() {
      setIsItemsLoading(true);
      setSelectedItem(null);
      setCustomerId("");
      setCustomAmount("");
      setValidatedName("");

      try {
        const res = await fetch(`/api/bills/items?biller_code=${selectedBiller?.biller_code}`);
        if (!res.ok) throw new Error("Failed to load packages.");
        const data = await res.json();
        setItems(data.data || []);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error fetching items:", error.message);
        toast.error("Unable to load billing packages.");
      } finally {
        setIsItemsLoading(false);
      }
    }
    fetchItems();
  }, [selectedBiller]);

  // Parse details for data plan presentation
  const parseDataPlan = (name: string) => {
    const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
    const durationMatch = name.match(/\(([^)]+)\)/);

    const gbSize = sizeMatch ? sizeMatch[1] : "";
    const duration = durationMatch ? durationMatch[1] : "30 Days";

    let cleanedName = name;
    if (sizeMatch && gbSize) {
      cleanedName = name.replace(sizeMatch[0], "").replace(/\([^)]+\)/, "").trim();
    }
    // Clean up brand prefixes
    cleanedName = cleanedName.replace(/^(MTN|GLO|Airtel|9mobile|Smile|Spectranet)\s+(Mobile\s+)?(Data\s+)?(Plan\s+)?/i, "");

    return {
      size: gbSize || "Data Plan",
      duration,
      displayName: cleanedName || "Standard Plan"
    };
  };

  // Compute final transaction amount dynamically
  const finalAmount = selectedItem
    ? (selectedItem.is_fixed_amount ? selectedItem.amount : Number(customAmount))
    : 0;

  // Frontend input validation checks
  const isAirtimeInvalid = pageCategory === "AIRTIME" && (Number(customAmount) < 100 || Number(customAmount) > 50000);

  // Interactive Validation handler
  const handleValidateCustomer = async () => {
    if (!selectedBiller || !selectedItem || !customerId) {
      toast.error("Please select a provider, package, and enter your customer ID.");
      return;
    }

    setIsValidating(true);
    setValidatedName("");

    try {
      const res = await fetch("/api/bills/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          item_code: selectedItem.item_code,
          customer_id: customerId,
          biller_code: selectedBiller.biller_code,
        }),
      });

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || "Customer validation failed. Check customer ID.");
      }

      setValidatedName(resData.data.name || "VALIDATED CUSTOMER");
      toast.success("Billing verification successful!");
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[Customer Validation Error]:", error.message);
      toast.error(error.message || "Unable to verify recipient with provider.");
    } finally {
      setIsValidating(false);
    }
  };

  // Submit trigger
  const handlePayTrigger = () => {
    if (!selectedBiller || !selectedItem || !customerId) {
      toast.error("Please fill out all billing details.");
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      toast.error("Please specify a valid payment amount.");
      return;
    }

    if (isAirtimeInvalid) {
      toast.error("Airtime amount must be between ₦100 and ₦50,000.");
      return;
    }

    if (finalAmount > balance) {
      toast.error(`Insufficient balance. Required: ₦${finalAmount.toLocaleString()}, Available: ₦${balance.toLocaleString()}`);
      return;
    }

    // Open PIN pad modal
    setEnteredPin("");
    setIsPinModalOpen(true);
  };

  // PIN entry handlers matching Login page
  const handlePinPress = (num: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      shuffleKeypad();
      if (nextPin.length === 4) {
        executePayment(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    shuffleKeypad();
  };

  // Final Payment execution
  const executePayment = async (pin: string) => {
    setIsPaying(true);
    setIsPinModalOpen(false);
    toast.loading("Processing your utility debit transaction...");

    try {
      const idToken = await user?.getIdToken();

      const res = await fetch("/api/bills/pay", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          biller_code: selectedBiller?.biller_code,
          item_code: selectedItem?.item_code,
          amount: finalAmount,
          customer_id: customerId,
          biller_name: selectedBiller?.name,
          biller_type: pageCategory.toLowerCase(),
          pin,
        }),
      });

      const data = await res.json();
      toast.dismiss();

      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to process bill payment.");
      }

      // Success
      setSuccessReceipt(data.data);
      toast.success("Bill payment processed successfully!");
    } catch (err: unknown) {
      const error = err as Error;
      toast.dismiss();
      toast.error(error.message || "Your bill payment failed. Funds are intact.");
    } finally {
      setIsPaying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getCustomerFieldLabel = () => {
    switch (pageCategory) {
      case "AIRTIME":
      case "DATA":
        return "Phone Number";
      case "BETTING":
        return "User ID";
      case "CABLE":
        return "Smartcard / Decoder Number";
      case "UTILITY":
        return "Meter Number";
      default:
        return "Customer Identifier";
    }
  };

  // Sort and group packages by amount ascending for robust design
  const sortedItems = [...items].sort((a, b) => a.amount - b.amount);

  if (pagePreloading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] p-6">
        <div className="relative flex flex-col items-center">
          <div className="flex flex-col items-center p-5 rounded-2xl bg-white/40 backdrop-blur-md border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[2px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="relative w-6 h-6 bg-white rounded-full p-1 shadow-sm flex items-center justify-center"
              >
                <Image
                  src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
                  alt="E-Tech Logo"
                  width={16}
                  height={16}
                  className="object-contain"
                  priority
                />
              </motion.div>
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="mt-3 font-hanken font-bold text-[8px] tracking-[0.25em] uppercase text-gray-500 select-none"
            >
              E-TECH HUB
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Title Row with Back History Button */}
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center flex-shrink-0 shadow-none">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  {getPageIcon()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bodoni text-[18px] min-[375px]:text-[20px] font-bold tracking-tight text-black truncate">
                  {getPageTitle()}
                </h1>
                <p className="font-hanken text-[11px] text-gray-500 font-medium truncate">
                  Settle {getPageTitle().toLowerCase()} instantly using your NGN balance
                </p>
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {successReceipt ? (
              // --- GLASSMORPHIC SUCCESS SCREEN / RECEIPT ---
              <motion.div
                key="receipt"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="premium-gradient-card premium-gradient-border p-6 shadow-none flex flex-col items-center text-center relative overflow-hidden"
              >
                {/* Visual Stamp */}
                <div className="absolute right-[-10px] top-[-10px] text-[120px] text-emerald-500/5 select-none font-bold rotate-12 pointer-events-none">
                  PAID
                </div>

                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-none animate-bounce-subtle">
                  <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    check_circle
                  </span>
                </div>

                <h2 className="font-bodoni text-[20px] font-bold text-black mb-1">
                  Payment Successful
                </h2>
                <p className="font-hanken text-[11.5px] text-gray-500 max-w-[280px] leading-relaxed mb-6">
                  Sovereign transaction logged atomically in your secure ledger database.
                </p>

                {/* Receipt Grid */}
                <div className="w-full bg-white border border-gray-150 rounded-2xl p-4 space-y-3 text-left font-hanken text-xs mb-6 shadow-none">
                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Provider</span>
                    <span className="text-black font-extrabold">{selectedBiller?.name}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Package Name</span>
                    <span className="text-black font-extrabold">{selectedItem?.name}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">{getCustomerFieldLabel()}</span>
                    <span className="text-black font-mono font-bold">{customerId}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Ref Code</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-black font-mono font-bold truncate max-w-[120px]">
                        {successReceipt.reference || successReceipt.tx_ref || "N/A"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(successReceipt.reference || successReceipt.tx_ref || "N/A", "Reference")}
                        className="text-primary font-bold hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-black text-black">Total Paid Amount</span>
                    <span className="font-mono text-emerald-600 font-black text-sm">
                      ₦{Number(successReceipt.amount || finalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessReceipt(null);
                    setCustomerId("");
                    setCustomAmount("");
                    setSelectedBiller(null);
                    setSelectedItem(null);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/10 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                >
                  Pay Another Bill
                </button>
              </motion.div>
            ) : (
              // --- FORM AND INPUT CONTAINER ---
              <motion.div
                key="bill-form"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="premium-gradient-card premium-gradient-border p-6 shadow-none space-y-6"
              >
                {/* Step 1: Select Biller Provider */}
                <div className="space-y-3 text-left font-hanken">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                    Choose Network / Provider
                  </label>
                  {isBillersLoading ? (
                    <div className="grid grid-cols-2 gap-3.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-gray-50 border border-gray-200 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {billers.map((b) => {
                        const isSelected = selectedBiller?.id === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => setSelectedBiller(b)}
                            className={`p-3 rounded-2xl border text-left transition-all duration-300 flex items-center gap-3 cursor-pointer shadow-none ${
                              isSelected
                                ? "bg-orange-50/50 border-[#FC7A00]"
                                : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                            }`}
                          >
                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm tracking-tight flex-shrink-0 ${
                              isSelected ? "bg-primary text-white" : "bg-gray-200 text-gray-600"
                            }`}>
                              {b.name.substring(0, 2).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-hanken text-[11px] font-extrabold text-black truncate leading-tight">
                                {b.name}
                              </p>
                              <p className="font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                Select
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Step 2: Select Package / Plan */}
                {selectedBiller && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 text-left border-t border-gray-100 pt-5"
                  >
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                      Choose Plan / Package
                    </label>
                    {isItemsLoading ? (
                      /* --- HIGH FIDELITY SKELETON LOADER --- */
                      <div className="grid grid-cols-2 gap-3.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-28 bg-gray-50 border border-gray-150 rounded-2xl animate-pulse flex flex-col justify-between p-3.5">
                            <div className="flex justify-between items-center">
                              <div className="h-4 bg-gray-200 rounded w-12" />
                              <div className="h-3 bg-gray-200 rounded w-10" />
                            </div>
                            <div className="h-3 bg-gray-200 rounded w-20 mt-2" />
                            <div className="h-4 bg-gray-200 rounded w-1/2 mt-4" />
                          </div>
                        ))}
                      </div>
                    ) : sortedItems.length === 0 ? (
                      /* --- EMPTY STATE --- */
                      <div className="py-8 text-center text-gray-400 font-hanken text-xs font-semibold">
                        No plans available from this provider.
                      </div>
                    ) : pageCategory === "DATA" ? (
                      /* --- HIGH FIDELITY DATA PLANS GRID --- */
                      <div className="grid grid-cols-2 gap-3 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                        {sortedItems.map((i) => {
                          const isSelected = selectedItem?.id === i.id;
                          const planInfo = parseDataPlan(i.name);

                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => {
                                setSelectedItem(i);
                                setCustomAmount(i.amount.toString());
                              }}
                              className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-[120px] transition-all duration-300 cursor-pointer shadow-none ${
                                isSelected
                                  ? "bg-orange-50/50 border-[#FC7A00]"
                                  : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                              }`}
                            >
                              <div className="w-full">
                                <div className="flex justify-between items-start gap-1 w-full">
                                  <span className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-black tracking-tight leading-none ${
                                    isSelected ? "bg-[#FC7A00] text-white" : "bg-gray-200 text-gray-700"
                                  }`}>
                                    {planInfo.size}
                                  </span>
                                  <span className="text-[8px] text-gray-400 font-bold uppercase truncate">
                                    {planInfo.duration}
                                  </span>
                                </div>
                                <p className="font-hanken text-[10px] font-extrabold text-black mt-2 leading-tight line-clamp-2">
                                  {planInfo.displayName}
                                </p>
                              </div>

                              <div className="w-full text-right mt-2 pt-1 border-t border-gray-100/30 flex justify-between items-center">
                                <span className="text-[7.5px] text-gray-400 font-bold uppercase">Price</span>
                                <span className="font-mono text-[11.5px] font-black text-black">
                                  ₦{i.amount.toLocaleString()}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      /* Standard package selector (e.g. Airtime, Cable, Utility) */
                      <div className="max-h-[220px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {sortedItems.map((i) => {
                          const isSelected = selectedItem?.id === i.id;
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => {
                                setSelectedItem(i);
                                setCustomAmount("");
                              }}
                              className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-300 cursor-pointer shadow-none ${
                                isSelected
                                  ? "bg-orange-50/50 border-[#FC7A00]"
                                  : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-3">
                                <p className="font-hanken text-[12px] font-extrabold text-black leading-tight">
                                  {i.name}
                                </p>
                                <p className="font-hanken text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                                  {i.is_fixed_amount ? "Standard Package" : "Custom Payment Amount"}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-black ${
                                  isSelected ? "bg-[#FC7A00] text-white" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {i.is_fixed_amount ? `₦${i.amount.toLocaleString()}` : "Enter Amount"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Enter Customer ID (Decoder/Meter/Phone) */}
                {selectedItem && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4 border-t border-gray-100 pt-5"
                  >
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        {getCustomerFieldLabel()}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={`Enter your ${getCustomerFieldLabel().toLowerCase()}`}
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          className="w-full bg-white border border-gray-100 rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00]/40 shadow-sm transition-all"
                        />
                        {/* Validation Action inside input if applicable */}
                        {customerId.length >= 6 && (
                          <button
                            type="button"
                            onClick={handleValidateCustomer}
                            disabled={isValidating}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#FFF0E0] hover:bg-[#FFE0CC] text-primary text-[10px] font-black uppercase px-3 py-2 rounded-xl active:scale-95 transition-all"
                          >
                            {isValidating ? "Validating..." : "Verify"}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Validated Name Banner */}
                    {validatedName && (
                      <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-left">
                        <p className="text-[8px] font-black uppercase text-emerald-600 tracking-wider">
                          Verified Recipient Owner
                        </p>
                        <p className="font-hanken text-xs font-black text-emerald-700 uppercase mt-0.5">
                          {validatedName}
                        </p>
                      </div>
                    )}

                    {/* Step 4: Handle Amount & Pricing selectors */}
                    {pageCategory === "AIRTIME" ? (
                      /* --- LUXURY AIRTIME SELECT PRESET & DYNAMIC PRICE INPUT --- */
                      <div className="space-y-4 text-left">
                        <div>
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Quick Select Amount (NGN)
                          </label>
                          <div className="grid grid-cols-3 gap-2 mt-1.5">
                            {AIRTIME_PRESETS.map((preset) => {
                              const isSelected = Number(customAmount) === preset;
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setCustomAmount(preset.toString())}
                                  className={`py-3.5 rounded-2xl border font-mono font-black text-[12px] text-center active:scale-95 transition-all cursor-pointer shadow-none ${
                                    isSelected
                                      ? "bg-[#FC7A00]/10 border-[#FC7A00] text-black"
                                      : "bg-white border-gray-150 hover:bg-gray-50 text-gray-800"
                                  }`}
                                >
                                  ₦{preset.toLocaleString()}
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="space-y-1.5 pt-1">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Or Enter Amount (NGN)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-gray-400">
                              ₦
                            </span>
                            <input
                              type="number"
                              pattern="[0-9]*"
                              inputMode="numeric"
                              placeholder="Enter top-up amount manually (Min: ₦100)"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                              className="w-full bg-white border border-gray-100 rounded-2xl pl-9 pr-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00]/40 shadow-sm transition-all"
                            />
                          </div>
                          {isAirtimeInvalid && customAmount !== "" && (
                            <p className="text-[10px] text-rose-500 font-bold text-left mt-1.5">
                              Airtime amount must be between ₦100 and ₦50,000.
                            </p>
                          )}
                        </div>
                      </div>
                    ) : pageCategory === "DATA" ? (
                      /* --- LUXURY MOBILE DATA STANDARD PLAN PRICE --- */
                      <div className="space-y-3.5 text-left">
                        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 flex items-center justify-between text-left">
                          <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">
                              Plan Package Price
                            </p>
                            <p className="font-hanken text-xs font-semibold text-gray-500 mt-0.5">
                              Standard price for {selectedItem.name}
                            </p>
                          </div>
                          <p className="font-mono font-black text-lg text-black">
                            ₦{selectedItem?.amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Fallback generic categories */
                      !selectedItem.is_fixed_amount ? (
                        <div className="space-y-1.5 text-left">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            Enter Payment Amount (NGN)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-gray-400">
                              ₦
                            </span>
                            <input
                              type="number"
                              pattern="[0-9]*"
                              inputMode="numeric"
                              placeholder="Amount (e.g. 2000)"
                              value={customAmount}
                              onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                              className="w-full bg-white border border-gray-100 rounded-2xl pl-9 pr-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00]/40 shadow-sm transition-all"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 text-left flex items-center justify-between">
                          <div>
                            <p className="text-[9px] font-black uppercase text-gray-400 tracking-wider">
                              Package Fixed Amount
                            </p>
                            <p className="font-hanken text-xs font-semibold text-gray-500 mt-0.5">
                              Set by provider network
                            </p>
                          </div>
                          <p className="font-mono font-black text-lg text-black">
                            ₦{selectedItem?.amount.toLocaleString()}
                          </p>
                        </div>
                      )
                    )}

                    {/* Balance Preview Badge */}
                    <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center text-[11px] font-hanken">
                      <span className="font-semibold text-gray-500">Available Wallet Balance</span>
                      <span className="font-mono font-bold text-black">₦{balance.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayTrigger}
                      disabled={isPaying || !customerId || (pageCategory === "AIRTIME" && isAirtimeInvalid) || (finalAmount <= 0)}
                      className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/10 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
                    >
                      {isPaying ? "Processing Debit..." : `Proceed to Pay (₦${finalAmount.toLocaleString()})`}
                    </button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Dynamic transaction PIN verification keypad */}
        <AnimatePresence>
          {isPinModalOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsPinModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* Bottom Sheet Keypad matching LOGIN PIN PAGE styling (no shadow, clean grid, shuffle) */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 shadow-none text-black h-[85dvh] flex flex-col justify-between"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-3 mx-auto cursor-grab" />

                <div className="w-full flex items-center justify-between border-b border-gray-100 pb-3">
                  <div className="w-8" />
                  <h3 className="font-hanken font-bold text-base text-black text-center uppercase tracking-wide">
                    Enter Access PIN
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="flex-grow flex flex-col items-center justify-center space-y-6">
                  <p className="font-hanken text-[11px] text-gray-400 text-center max-w-[240px]">
                    Provide your highly secure 4-digit Access PIN to approve this debit transaction.
                  </p>

                  {/* Dot indicator indicators matching login page */}
                  <div className="flex justify-center gap-4 py-1">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-300 ${
                          enteredPin.length > i ? "bg-black border-black scale-110" : "bg-transparent border-gray-200"
                        }`}
                      />
                    ))}
                  </div>

                  {/* PIN Grid keypad matching Login Page exactly (shuffled) */}
                  <div className="grid grid-cols-3 gap-3 min-[360px]:gap-4 min-[410px]:gap-5 w-full max-w-[260px] min-[360px]:max-w-[290px] justify-items-center">
                    {keypadNumbers.slice(0, 9).map((num) => (
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
                        key={num}
                        type="button"
                        onClick={() => handlePinPress(num)}
                        className="w-16 h-16 min-[360px]:w-18 min-[360px]:h-18 rounded-full flex items-center justify-center text-xl font-hanken border border-gray-200 text-black cursor-pointer transition-all"
                      >
                        {num}
                      </motion.button>
                    ))}
                    <div className="w-16 h-16 min-[360px]:w-18 min-[360px]:h-18" />
                    {keypadNumbers[9] !== undefined && (
                      <motion.button
                        whileTap={{ scale: 0.9, backgroundColor: "#000000", borderColor: "#000000", color: "#FFFFFF" }}
                        onClick={() => handlePinPress(keypadNumbers[9])}
                        type="button"
                        className="w-16 h-16 min-[360px]:w-18 min-[360px]:h-18 rounded-full flex items-center justify-center text-xl font-hanken border border-gray-200 text-black cursor-pointer transition-all"
                      >
                        {keypadNumbers[9]}
                      </motion.button>
                    )}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={handlePinDelete}
                      type="button"
                      className="w-16 h-16 min-[360px]:w-18 min-[360px]:h-18 rounded-full flex items-center justify-center text-black cursor-pointer active:text-rose-500 transition-all"
                    >
                      <span className="material-symbols-outlined text-[22px] min-[360px]:text-[24px]">backspace</span>
                    </motion.button>
                  </div>
                </div>

                <div className="h-4" />
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}