"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { uploadImageSecurely } from "@/lib/image-upload";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface TransferLimitsSectionProps {
  dailyLimit?: number;
}

export function TransferLimitsSection({ dailyLimit = 500000 }: TransferLimitsSectionProps) {
  const { userData, user } = useAuth();
  const [isDrawerOpen, setIsModalDrawerOpen] = useState(false);
  const [upgradeRequest, setUpgradeRequest] = useState<any>(null);
  const [isLoadingRequest, setIsLoadingRequest] = useState(false);

  const currentTier = String(userData?.tier || (userData?.kycStatus === "VERIFIED" ? "Tier 2" : "Tier 1"));
  const singleLimit = Number(userData?.singleLimit) || (currentTier === "Tier 3" ? 10000000 : currentTier === "Tier 2" ? 2000000 : 200000);
  const numDailyLimit = Number(dailyLimit) || 500000;

  // Modal back button interception
  useModalBackHandler(isDrawerOpen, () => setIsModalDrawerOpen(false), "tier-upgrade-drawer");

  // Fetch active upgrade request state on mount and drawer open
  const fetchUpgradeRequest = async () => {
    if (!user) return;
    setIsLoadingRequest(true);
    try {
      const idToken = await user.getIdToken();
      const res = await fetch("/api/profile/tier-upgrade", {
        headers: { Authorization: `Bearer ${idToken}` }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUpgradeRequest(data.request);
      }
    } catch (err) {
      console.warn("Failed to load tier upgrade request:", err);
    } finally {
      setIsLoadingRequest(false);
    }
  };

  useEffect(() => {
    fetchUpgradeRequest();
  }, [user]);

  return (
    <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100/60 pb-3">
        <div>
          <h3 className="font-hanken font-extrabold text-xs tracking-wider uppercase text-gray-500">
            Current Tier & Transfer Limits
          </h3>
          <p className="font-hanken text-[10px] text-gray-400 mt-0.5 font-semibold">Your authorized account level and transaction limits</p>
        </div>

        <span className={cn(
          "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-2xs flex items-center gap-1",
          currentTier === "Tier 3"
            ? "bg-amber-50 text-amber-700 border-amber-200"
            : currentTier === "Tier 2"
            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
            : "bg-gray-100 text-gray-700 border-gray-200"
        )}>
          <span className="material-symbols-outlined text-[14px]">workspace_premium</span>
          {currentTier}
        </span>
      </div>

      {/* Limits Metrics Breakdown */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-50/80 border border-gray-150 rounded-2xl p-3.5 space-y-1">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 block">Daily Limit</span>
          <p className="font-hanken font-black text-base text-gray-900">
            ₦{new Intl.NumberFormat("en-NG").format(numDailyLimit)}
          </p>
        </div>

        <div className="bg-gray-50/80 border border-gray-150 rounded-2xl p-3.5 space-y-1">
          <span className="text-[9px] font-extrabold uppercase tracking-widest text-gray-400 block">Single Transfer Limit</span>
          <p className="font-hanken font-black text-base text-gray-900">
            ₦{new Intl.NumberFormat("en-NG").format(singleLimit)}
          </p>
        </div>
      </div>

      {/* Request Tier Upgrade Action Trigger */}
      <div className="pt-1">
        {upgradeRequest?.status === "PENDING" ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-amber-600 text-[20px] font-bold animate-bounce-subtle">pending_actions</span>
              <div>
                <p className="text-[11px] font-black uppercase text-amber-900 tracking-tight">Upgrade Request Under Review</p>
                <p className="text-[10px] text-amber-700 font-semibold mt-0.5">Target: {upgradeRequest.targetTier || "Tier 2"}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsModalDrawerOpen(true)}
              className="text-[10px] font-black uppercase tracking-wider text-amber-900 underline cursor-pointer"
            >
              Inspect
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsModalDrawerOpen(true)}
            className="w-full py-3.5 bg-black hover:bg-gray-900 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-sm active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">upgrade</span>
            <span>Request Tier Upgrade</span>
          </button>
        )}
      </div>

      {/* Tier Upgrade Drawer Modal */}
      <TierUpgradeDrawerModal
        isOpen={isDrawerOpen}
        onClose={() => setIsModalDrawerOpen(false)}
        upgradeRequest={upgradeRequest}
        onRequestSubmitted={() => {
          fetchUpgradeRequest();
        }}
      />
    </section>
  );
}

interface TierUpgradeDrawerModalProps {
  isOpen: boolean;
  onClose: () => void;
  upgradeRequest: any;
  onRequestSubmitted: () => void;
}

