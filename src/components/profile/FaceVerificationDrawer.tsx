"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import Image from "next/image";
import { toast } from "sonner";

interface FaceVerificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  idNumber: string;
  kycType: "bvn" | "nin";
  onSuccess: (accountData: any) => void;
}

const LIVENESS_CHALLENGES = [
  "Blink",
  "Smile",
  "Turn head left",
  "Turn head right",
  "Look up",
  "Look down"
];

export function FaceVerificationDrawer({
  isOpen,
  onClose,
  idNumber,
  kycType,
  onSuccess
}: FaceVerificationDrawerProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [challenge, setLivenessChallenge] = useState("");
  const [livenessStep, setLivenessStep] = useState<"instructions" | "camera" | "verifying" | "success" | "failed">("instructions");
  const [feedback, setFeedback] = useState("Align your face inside the frame");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [verifyingText, setVerifyingText] = useState("Analyzing facial vectors...");

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Expose randomize challenge
  useEffect(() => {
    if (isOpen) {
      const randomChallenge = LIVENESS_CHALLENGES[Math.floor(Math.random() * LIVENESS_CHALLENGES.length)];
      setLivenessChallenge(randomChallenge);
      setLivenessStep("instructions");
      setFeedback("Align your face inside the frame");
    }
  }, [isOpen]);

  // Handle body scroll locking
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Clean up camera stream on close/unmount
  const stopCamera = React.useCallback(() => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  }, [stream]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const startCamera = async () => {
    try {
      setLivenessStep("camera");
      setFeedback("Position your face in the center");
      const userStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false
      });
      setStream(userStream);
      if (videoRef.current) {
        videoRef.current.srcObject = userStream;
      }

      // Start automatic simulated liveness check progress
      setCountdown(3);
    } catch (err) {
      console.error("[Face Verification] Camera stream capture failed:", err);
      toast.error("Camera access denied or unavailable. Please enable permissions.");
      setLivenessStep("failed");
    }
  };

  // Simulated countdown for liveness challenge and automatic snapshot
  useEffect(() => {
    if (countdown === null) return;
    if (countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
        if (countdown === 3) {
          setFeedback(`Ready? Get ready to: ${challenge.toUpperCase()}`);
        } else if (countdown === 2) {
          setFeedback(`Perform action now: ${challenge.toUpperCase()}!`);
        } else if (countdown === 1) {
          setFeedback("Perfect, holding still...");
        }
      }, 1200);
      return () => clearTimeout(timer);
    } else {
      // Countdown reached 0: Capture selfie base64 image frame!
      setCountdown(null);
      captureAndVerify();
    }
  }, [countdown, challenge]);

  const captureAndVerify = async () => {
    setLivenessStep("verifying");
    setVerifyingText("Capturing and validating image quality...");

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas) {
        throw new Error("Camera capture stream was lost.");
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        throw new Error("Canvas context init failed.");
      }

      // Draw the current video frame into canvas
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 480;
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Convert captured frame to Base64 JPEG string
      const capturedSelfie = canvas.toDataURL("image/jpeg", 0.9);

      // Turn off camera as we are starting server verification
      stopCamera();

      setVerifyingText("Performing biometric face match and identity check...");
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Invoke server-side /api/profile/verify-kyc
      const idToken = await (window as any).firebaseUserToken || ""; // fallback hook
      const res = await fetch("/api/profile/verify-kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          idNumber,
          type: kycType,
          capturedSelfie,
          livenessChallenge: challenge
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Identity verification failed.");
      }

      setLivenessStep("success");
      toast.success("Identity and Face verified successfully!");
      onSuccess(data.account);
    } catch (err: any) {
      console.error("[Face Verification Error]:", err);
      toast.error(err.message || "Identity verification failed. Please try again.");
      setLivenessStep("failed");
      stopCamera();
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      stopCamera();
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
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
          />

          {/* Bottom Sheet Camera Drawer */}
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
            className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] p-6 pb-8 z-[99999] flex flex-col items-center shadow-none text-black"
          >
            {/* Grab handle */}
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-2 mb-4" />

            {/* Header */}
            <div className="w-full flex justify-between items-center border-b border-gray-100 pb-4 mb-4">
              <div className="w-8" />
              <h3 className="font-hanken font-bold text-base text-black text-center">Live Face Verification</h3>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  onClose();
                }}
                className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-all"
              >
                <span className="material-symbols-outlined text-[16px] font-bold">close</span>
              </button>
            </div>

            {/* Hidden canvas for capturing frame snapshots */}
            <canvas ref={canvasRef} className="hidden" />

            {/* Body rendering states */}
            <div className="flex-grow flex flex-col justify-center items-center w-full px-4 overflow-y-auto text-center space-y-5">
              {livenessStep === "instructions" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-200 flex items-center justify-center text-[#FC7A00] animate-pulse">
                    <span className="material-symbols-outlined text-[32px] font-bold">photo_camera</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-base text-black uppercase tracking-tight">Facial Liveness Check</h4>
                    <p className="font-hanken text-xs text-gray-500 leading-relaxed max-w-[280px]">
                      Ensure you are in a well-lit area and looking directly at your device camera before starting.
                    </p>
                  </div>

                  {/* Guides list */}
                  <div className="w-full bg-gray-50 border border-gray-150 p-4 rounded-2xl text-left space-y-3.5">
                    <div className="flex gap-3 text-xs text-gray-700 font-semibold items-center">
                      <span className="material-symbols-outlined text-emerald-600 font-bold text-[18px]">wb_sunny</span>
                      <span>Ensure bright, direct facial lighting</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-700 font-semibold items-center">
                      <span className="material-symbols-outlined text-emerald-600 font-bold text-[18px]">accessibility_new</span>
                      <span>Remove face masks, sunglasses, or hats</span>
                    </div>
                    <div className="flex gap-3 text-xs text-gray-700 font-semibold items-center">
                      <span className="material-symbols-outlined text-emerald-600 font-bold text-[18px]">center_focus_strong</span>
                      <span>Position your face entirely inside the circular guide</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startCamera}
                    className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none cursor-pointer"
                  >
                    Start Face Capture
                  </button>
                </div>
              )}

              {livenessStep === "camera" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  {/* Camera Video Circle Box */}
                  <div className="relative w-56 h-56 rounded-full border-4 border-black overflow-hidden shadow-md bg-gray-100 flex items-center justify-center">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover scale-x-[-1]" // mirror view
                    />

                    {/* Liveness circle framing guideline overlay */}
                    <div className="absolute inset-2 border-2 border-dashed border-white/40 rounded-full pointer-events-none" />

                    {/* Challenge action bubble overlay */}
                    {countdown !== null && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[#FC7A00] text-white text-[10px] font-black uppercase px-3 py-1 rounded-full shadow-sm">
                        Challenge: {challenge}
                      </div>
                    )}
                  </div>

                  {/* Feedback bar */}
                  <div className="bg-gray-50 border border-gray-150 px-4 py-2.5 rounded-xl">
                    <p className="font-hanken font-bold text-xs text-[#FC7A00]">{feedback}</p>
                  </div>
                </div>
              )}

              {livenessStep === "verifying" && (
                <div className="flex flex-col items-center space-y-6">
                  {/* Rotating Gradient Spinner */}
                  <div className="relative w-16 h-16 flex items-center justify-center">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                      className="absolute inset-0 rounded-full border-3 border-gray-100 border-t-[#FC7A00] border-r-[#0b513d]"
                    />
                    <span className="material-symbols-outlined text-[28px] text-gray-400">face</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-sm text-black uppercase tracking-wider">Verifying Identity</h4>
                    <p className="font-hanken text-xs text-gray-500 max-w-[280px] leading-relaxed">
                      {verifyingText}
                    </p>
                  </div>
                </div>
              )}

              {livenessStep === "success" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
                    <span className="material-symbols-outlined text-[36px] font-bold">verified</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-base text-black uppercase">Verification Passed</h4>
                    <p className="font-hanken text-xs text-gray-500 leading-relaxed max-w-[260px]">
                      Identity resolution and live facial liveness verification matched successfully!
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      window.location.reload();
                    }}
                    className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer"
                  >
                    Finish & View Account
                  </button>
                </div>
              )}

              {livenessStep === "failed" && (
                <div className="flex flex-col items-center space-y-5 w-full">
                  <div className="w-16 h-16 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-600">
                    <span className="material-symbols-outlined text-[36px] font-bold">gpp_maybe</span>
                  </div>

                  <div className="space-y-1">
                    <h4 className="font-hanken font-black text-base text-black uppercase">Verification Failed</h4>
                    <p className="font-hanken text-xs text-gray-500 leading-relaxed max-w-[260px]">
                      We could not verify your identity. Please ensure your camera lighting is clear and your BVN/NIN matches your profile.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setLivenessStep("instructions")}
                    className="w-full py-4 bg-[#FC7A00] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl cursor-pointer"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
