"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

interface Category {
  id: string;
  name: string;
  icon: string;
}

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

const CATEGORIES: Category[] = [
  { id: "AIRTIME", name: "Airtime", icon: "call" },
  { id: "DATA", name: "Mobile Data", icon: "network_wifi" },
  { id: "CABLE", name: "Cable TV", icon: "tv" },
  { id: "UTILITY", name: "Electricity Bills", icon: "bolt" },
  { id: "INTERNET", name: "Internet Fiber", icon: "language" },
];

export default function StorePage() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Wallet Balance sync
  const balance = Number(userData?.balance) || 0;

  // Dynamic States
  const [activeCategory, setActiveCategory] = useState<string>("AIRTIME");
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

  // Payment Success Screen States
  const [successReceipt, setSuccessReceipt] = useState<{ reference?: string; tx_ref?: string; amount?: number } | null>(null);

  // Fetch billers when activeCategory changes
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
        const res = await fetch(`/api/bills/billers?category=${activeCategory}`);
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
  }, [activeCategory]);

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
        throw new Error(resData.error || "Customer validation failed. Check customer number.");
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

    const finalAmount = selectedItem.is_fixed_amount ? selectedItem.amount : Number(customAmount);
    if (!finalAmount || finalAmount <= 0) {
      toast.error("Please specify a valid payment amount.");
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

  // PIN entry handlers
  const handlePinPress = (num: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      if (nextPin.length === 4) {
        executePayment(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
  };

  // Final Payment execution
  const executePayment = async (pin: string) => {
    setIsPaying(true);
    setIsPinModalOpen(false);
    toast.loading("Processing your utility debit transaction...");

    const finalAmount = selectedItem?.is_fixed_amount ? selectedItem.amount : Number(customAmount);

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
          biller_type: activeCategory.toLowerCase(),
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
    switch (activeCategory) {
      case "AIRTIME":
      case "DATA":
        return "Phone Number";
      case "CABLE":
        return "Smartcard / Decoder Number";
      case "UTILITY":
        return "Meter Number";
      default:
        return "Customer Identifier";
    }
  };

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Title Row */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                payments
              </span>
            </div>
            <div>
              <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black">
                Bill Payments Center
              </h1>
              <p className="font-hanken text-[11px] text-gray-500 font-medium">
                Settle bills instantly using your NGN balance
              </p>
            </div>
          </div>

          {/* Interactive Category Selector (Fluid layout) */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-2 mb-6 w-full -mx-2 px-2">
            {CATEGORIES.map((cat) => {
              const isActive = cat.id === activeCategory;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-full border font-hanken text-[11px] font-bold tracking-wide uppercase transition-all duration-300 flex-shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-gradient-to-r from-[#FC7A00] to-[#E06600] border-transparent text-white shadow-md shadow-orange-500/10"
                      : "bg-white border-gray-150 hover:bg-gray-50 text-gray-500"
                  }`}
                >
                  <span className="material-symbols-outlined text-[15px]">{cat.icon}</span>
                  {cat.name}
                </button>
              );
            })}
          </div>

          <AnimatePresence mode="wait">
            {successReceipt ? (
              // --- GLASSMORPHIC SUCCESS SCREEN / RECEIPT ---
              <motion.div
                key="receipt"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="bg-gradient-to-b from-[#FAF8F5] to-white rounded-[24px] border border-gray-150 p-6 shadow-xl flex flex-col items-center text-center relative overflow-hidden"
              >
                {/* Visual Stamp */}
                <div className="absolute right-[-10px] top-[-10px] text-[120px] text-emerald-500/5 select-none font-bold rotate-12 pointer-events-none">
                  PAID
                </div>

                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-inner animate-bounce-subtle">
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
                <div className="w-full bg-white border border-gray-150 rounded-2xl p-4 space-y-3 text-left font-hanken text-xs mb-6 shadow-sm">
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
                      ₦{Number(successReceipt.amount || selectedItem?.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessReceipt(null);
                    setCustomerId("");
                    setCustomAmount("");
                    setValidatedName("");
                    setSelectedBiller(null);
                    setSelectedItem(null);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
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
                className="bg-white rounded-[24px] border border-gray-150 p-6 shadow-xl space-y-5"
              >
                {/* Step 1: Select Biller Provider */}
                <div className="space-y-1.5 text-left">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    Select Utility Provider
                  </label>
                  {isBillersLoading ? (
                    <div className="h-14 bg-gray-50 border border-gray-200 rounded-2xl animate-pulse" />
                  ) : (
                    <select
                      value={selectedBiller?.id || ""}
                      onChange={(e) => {
                        const biller = billers.find((b) => b.id === Number(e.target.value)) || null;
                        setSelectedBiller(biller);
                      }}
                      className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 font-hanken text-xs font-extrabold text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all cursor-pointer"
                    >
                      <option value="">Choose Provider...</option>
                      {billers.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Step 2: Select Package Item */}
                {selectedBiller && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-1.5 text-left"
                  >
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      Select Package / Plan
                    </label>
                    {isItemsLoading ? (
                      <div className="h-14 bg-gray-50 border border-gray-200 rounded-2xl animate-pulse" />
                    ) : (
                      <select
                        value={selectedItem?.id || ""}
                        onChange={(e) => {
                          const item = items.find((i) => i.id === Number(e.target.value)) || null;
                          setSelectedItem(item);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 font-hanken text-xs font-extrabold text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">Choose Package...</option>
                        {items.map((i) => (
                          <option key={i.id} value={i.id}>
                            {i.name} {i.is_fixed_amount ? `(₦${i.amount.toLocaleString()})` : "(Flexible price)"}
                          </option>
                        ))}
                      </select>
                    )}
                  </motion.div>
                )}

                {/* Step 3: Enter Customer ID (Smartcard/Decoder/Meter/Phone) */}
                {selectedItem && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    className="space-y-4"
                  >
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        {getCustomerFieldLabel()}
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={`Enter ${getCustomerFieldLabel().toLowerCase()}`}
                          value={customerId}
                          onChange={(e) => setCustomerId(e.target.value)}
                          className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 font-mono font-bold text-sm text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
                        />
                        {/* Validation Action inside input if applicable */}
                        {customerId.length >= 6 && (
                          <button
                            type="button"
                            onClick={handleValidateCustomer}
                            disabled={isValidating}
                            className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#FFF0E0] hover:bg-[#FFE0CC] text-primary text-[10px] font-black uppercase px-3 py-2 rounded-xl active:scale-95 transition-all"
                          >
                            {isValidating ? "Validating..." : "Verify Recipient"}
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

                    {/* Step 4: Handle Amount (Fixed or Flexible) */}
                    {!selectedItem.is_fixed_amount ? (
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
                            placeholder="Amount (e.g. 2000)"
                            value={customAmount}
                            onChange={(e) => setCustomAmount(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-2xl pl-9 pr-4 py-4 font-mono font-black text-base text-black outline-none focus:border-[#FC7A00] focus:bg-white transition-all shadow-inner"
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
                          ₦{selectedItem.amount.toLocaleString()}
                        </p>
                      </div>
                    )}

                    {/* Balance Preview Badge */}
                    <div className="bg-gray-50 rounded-xl p-3 flex justify-between items-center text-[11px] font-hanken">
                      <span className="font-semibold text-gray-500">Available Wallet Balance</span>
                      <span className="font-mono font-bold text-black">₦{balance.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={handlePayTrigger}
                      disabled={isPaying || !customerId || (!selectedItem.is_fixed_amount && !customAmount)}
                      className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
                    >
                      {isPaying ? "Processing Debit..." : "Proceed to Pay"}
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

              {/* Bottom Sheet Keypad */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 shadow-none text-black overflow-y-auto"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-5 mx-auto cursor-grab" />

                <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-5">
                  <div className="w-8" />
                  <h3 className="font-hanken font-bold text-base text-black text-center">
                    Enter Transaction PIN
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsPinModalOpen(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="space-y-5 text-center flex flex-col items-center">
                  <p className="font-hanken text-[11px] text-gray-400">
                    Provide your highly secure 4-digit PIN to approve this debit transfer.
                  </p>

                  {/* Dot indicator indicators */}
                  <div className="flex justify-center gap-3 py-1 mb-2">
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                          enteredPin.length > i ? "bg-black border-black scale-110" : "bg-transparent border-gray-200"
                        }`}
                      />
                    ))}
                  </div>

                  {/* PIN Grid keypad */}
                  <div className="grid grid-cols-3 gap-2.5 w-full max-w-[280px]">
                    {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => handlePinPress(num)}
                        className="py-4 text-base font-black font-mono border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded-xl active:scale-95 transition-all text-black cursor-pointer"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={handlePinDelete}
                      className="py-4 text-xs font-bold font-hanken border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded-xl active:scale-95 transition-all text-rose-500 cursor-pointer"
                    >
                      Delete
                    </button>
                    <button
                      type="button"
                      onClick={() => handlePinPress("0")}
                      className="py-4 text-base font-black font-mono border border-gray-100 bg-gray-50 hover:bg-gray-100 rounded-xl active:scale-95 transition-all text-black cursor-pointer"
                    >
                      0
                    </button>
                    <div className="w-full h-full" />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
