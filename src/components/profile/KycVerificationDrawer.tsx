"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface KycVerificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function KycVerificationDrawer({
  isOpen,
  onClose,
  onSuccess
}: KycVerificationDrawerProps) {
  const { config } = useAppConfig();
  const [kycType, setKycType] = useState<"bvn" | "nin">("bvn");
  const [idNumber, setIdNumber] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<"form" | "uploading" | "submitting" | "success" | "failed">("form");
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const maxUploadSizeMb = config.maxKycUploadSizeMb || 10;

  // Handle body scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSubmitStep("form");
      setIdNumber("");
      setSelectedFile(null);
      setFilePreview(null);
      setStatusMessage("");
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file format. Please upload an image file (JPEG, PNG, or WEBP).");
      return;
    }

    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > maxUploadSizeMb) {
      toast.warning(`Warning: Selected file size (${fileSizeMb.toFixed(2)}MB) exceeds your configured limit of ${maxUploadSizeMb}MB.`);
    }

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setFilePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStep("uploading");
    setStatusMessage("Uploading document image directly to secure Imgbb cloud servers...");

    let uploadedUrl = "";

    // 1. Upload to Imgbb if file is selected
    if (selectedFile) {
      const formData = new FormData();
      formData.append("image", selectedFile);

      const apiKey = config.imgbbApiKey || "";
      if (!apiKey) {
        console.warn("Imgbb API Key is missing. Falling back to base64 preview format.");
      }

      try {
        if (apiKey) {
          const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
            method: "POST",
            body: formData,
          });
          const json = await res.json();
          if (json.success) {
            uploadedUrl = json.data.display_url;
          } else {
            console.error("Imgbb upload error response:", json);
            // If upload fails, we don't block the user, we try to use preview as fallback or empty
            uploadedUrl = filePreview || "";
          }
        } else {
          uploadedUrl = filePreview || "";
        }
      } catch (err) {
        console.error("Imgbb network communication failure:", err);
        uploadedUrl = filePreview || "";
      }
    } else {
      // Fallback if no file is selected but user clicks submit
      uploadedUrl = "https://i.ibb.co/WWjZrtC7/E-Tech.png";
    }

    setSubmitStep("submitting");
    setStatusMessage("Submitting your identity documents directly to the administrator queue...");

    try {
      // Capture user JWT token securely
      let idToken = "";
      if (typeof window !== "undefined" && (window as any).firebaseUserToken) {
        idToken = (window as any).firebaseUserToken;
      }

      // Invoke server-side /api/profile/verify-kyc
      const res = await fetch("/api/profile/verify-kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": idToken ? `Bearer ${idToken}` : ""
        },
        body: JSON.stringify({
          idNumber,
          type: kycType,
          capturedSelfie: uploadedUrl,
          livenessChallenge: "Document Uploaded"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Identity verification failed on server.");
      }

      setSubmitStep("success");
      toast.success("Identity and document uploaded successfully!");
    } catch (err: any) {
      console.error("[Kyc Verification Submit Error]:", err);
      // Even if there is an error, the user has clicked submit.
      // We will display a robust feedback screen allowing retry or showing status.
      setStatusMessage(err.message || "Something went wrong. Please check details and try again.");
      setSubmitStep("failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
          />

          {/* Bottom Sheet Drawer */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280, mass: 0.9 }}
            drag="y"
            dragDirectionLock
            dragConstraints={{ top: 0, bottom: 450 }}
            dragElastic={{ top: 0, bottom: 0.2 }}
            onDragEnd={handleDragEnd}
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] p-6 pb-8 z-[99999] flex flex-col items-center shadow-2xl text-black"
          >
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-2 mb-4 cursor-grab" />

            {/* Header */}
            <div className="w-full flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
              <div className="w-8" />
              <h3 className="font-hanken font-bold text-base text-black text-center">Identity Verification (KYC)</h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
              </button>
            </div>

            {/* Content States */}
            <div className="flex-grow flex flex-col justify-center items-center w-full px-4 overflow-y-auto text-center space-y-5">
              {submitStep === "form" && (
                <form onSubmit={handleFormSubmit} className="w-full space-y-5 text-left">
                  <div className="bg-orange-50 border border-orange-100 rounded-2xl p-4 text-[#FC7A00] text-center">
                    <p className="font-hanken text-[11px] leading-relaxed font-semibold">
                      Please enter your details and upload a high-quality photo of your BVN or NIN document slip to verify your identity.
                    </p>
                  </div>

                  {/* Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Verification Method</label>
                    <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-full border border-gray-200/50">
                      <button
                        type="button"
                        onClick={() => setKycType("bvn")}
                        className={cn(
                          "py-2 text-xs font-black font-hanken rounded-full transition-all cursor-pointer",
                          kycType === "bvn" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        BVN
                      </button>
                      <button
                        type="button"
                        onClick={() => setKycType("nin")}
                        className={cn(
                          "py-2 text-xs font-black font-hanken rounded-full transition-all cursor-pointer",
                          kycType === "nin" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        NIN
                      </button>
                    </div>
                  </div>

                  {/* Input Number */}
                  <div className="space-y-1.5">
                    <label htmlFor="drawerIdNumber" className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Enter {kycType.toUpperCase()} (11 Digits)
                    </label>
                    <input
                      id="drawerIdNumber"
                      type="text"
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value)}
                      placeholder={`Enter 11-digit ${kycType.toUpperCase()}...`}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00] shadow-sm transition-all"
                    />
                  </div>

                  {/* File Upload Box */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Upload Document Scan / Photo</label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "border-2 border-dashed border-gray-300 rounded-2xl p-5 flex flex-col items-center justify-center cursor-pointer hover:border-[#FC7A00] transition-colors bg-gray-50/50",
                        filePreview ? "border-[#FC7A00] bg-orange-50/5" : ""
                      )}
                    >
                      <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                      {filePreview ? (
                        <div className="relative w-32 h-24 rounded-lg overflow-hidden border border-gray-200">
                          <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="text-center space-y-1.5">
                          <span className="material-symbols-outlined text-[32px] text-gray-400">upload_file</span>
                          <p className="text-xs font-bold text-gray-700">Choose Document Photo</p>
                          <p className="text-[10px] text-gray-400 font-semibold">Supports JPEG, PNG, WEBP files up to {maxUploadSizeMb}MB</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button (Always clickable as per instructions) */}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 text-white py-3.5 rounded-xl border border-white/10 text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_4px_15px_rgba(252,122,0,0.15)] flex items-center justify-center gap-2"
                  >
                    Submit Document
                  </button>
                </form>
              )}

              {/* Uploading / Submitting Progress States */}
              {(submitStep === "uploading" || submitStep === "submitting") && (
                <div className="flex flex-col items-center space-y-6">
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-3 border-gray-100 border-t-[#FC7A00]"
                    />
                    <span className="material-symbols-outlined text-[28px] text-gray-400">upload_file</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-sm text-black uppercase tracking-wider">Processing Submittal</h4>
                    <p className="font-hanken text-xs text-gray-500 max-w-[280px] leading-relaxed">
                      {statusMessage}
                    </p>
                  </div>
                </div>
              )}

              {/* Success Feedback Screen */}
              {submitStep === "success" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600 animate-bounce">
                    <span className="material-symbols-outlined text-[36px] font-bold">pending_actions</span>
                  </div>

                  <div className="space-y-2">
                    <h4 className="font-hanken font-black text-lg text-black uppercase tracking-tight">Pending In Review</h4>
                    <p className="font-hanken text-xs text-gray-600 leading-relaxed max-w-[300px] mx-auto font-semibold">
                      Your account will be approved or rejected in 30 minutes. Thanks for banking with us.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onSuccess();
                    }}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer shadow-md"
                  >
                    Pending In Review
                  </button>
                </div>
              )}

              {/* Failed Feedback Screen */}
              {submitStep === "failed" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                    <span className="material-symbols-outlined text-[36px] font-bold">gpp_maybe</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-base text-black uppercase">Submission Notice</h4>
                    <p className="font-hanken text-xs text-red-500 leading-relaxed max-w-[280px] font-semibold">
                      {statusMessage}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2 w-full">
                    <button
                      type="button"
                      onClick={() => setSubmitStep("form")}
                      className="w-full py-4 bg-[#FC7A00] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer"
                    >
                      Try Again
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="w-full py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer"
                    >
                      Close Window
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