function TierUpgradeDrawerModal({
  isOpen,
  onClose,
  upgradeRequest,
  onRequestSubmitted,
}: TierUpgradeDrawerModalProps) {
  const { userData, user } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Modal Back Handler for drawer
  useModalBackHandler(isOpen, onClose, "tier-upgrade-full-drawer");

  // Form inputs auto-filled from userData
  const [fullName, setFullName] = useState("");
  const [bvn, setBvn] = useState("");
  const [targetTier, setTargetTier] = useState<"Tier 2" | "Tier 3">("Tier 2");

  // Proof of Address file uploader
  const [addressFile, setAddressFile] = useState<File | null>(null);
  const [addressPreview, setAddressPreview] = useState<string | null>(null);
  const addressInputRef = useRef<HTMLInputElement>(null);

  // Live Selfie camera/file uploader
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // 4-Digit Transaction PIN verification state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinDigits, setPinDigits] = useState<string[]>(["", "", "", ""]);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  useModalBackHandler(isPinModalOpen, () => setIsPinModalOpen(false), "tier-upgrade-pin-modal");

  useEffect(() => {
    if (isOpen) {
      setIsPinModalOpen(false);
      setPinDigits(["", "", "", ""]);
      const nameVal = userData?.name || user?.displayName || "";
      setFullName(typeof nameVal === "string" ? nameVal : String(nameVal || ""));

      const bvnVal = userData?.bvn || userData?.nin || "";
      setBvn(typeof bvnVal === "string" ? bvnVal : String(bvnVal || ""));

      setAddressFile(null);
      setAddressPreview(null);
      setSelfieFile(null);
      setSelfiePreview(null);
    }
  }, [isOpen, userData, user]);

  const handleAddressFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAddressFile(file);
    if (addressPreview && addressPreview.startsWith("blob:")) {
      URL.revokeObjectURL(addressPreview);
    }
    setAddressPreview(URL.createObjectURL(file));
  };

  const handleSelfieFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelfieFile(file);
    if (selfiePreview && selfiePreview.startsWith("blob:")) {
      URL.revokeObjectURL(selfiePreview);
    }
    setSelfiePreview(URL.createObjectURL(file));
  };

  const handlePreSubmitValidation = (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim()) {
      toast.error("Please enter your full name.");
      return;
    }

    if (!bvn || bvn.trim().length !== 11) {
      toast.error("Please enter a valid 11-digit BVN or NIN number.");
      return;
    }

    if (!addressFile && !addressPreview) {
      toast.error("Proof of address document scan is required.");
      return;
    }

    if (!selfieFile && !selfiePreview) {
      toast.error("Live selfie picture is required.");
      return;
    }

    // Open 4-digit PIN verification modal
    setPinDigits(["", "", "", ""]);
    setIsPinModalOpen(true);
  };

  const handlePinDigitPress = (digit: string) => {
    const emptyIdx = pinDigits.findIndex((d) => d === "");
    if (emptyIdx !== -1) {
      const updated = [...pinDigits];
      updated[emptyIdx] = digit;
      setPinDigits(updated);

      if (emptyIdx === 3) {
        const fullPin = updated.join("");
        executeVerifiedSubmit(fullPin);
      }
    }
  };

  const handlePinBackspace = () => {
    const lastFilledIdx = pinDigits.map((d) => d !== "").lastIndexOf(true);
    if (lastFilledIdx !== -1) {
      const updated = [...pinDigits];
      updated[lastFilledIdx] = "";
      setPinDigits(updated);
    }
  };

  const handlePinClear = () => {
    setPinDigits(["", "", "", ""]);
  };

  const executeVerifiedSubmit = async (enteredPin: string) => {
    setIsVerifyingPin(true);
    toast.loading("Verifying transaction PIN...");

    try {
      let idToken = "";
      if (user) {
        idToken = await user.getIdToken();
      }

      // 1. Verify 4-digit Transaction PIN first
      const verifyRes = await fetch("/api/auth/pin-verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const verifyData = await verifyRes.json();
      toast.dismiss();

      if (!verifyRes.ok || !verifyData.success) {
        toast.error(verifyData.error || "Invalid 4-digit Transaction PIN. Request aborted.");
        setPinDigits(["", "", "", ""]);
        setIsVerifyingPin(false);
        return;
      }

      setIsPinModalOpen(false);
      setIsSubmitting(true);
      toast.loading("Uploading documents & submitting upgrade request...");

      // 2. Upload Proof of Address
      let proofUrl = addressPreview || "";
      if (addressFile) {
        const addressUpload = await uploadImageSecurely(addressFile, "kyc_document");
        if (addressUpload.success && addressUpload.url) {
          proofUrl = addressUpload.url;
        } else {
          throw new Error(addressUpload.error || "Failed to upload proof of address document.");
        }
      }

      // 3. Upload Live Selfie
      let liveSelfieUrl = selfiePreview || "";
      if (selfieFile) {
        const selfieUpload = await uploadImageSecurely(selfieFile, "kyc_selfie");
        if (selfieUpload.success && selfieUpload.url) {
          liveSelfieUrl = selfieUpload.url;
        } else {
          throw new Error(selfieUpload.error || "Failed to upload selfie image.");
        }
      }

      // 4. Post payload to backend
      const res = await fetch("/api/profile/tier-upgrade", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          bvn: bvn.trim(),
          proofOfAddressUrl: proofUrl,
          selfieUrl: liveSelfieUrl,
          targetTier,
        }),
      });

      toast.dismiss();
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("Tier upgrade request submitted successfully!");
        onRequestSubmitted();
        onClose();
      } else {
        toast.error(data.error || "Failed to submit upgrade request.");
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "An error occurred during submission.");
    } finally {
      setIsSubmitting(false);
      setIsVerifyingPin(false);
    }
  };

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[99998]"
          />

          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
            className="fixed inset-0 w-full h-full bg-white z-[100000] flex flex-col justify-between overflow-hidden p-6 pb-8 text-black"
          >
            {/* Full-Screen Top Header Bar */}
            <div className="w-full flex items-center justify-between border-b border-gray-100 pb-4 mb-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 hover:text-black hover:bg-gray-100 transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
              </button>

              <div className="text-center">
                <h3 className="font-hanken font-black text-base text-black uppercase tracking-wider">
                  Request Tier Upgrade
                </h3>
                <p className="text-[10px] text-gray-400 font-semibold mt-0.5">Submit verification documents to unlock higher limits</p>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer active:scale-95"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">close</span>
              </button>
            </div>

            {/* Content Body */}
            {upgradeRequest?.status === "PENDING" ? (
              <div className="flex-1 overflow-y-auto space-y-5 text-center py-4">
                <div className="w-16 h-16 rounded-full bg-amber-50 border-2 border-amber-200 flex items-center justify-center text-amber-600 mx-auto animate-bounce-subtle">
                  <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    pending_actions
                  </span>
                </div>

                <div className="space-y-1.5">
                  <span className="px-3.5 py-1 text-[10px] font-black tracking-widest uppercase bg-amber-100 text-amber-900 border border-amber-300 rounded-full">
                    Under Review
                  </span>
                  <h4 className="font-bodoni text-xl font-bold text-black tracking-tight pt-1">
                    Upgrade Request Pending
                  </h4>
                  <p className="font-hanken text-xs text-gray-500 leading-relaxed max-w-xs mx-auto font-medium">
                    Your request to upgrade to <strong className="text-black">{upgradeRequest.targetTier || "Tier 2"}</strong> is under administrative review.
                  </p>
                </div>

                <div className="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-left space-y-2.5 text-xs font-semibold">
                  <div className="flex justify-between border-b pb-2 border-gray-200/60">
                    <span className="text-gray-400">Full Name</span>
                    <span className="text-black font-extrabold">{upgradeRequest.fullName}</span>
                  </div>
                  <div className="flex justify-between border-b pb-2 border-gray-200/60">
                    <span className="text-gray-400">BVN / NIN</span>
                    <span className="text-black font-mono font-bold">{upgradeRequest.bvn}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Submitted On</span>
                    <span className="text-gray-700 font-mono text-[11px]">
                      {new Date(upgradeRequest.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <form id="tier-upgrade-form" onSubmit={handlePreSubmitValidation} className="flex-1 min-h-0 overflow-y-auto space-y-4 pb-2 text-left">

                {/* Target Tier Selector */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Select Target Upgrade Tier</label>
                  <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-2xl border border-gray-200">
                    <button
                      type="button"
                      onClick={() => setTargetTier("Tier 2")}
                      className={cn(
                        "py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer uppercase tracking-wider flex flex-col items-center justify-center",
                        targetTier === "Tier 2" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-500"
                      )}
                    >
                      <span>Tier 2</span>
                      <span className="text-[9px] opacity-80 font-normal font-mono">₦5M / Day</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setTargetTier("Tier 3")}
                      className={cn(
                        "py-2.5 text-xs font-black rounded-xl transition-all cursor-pointer uppercase tracking-wider flex flex-col items-center justify-center",
                        targetTier === "Tier 3" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-500"
                      )}
                    >
                      <span>Tier 3</span>
                      <span className="text-[9px] opacity-80 font-normal font-mono">₦50M / Day</span>
                    </button>
                  </div>
                </div>

                {/* Auto-filled Full Name */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Full Name (Auto-filled)</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-extrabold text-black outline-none focus:border-[#FC7A00]"
                  />
                </div>

                {/* Auto-filled BVN / NIN */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">BVN / NIN (Auto-filled)</label>
                  <input
                    type="text"
                    required
                    maxLength={11}
                    value={bvn}
                    onChange={(e) => setBvn(e.target.value.replace(/\D/g, "").slice(0, 11))}
                    className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3 text-xs font-mono font-bold text-black outline-none focus:border-[#FC7A00]"
                  />
                </div>

                {/* Upload Proof of Address */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Proof of Address Document</label>
                  <input
                    type="file"
                    ref={addressInputRef}
                    accept="image/*"
                    onChange={handleAddressFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => addressInputRef.current?.click()}
                    className={cn(
                      "p-3.5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50/50",
                      addressPreview ? "border-emerald-500 bg-emerald-50/10" : "border-gray-300 hover:border-[#FC7A00]"
                    )}
                  >
                    {addressPreview ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-gray-200">
                          <img src={addressPreview} alt="Address Doc" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600">Proof of Address Scan Attached</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-center text-gray-500">
                        <span className="material-symbols-outlined text-[20px]">upload_file</span>
                        <span className="text-xs font-bold text-gray-700">Upload Utility Bill / Bank Statement Scan</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Upload Live Selfie */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Live Biometric Selfie Picture</label>
                  <input
                    type="file"
                    ref={selfieInputRef}
                    accept="image/*"
                    capture="user"
                    onChange={handleSelfieFileChange}
                    className="hidden"
                  />
                  <div
                    onClick={() => selfieInputRef.current?.click()}
                    className={cn(
                      "p-3.5 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors bg-gray-50/50",
                      selfiePreview ? "border-emerald-500 bg-emerald-50/10" : "border-gray-300 hover:border-[#FC7A00]"
                    )}
                  >
                    {selfiePreview ? (
                      <div className="flex items-center gap-3">
                        <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-emerald-500">
                          <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                        </div>
                        <span className="text-[11px] font-bold text-emerald-600">Live Selfie Capture Attached</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-center text-gray-500">
                        <span className="material-symbols-outlined text-[20px]">photo_camera</span>
                        <span className="text-xs font-bold text-gray-700">Take or Upload Selfie Photo</span>
                      </div>
                    )}
                  </div>
                </div>

              </form>
            )}

            {/* Anchored Bottom Action Bar */}
            <div className="pt-3 border-t border-gray-100 shrink-0 bg-white">
              {upgradeRequest?.status === "PENDING" ? (
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 bg-black text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer"
                >
                  Close Window
                </button>
              ) : (
                <button
                  type="submit"
                  form="tier-upgrade-form"
                  disabled={isSubmitting || (!addressFile && !addressPreview) || (!selfieFile && !selfiePreview)}
                  className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-wider rounded-2xl cursor-pointer hover:brightness-105 active:scale-95 transition-all shadow-sm disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting Request..." : "Submit Upgrade Request"}
                </button>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* 4-Digit Transaction PIN Verification Pad Modal */}
      <AnimatePresence>
        {isPinModalOpen && (
          <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xs bg-white rounded-3xl p-6 text-center shadow-2xl space-y-5 border border-gray-100 font-hanken text-black"
            >
              <div className="w-12 h-12 rounded-full bg-orange-50 border border-orange-100 text-[#FC7A00] flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[24px]">lock</span>
              </div>

              <div>
                <h4 className="font-extrabold text-base uppercase text-gray-900">Enter Access PIN</h4>
                <p className="text-[11px] text-gray-500 mt-1 font-semibold">
                  Enter your 4-digit transaction PIN to confirm tier limit upgrade application.
                </p>
              </div>

              {/* 4 Pin Boxes */}
              <div className="flex justify-center gap-3 py-2">
                {[0, 1, 2, 3].map((idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "w-12 h-12 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all shadow-xs",
                      pinDigits[idx] ? "border-[#FC7A00] bg-orange-50/20 text-[#FC7A00]" : "border-gray-200 text-gray-400 bg-gray-50"
                    )}
                  >
                    {pinDigits[idx] ? "•" : ""}
                  </div>
                ))}
              </div>

              {/* Numeric Keypad Grid */}
              <div className="grid grid-cols-3 gap-2 pt-2">
                {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                  <button
                    key={num}
                    type="button"
                    disabled={isVerifyingPin}
                    onClick={() => handlePinDigitPress(num)}
                    className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={handlePinClear}
                  className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-xs uppercase text-gray-600 active:scale-95 transition-all cursor-pointer"
                >
                  CLEAR
                </button>
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={() => handlePinDigitPress("0")}
                  className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                >
                  0
                </button>
                <button
                  type="button"
                  disabled={isVerifyingPin}
                  onClick={handlePinBackspace}
                  className="py-3 rounded-2xl bg-gray-100 hover:bg-gray-200 font-bold text-lg text-black active:scale-95 transition-all cursor-pointer flex items-center justify-center"
                >
                  <span className="material-symbols-outlined text-[20px]">backspace</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="w-full py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold uppercase rounded-2xl cursor-pointer"
              >
                Cancel
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AnimatePresence>,
    document.body
  );
}
