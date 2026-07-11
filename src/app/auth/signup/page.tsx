"use client";

import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { toast } from "sonner";
import Link from "next/link";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function SignUpPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Custom Permission Drawer state
  const [showPermissionDrawer, setShowPermissionDrawer] = useState(false);

  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const hasPushedState = useRef(false);

  // Stop Camera Stream
  const stopCamera = React.useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCamera(false);
    setCountdown(null);
  }, [cameraStream]);

  // Sync state with browser back history for camera drawer
  useEffect(() => {
    if (showCamera) {
      window.history.pushState({ cameraOpen: true }, "");
      hasPushedState.current = true;

      const handlePopState = (e: PopStateEvent) => {
        e.preventDefault();
        hasPushedState.current = false;
        stopCamera();
      };

      window.addEventListener("popstate", handlePopState);
      return () => {
        window.removeEventListener("popstate", handlePopState);
        if (hasPushedState.current) {
          window.history.back();
          hasPushedState.current = false;
        }
      };
    }
  }, [showCamera, stopCamera]);

  // Prevent background body scroll when camera drawer or permission drawer is open
  useEffect(() => {
    if (showCamera || showPermissionDrawer) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [showCamera, showPermissionDrawer]);

  // Handle Photo Upload from local files
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
        toast.success("Profile photo uploaded!");
      };
      reader.readAsDataURL(file);
    }
  };

  // Start Camera Stream with robust constraints and device configuration
  const startCamera = async (mode: "user" | "environment" = facingMode) => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: mode,
          width: { min: 240, ideal: 640, max: 1080 },
          height: { min: 240, ideal: 640, max: 1080 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((playErr) => {
          console.error("Video element play failed:", playErr);
        });
      }
      setShowCamera(true);
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      toast.error("Could not access your camera lens. Please allow permission or upload an image instead.");
    }
  };

  // Switch camera facing direction dynamically (Front / Back)
  const toggleCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
    toast.success(nextMode === "user" ? "Switched to Front Camera" : "Switched to Back Camera");
  };

  // Drag down to dismiss gesture for selfie drawer
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      stopCamera();
    }
  };

  // Capture Selfie with elegant countdown and flash
  const triggerCapture = () => {
    setCountdown(3);
    const counter = setInterval(() => {
      setCountdown((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(counter);
          captureSelfie();
          return null;
        }
        return prev - 1;
      });
    }, 800);
  };

  const captureSelfie = () => {
    if (videoRef.current) {
      setFlash(true);
      setTimeout(() => setFlash(false), 300);

      const canvas = document.createElement("canvas");
      canvas.width = videoRef.current.videoWidth || 640;
      canvas.height = videoRef.current.videoHeight || 640;
      const ctx = canvas.getContext("2d");

      if (ctx) {
        if (facingMode === "user") {
          ctx.translate(canvas.width, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL("image/jpeg");
        setPhoto(dataUrl);
        toast.success("Selfie captured successfully!");
        stopCamera();
      }
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!photo) {
      toast.error("Please upload a profile picture or take a selfie to proceed.");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await updateProfile(user, { displayName: name, photoURL: photo });

      await setDoc(doc(db, "users", user.uid), {
        name,
        email,
        uid: user.uid,
        photoURL: photo,
        createdAt: new Date().toISOString(),
        balance: 10000.00,
        pin: null,
      });

      toast.success("Account created successfully!");
      router.push("/auth/pin-setup");
    } catch (error: unknown) {
      console.error("Signup Error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create account";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-white p-6 justify-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md mx-auto"
      >
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative w-16 h-16 mb-3">
            <Image
              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
              alt="E-Tech Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="font-hanken font-bold text-2xl tracking-tight text-black">E-TECH GLOBAL HUB</h1>
          <p className="text-gray-500 font-hanken mt-1">Create your secure hub account</p>
        </div>

        {/* Profile Picture Upload & Selfie Selection Section */}
        <div className="mb-6 flex flex-col items-center">
          <label className="text-xs font-bold uppercase tracking-widest text-black mb-3">
            Profile Picture <span className="text-red-500">*</span>
          </label>

          <div className="relative w-28 h-28 rounded-full overflow-hidden border-2 border-dashed border-[#d4af37] flex items-center justify-center bg-gray-50 group shadow-md">
            {photo ? (
              <Image
                src={photo}
                alt="Profile Preview"
                fill
                className="object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-[48px] text-gray-300">
                account_circle
              </span>
            )}

            {photo && (
              <button
                type="button"
                onClick={() => setPhoto(null)}
                className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-xs font-bold gap-1"
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Clear
              </button>
            )}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              onChange={handlePhotoUpload}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-black text-xs font-bold rounded-lg flex items-center gap-1 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">upload_file</span>
              Upload Image
            </button>
            <button
              type="button"
              onClick={() => setShowPermissionDrawer(true)}
              className="px-3 py-1.5 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] hover:brightness-105 active:scale-95 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-sm transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">photo_camera</span>
              Take Selfie
            </button>
          </div>
        </div>

        <form onSubmit={handleSignUp} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Full Name</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-gray-50 border-b border-gray-200 py-3 px-1 outline-none focus:border-black transition-colors text-black"
              placeholder="Captain John Doe"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Email Address</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-50 border-b border-gray-200 py-3 px-1 outline-none focus:border-black transition-colors text-black"
              placeholder="captain@example.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold uppercase tracking-widest text-black">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-gray-50 border-b border-gray-200 py-3 pl-1 pr-10 outline-none focus:border-black transition-colors text-black"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer transition-colors p-1"
              >
                <span className="material-symbols-outlined text-[20px]">
                  {showPassword ? "visibility" : "visibility_off"}
                </span>
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white py-4 rounded-xl font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 shadow-md cursor-pointer"
          >
            {loading ? "Creating..." : "Create Account"}
          </button>
        </form>

        {/* Elegant Custom Camera Permission Bottom Drawer Modal */}
        <AnimatePresence>
          {showPermissionDrawer && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowPermissionDrawer(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* Bottom Sheet Drawer */}
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 28, stiffness: 260 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] p-6 pb-8 z-[99999] flex flex-col items-center shadow-none"
              >
                {/* Grab Handle */}
                <div className="w-10 h-1 bg-gray-300 rounded-full mb-5" />

                {/* Header */}
                <div className="w-full flex justify-between items-center border-b border-gray-100 pb-3 mb-5">
                  <div className="w-8" />
                  <h3 className="font-hanken font-bold text-base text-black text-center">Camera Access Needed</h3>
                  <button
                    type="button"
                    onClick={() => setShowPermissionDrawer(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer transition-all"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="w-14 h-14 rounded-full bg-[#d4af37]/10 flex items-center justify-center text-[#d4af37] mb-4">
                  <span className="material-symbols-outlined text-[28px] font-bold">photo_camera</span>
                </div>

                <p className="font-hanken text-sm text-gray-500 text-center max-w-[280px] mb-8 leading-relaxed">
                  E-Tech secure identity setup requires camera access to capture your selfie. This verifies your KYC status and safeguards your wallet transactions.
                </p>

                <div className="flex flex-col gap-3 w-full">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPermissionDrawer(false);
                      startCamera(facingMode);
                    }}
                    className="w-full py-4 bg-black hover:bg-gray-900 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                  >
                    Allow Camera Access
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowPermissionDrawer(false)}
                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Elegant 90% Height Bottom Drawer for Active Selfie Capture */}
        <AnimatePresence>
          {showCamera && (
            <>
              {/* Overlay Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={stopCamera}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              {/* 90% Height Slide Up Drawer */}
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
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] h-[90dvh] z-[99999] flex flex-col items-center select-none cursor-default shadow-none touch-none"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-4 mb-4 cursor-grab active:cursor-grabbing" />

                {/* Header block */}
                <div className="w-full px-6 flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                  {/* Switch camera button */}
                  <button
                    type="button"
                    onClick={toggleCamera}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                    title="Switch Camera (Front/Back)"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">flip_camera_ios</span>
                  </button>
                  <h3 className="font-hanken font-bold text-base text-black text-center">
                    Selfie Verification
                  </h3>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                {/* Centered Video Stream container with guide overlay */}
                <div className="flex-grow flex flex-col justify-center items-center w-full px-6">
                  <div className="relative w-full aspect-square max-w-[320px] rounded-[32px] overflow-hidden bg-black flex items-center justify-center border-2 border-[#d4af37]">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      className={cn(
                        "w-full h-full object-cover",
                        facingMode === "user" ? "scale-x-[-1]" : "scale-x-[1]"
                      )}
                    />

                    {/* Oval Portrait Face Guide Overlay */}
                    <div className="absolute inset-0 border-[32px] border-black/40 pointer-events-none flex items-center justify-center">
                      <div className="w-48 h-56 rounded-[100px] border-2 border-dashed border-white/60 flex items-center justify-center">
                        <span className="text-[10px] text-white/50 uppercase tracking-widest font-bold font-hanken">Align Face</span>
                      </div>
                    </div>

                    {/* Countdown indicator */}
                    {countdown !== null && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <motion.span
                          key={countdown}
                          initial={{ scale: 0.5, opacity: 0 }}
                          animate={{ scale: 1.5, opacity: 1 }}
                          exit={{ scale: 2, opacity: 0 }}
                          transition={{ duration: 0.4 }}
                          className="text-white text-6xl font-bold font-hanken"
                        >
                          {countdown}
                        </motion.span>
                      </div>
                    )}

                    {/* Camera Flash effect overlay */}
                    {flash && (
                      <div className="absolute inset-0 bg-white z-10 animate-pulse" />
                    )}
                  </div>

                  <p className="font-hanken text-xs text-gray-400 text-center mt-6 max-w-[260px] leading-relaxed">
                    Make sure your face is clearly visible inside the alignment frame. Use the top-left button to toggle between front and back camera lenses.
                  </p>
                </div>

                {/* Bottom Action buttons bar */}
                <div className="w-full p-6 border-t border-gray-100 flex flex-col gap-3">
                  <button
                    type="button"
                    onClick={triggerCapture}
                    disabled={countdown !== null}
                    className="w-full py-4 bg-gradient-to-r from-[#d4af37] to-[#f2ca50] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all disabled:opacity-50 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                    {countdown !== null ? "Get Ready..." : "Capture Selfie"}
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="w-full py-4 bg-gray-100 hover:bg-gray-200 active:scale-95 text-black text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <p className="mt-8 text-center text-sm text-gray-500">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-black font-bold underline">
            Login
          </Link>
        </p>
      </motion.div>
    </div>
  );
}
