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
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState<"form" | "uploading" | "submitting" | "success" | "failed">("form");
  const [statusMessage, setStatusMessage] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const maxUploadSizeMb = config.maxKycUploadSizeMb || 10;

  // Handle body scroll locking & state resets on open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
      setSubmitStep("form");
      setIdNumber("");
      setSelectedFile(null);
      setFilePreview(null);
      setSelfiePreview(null);
      setIsCameraActive(false);
      setCameraStream(null);
      setStatusMessage("");
    } else {
      document.body.style.overflow = "";
      stopCamera();
    }
    return () => {
      document.body.style.overflow = "";
      stopCamera();
    };
  }, [isOpen]);

  const stopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    try {
      setIsCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 480 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error("[KYC Camera Error]:", err);
      toast.error("Could not access device camera. Please check permissions and try again.");
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) {
      toast.error("Camera stream is not ready yet.");
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      toast.error("Failed to capture image context.");
      return;
    }

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const base64Image = canvas.toDataURL("image/jpeg", 0.9);
    setSelfiePreview(base64Image);
    stopCamera();
    toast.success("Selfie frame captured successfully!");
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Invalid file format. Please upload an image file (JPEG, PNG, or WEBP).");
      return;
    }

    const fileSizeMb = file.size / (1024 * 1024);
    if (fileSizeMb > maxUploadSizeMb) {
      toast.warning(`Warning: Selected file size (${fileSizeMb.toFixed(2)}MB) exceeds limit of ${maxUploadSizeMb}MB.`);
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

    if (!idNumber || idNumber.length !== 11) {
      toast.error("Please enter a valid 11-digit BVN or NIN document number.");
      return;
    }

    if (!selfiePreview && !filePreview) {
      toast.error("Please either capture a live selfie or upload an identity document scan.");
      return;
    }

    setIsSubmitting(true);
    setSubmitStep("uploading");
    setStatusMessage("Uploading document selfie safely to cloud servers...");

    let uploadedUrl = "";
    const activeImageSource = selfiePreview || filePreview || "";

    // 1. Upload to Imgbb
    const apiKey = config.imgbbApiKey || "";
    if (apiKey && activeImageSource.startsWith("data:image")) {
      try {
        // Strip data prefix to get raw base64 string
        const base64Raw = activeImageSource.split(",")[1] || activeImageSource;
        const formData = new FormData();
        formData.append("image", base64Raw);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (json.success) {
          uploadedUrl = json.data.display_url;
        } else {
          console.error("Imgbb upload error response:", json);
          uploadedUrl = activeImageSource;
        }
      } catch (err) {
        console.error("Imgbb network communication failure:", err);
        uploadedUrl = activeImageSource;
      }
    } else {
      uploadedUrl = activeImageSource || "https://i.ibb.co/WWjZrtC7/E-Tech.png";
    }

    setSubmitStep("submitting");
    setStatusMessage("Submitting your identity details directly to human administrator review queue...");

    try {
      let idToken = "";
      if (typeof window !== "undefined" && (window as any).firebaseUserToken) {
        idToken = (window as any).firebaseUserToken;
      }

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
          livenessChallenge: "Face Match selfie capture"
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Identity verification failed on server.");
      }

      setSubmitStep("success");
      toast.success("Identity and documents uploaded successfully!");
    } catch (err: any) {
      console.error("[Kyc Verification Submit Error]:", err);
      setStatusMessage(err.message || "Something went wrong. Please check details and try again.");
      setSubmitStep("failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Immersive Full Screen Page Container */}
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 26, stiffness: 220, mass: 1 }}
            className="fixed inset-0 max-w-md mx-auto bg-white h-screen w-full z-[99999] flex flex-col items-center shadow-2xl text-black"
          >
            {/* Header / Top Navigation Bar */}
            <div className="w-full flex justify-between items-center bg-gray-50/50 border-b border-gray-100 px-6 py-4 flex-shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-xl border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:text-black hover:border-black active:scale-95 transition-all cursor-pointer"
              >
                <span className="material-symbols-outlined text-[20px] font-black">arrow_back</span>
              </button>
              <h3 className="font-hanken font-extrabold text-base text-black text-center tracking-tight">Identity Verification (KYC)</h3>
              <div className="w-9" />
            </div>

            {/* Hidden canvas for video captures */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Content States */}
            <div className="flex-grow flex flex-col justify-start items-center w-full px-2 overflow-y-auto text-center space-y-4">
              {submitStep === "form" && (
                <form onSubmit={handleFormSubmit} className="w-full space-y-4 text-left">

                  {/* Premium Warning banner */}
                  <div className="bg-[#FFF8EC] border border-[#FFE8CC] rounded-2xl p-4 flex gap-3 text-left">
                    <span className="material-symbols-outlined text-[#FC7A00] font-bold text-[24px] shrink-0">warning</span>
                    <div>
                      <h4 className="font-hanken font-bold text-[11px] text-[#FC7A00] uppercase tracking-wider">Verification Required</h4>
                      <p className="font-hanken text-[11px] leading-relaxed font-semibold text-[#8F4F00] mt-0.5">
                        In compliance with Central Bank of Nigeria (CBN) regulations, you must link your verified BVN/NIN and record a live selfie to unlock funding, transfers, cards, and utility payments.
                      </p>
                    </div>
                  </div>

                  {/* Selector */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Identification Document</label>
                    <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-full border border-gray-200/50">
                      <button
                        type="button"
                        onClick={() => setKycType("bvn")}
                        className={cn(
                          "py-2.5 text-xs font-black font-hanken rounded-full transition-all cursor-pointer",
                          kycType === "bvn" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        BANK VERIFICATION (BVN)
                      </button>
                      <button
                        type="button"
                        onClick={() => setKycType("nin")}
                        className={cn(
                          "py-2.5 text-xs font-black font-hanken rounded-full transition-all cursor-pointer",
                          kycType === "nin" ? "bg-[#FC7A00] text-white shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        NATIONAL ID (NIN)
                      </button>
                    </div>
                  </div>

                  {/* Input Number */}
                  <div className="space-y-1.5">
                    <label htmlFor="drawerIdNumber" className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Enter your 11-digit {kycType.toUpperCase()} number
                    </label>
                    <input
                      id="drawerIdNumber"
                      type="text"
                      maxLength={11}
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.replace(/\D/g, "").slice(0, 11))}
                      placeholder="22553441111"
                      className="w-full bg-white border border-gray-300 rounded-2xl px-4 py-3.5 text-xs font-bold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00] shadow-sm transition-all"
                    />
                  </div>

                  {/* Selfie match circular box camera */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block text-left">
                      Biometric Live Selfie Match
                    </label>

                    <div className="border-2 border-dashed border-[#00C060] rounded-2xl p-4 flex flex-col items-center justify-center bg-gray-50/50 relative overflow-hidden">
                      {selfiePreview ? (
                        <div className="flex flex-col items-center space-y-3">
                          <div className="relative w-28 h-26 rounded-full overflow-hidden border-4 border-[#00C060] shadow-md">
                            <img src={selfiePreview} alt="Selfie Capture" className="w-full h-full object-cover" />
                          </div>
                          <div className="flex items-center gap-1.5 text-[#00C060] font-black text-xs uppercase tracking-wide">
                            <span className="material-symbols-outlined text-[18px] font-bold">check_circle</span>
                            <span>Selfie Capture Saved</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSelfiePreview(null);
                              startCamera();
                            }}
                            className="text-xs text-gray-500 hover:text-black font-bold underline cursor-pointer"
                          >
                            Tap to capture another picture
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={startCamera}
                          className="flex flex-col items-center justify-center text-center space-y-2 py-3 cursor-pointer hover:bg-gray-100/50 w-full transition-colors rounded-xl"
                        >
                          <div className="w-12 h-12 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-[#00C060] animate-pulse">
                            <span className="material-symbols-outlined text-[24px] font-bold">photo_camera</span>
                          </div>
                          <p className="text-[11px] font-bold text-gray-700">Open Camera & Take Selfie</p>
                          <p className="text-[9px] text-gray-400 font-semibold">Align face to document for verification match</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* File Upload Box (Optional Fallback) */}
                  <div className="space-y-1">
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className={cn(
                        "border border-dashed border-gray-300 rounded-xl p-3.5 flex flex-col items-center justify-center cursor-pointer hover:border-[#FC7A00] transition-colors bg-gray-50/50",
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
                        <div className="flex items-center gap-3">
                          <div className="relative w-12 h-10 rounded-lg overflow-hidden border border-gray-200">
                            <img src={filePreview} alt="Preview" className="w-full h-full object-cover" />
                          </div>
                          <p className="text-[10px] font-bold text-[#FC7A00]">ID Document Image Selected</p>
                        </div>
                      ) : (
                        <div className="text-center flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] text-gray-400">upload_file</span>
                          <p className="text-[10px] font-bold text-gray-700">Optionally Upload Document Slip Scan Photo</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button
                    type="submit"
                    className="w-full bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 text-white py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_4px_15px_rgba(252,122,0,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                  >
                    Submit KYC Details
                  </button>
                </form>
              )}

              {/* Progress States */}
              {(submitStep === "uploading" || submitStep === "submitting") && (
                <div className="flex flex-col items-center space-y-6 pt-10">
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
                <div className="flex flex-col items-center space-y-5 w-full pt-10">
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
                <div className="flex flex-col items-center space-y-5 w-full pt-10">
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

          {/* Full Screen Biometric Camera Overlay */}
          {isCameraActive && (
            <div className="fixed inset-0 max-w-md mx-auto bg-black z-[100000] flex flex-col justify-between items-center overflow-hidden animate-fade-in select-none">
              {/* Camera Feed */}
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="absolute inset-0 w-full h-full object-cover scale-x-[-1]"
              />

              {/* Biometric Oval Cutout Mask */}
              <div className="absolute inset-0 flex flex-col justify-center items-center pointer-events-none">
                <div className="w-full h-full bg-black/60 flex flex-col justify-between items-center p-6 relative">
                  {/* Top Header inside camera */}
                  <div className="w-full text-center pt-10">
                    <p className="font-hanken font-bold text-xs text-white uppercase tracking-widest bg-black/40 px-4 py-1.5 rounded-full inline-block">
                      Liveness Face Match
                    </p>
                  </div>

                  {/* Centered biometric oval border cutout indicator */}
                  <div className="relative w-64 h-80 rounded-[120px] border-4 border-dashed border-[#00C060] shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] flex flex-col items-center justify-center">
                    {/* Scanning laser line */}
                    <div className="absolute left-0 right-0 h-1 bg-[#00C060]/70 rounded-full animate-bounce" style={{ top: "35%", animationDuration: "3s" }} />
                  </div>

                  {/* Bottom Guide Text */}
                  <div className="w-full text-center pb-28">
                    <p className="font-hanken font-extrabold text-sm text-white drop-shadow-md">
                      Align face within oval & smile
                    </p>
                    <p className="font-hanken text-[10px] text-gray-300 font-bold uppercase tracking-wider mt-1.5 drop-shadow-sm">
                      Official Biometrics Verification Service
                    </p>
                  </div>
                </div>
              </div>

              {/* Camera Actions top bar */}
              <div className="w-full flex justify-between items-center p-6 flex-shrink-0 z-[100001] bg-gradient-to-b from-black/80 to-transparent">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-10 h-10 rounded-full bg-black/40 border border-white/20 text-white flex items-center justify-center hover:bg-black/60 active:scale-95 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px] font-black">close</span>
                </button>
                <span className="text-white text-xs font-black uppercase tracking-wider">Verification Camera</span>
                <div className="w-10" />
              </div>

              {/* Shutter Button bottom bar */}
              <div className="w-full flex flex-col items-center p-8 z-[100001] bg-gradient-to-t from-black/85 via-black/40 to-transparent flex-shrink-0">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="w-20 h-20 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 flex items-center justify-center p-1 active:scale-95 transition-all cursor-pointer shadow-2xl"
                >
                  <div className="w-full h-full bg-white rounded-full flex items-center justify-center shadow-inner">
                    <span className="material-symbols-outlined text-black text-[32px] font-black">photo_camera</span>
                  </div>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
