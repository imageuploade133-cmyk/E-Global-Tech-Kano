"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence, PanInfo } from "framer-motion";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { cn } from "@/lib/utils";
import { LogoutDrawer } from "@/components/layout/LogoutDrawer";
import { useRouter } from "next/navigation";

// The 4 distinct categories for daily transfer limit
const LIMIT_CATEGORIES = [
  {
    id: "standard",
    label: "Standard",
    limit: 500000,
    description: "Standard daily limit",
    icon: "account_balance_wallet",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-[#FC7A00] bg-[#FC7A00]/5 text-black ring-1 ring-[#FC7A00]"
  },
  {
    id: "silver",
    label: "Silver Elite",
    limit: 2000000,
    description: "Higher transfer capacity",
    icon: "shield",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-[#0b513d] bg-[#0b513d]/5 text-black ring-1 ring-[#0b513d]"
  },
  {
    id: "gold",
    label: "Gold VIP",
    limit: 5000000,
    description: "Premium elite limit",
    icon: "workspace_premium",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-amber-500 bg-amber-500/5 text-black ring-1 ring-amber-500"
  },
  {
    id: "diamond",
    label: "Infinite Diamond",
    limit: 10000000,
    description: "Ultimate max capacity",
    icon: "diamond",
    color: "border-gray-200 text-gray-800",
    activeColor: "border-emerald-500 bg-emerald-500/5 text-black ring-1 ring-emerald-500"
  }
];

export default function ProfilePage() {
  const { userData, user, updateUserData } = useAuth();
  const router = useRouter();

  // Basic User Information
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const userEmail = (userData?.email || user?.email || "captain@example.com") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Modal / Drawer States
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);
  const [showPermissionDrawer, setShowPermissionDrawer] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Camera & Image Variables
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [countdown, setCountdown] = useState<number | null>(null);
  const [flash, setFlash] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Security Toggles State
  const isPinRequired = userData?.isPinRequired !== false;
  const isFaceIdEnabled = userData?.isFaceIdEnabled === true;
  const dailyLimit = userData?.dailyLimit ?? 500000;

  // Change Password Form State
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // Change PIN Form State
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  // Camera cleanup
  const stopCamera = React.useCallback(() => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
      setCameraStream(null);
    }
    setShowCameraDrawer(false);
    setCountdown(null);
  }, [cameraStream]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [cameraStream]);

  // Handle local image file upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Image size should be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = reader.result as string;
        try {
          await updateUserData({ photoURL: base64 });
          toast.success("Profile photo updated successfully!");
        } catch {
          toast.error("Failed to update profile photo");
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Start Camera
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
      setShowCameraDrawer(true);
    } catch (err) {
      console.error("Camera access denied or unavailable:", err);
      toast.error("Could not access your camera. Please allow permission or upload an image instead.");
    }
  };

  const toggleCamera = () => {
    const nextMode = facingMode === "user" ? "environment" : "user";
    setFacingMode(nextMode);
    startCamera(nextMode);
    toast.success(nextMode === "user" ? "Switched to Front Camera" : "Switched to Back Camera");
  };

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

  const captureSelfie = async () => {
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
        try {
          await updateUserData({ photoURL: dataUrl });
          toast.success("Selfie updated successfully!");
          stopCamera();
        } catch {
          toast.error("Failed to save selfie");
        }
      }
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      stopCamera();
    }
  };

  // Change Password Action with Old Password Verification
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!oldPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long.");
      return;
    }

    setIsUpdatingPassword(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      if (isMock) {
        toast.success("Password updated successfully (Mock Validation passed)!");
      } else {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email) {
          // Reauthenticate live user before changing password
          const credential = EmailAuthProvider.credential(currentUser.email, oldPassword);
          await reauthenticateWithCredential(currentUser, credential);
          await updatePassword(currentUser, newPassword);
          toast.success("Password updated successfully!");
        } else {
          toast.error("No active session found");
        }
      }
      setOldPassword("");
      setNewPassword("");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Incorrect old password or authentication error.");
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  // Change PIN Action with Old PIN Verification
  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin.length !== 4 || isNaN(Number(oldPin))) {
      toast.error("Please enter a valid 4-digit old PIN.");
      return;
    }
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      toast.error("New PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match.");
      return;
    }

    // Verify Old PIN matches current user PIN
    const currentStoredPin = userData?.pin || "1234"; // Default mock PIN is '1234'
    if (oldPin !== currentStoredPin) {
      toast.error("Incorrect current PIN. Access denied.");
      return;
    }

    setIsUpdatingPin(true);
    try {
      await updateUserData({ pin: newPin });
      toast.success("Access PIN updated successfully!");
      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    } catch {
      toast.error("Failed to update Access PIN");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  // Toggle PIN on/off
  const handleTogglePinRequired = async () => {
    try {
      const targetState = !isPinRequired;
      await updateUserData({ isPinRequired: targetState });
      toast.success(targetState ? "PIN Authentication Enabled" : "PIN Authentication Disabled");
    } catch {
      toast.error("Failed to update PIN state");
    }
  };

  // Toggle FaceID on/off
  const handleToggleFaceId = async () => {
    try {
      const targetState = !isFaceIdEnabled;
      await updateUserData({ isFaceIdEnabled: targetState });
      toast.success(targetState ? "Biometric FaceID Transfer Enabled" : "Biometric FaceID Transfer Disabled");
    } catch {
      toast.error("Failed to update FaceID state");
    }
  };

  // Category selection handler for Daily Transfer Limit
  const handleSelectLimitCategory = async (limit: number) => {
    try {
      await updateUserData({ dailyLimit: limit });
      toast.success(`Daily limit set to ₦${new Intl.NumberFormat("en-NG").format(limit)}`);
    } catch {
      toast.error("Failed to update transfer limit");
    }
  };

  const handleLogoutConfirm = async () => {
    setIsLogoutOpen(false);
    try {
      await auth.signOut();
      toast.success("Logged out successfully");
      router.push("/auth/login");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <>
      <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md mx-auto space-y-6"
        >
          {/* Section: Profile Header & Photo Editor */}
          <section className="premium-gradient-card premium-gradient-border p-6 flex flex-col items-center text-center">
            <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#FC7A00] flex items-center justify-center bg-gray-50 shadow-lg">
              <Image
                src={currentPhoto}
                alt="Profile Avatar"
                fill
                className="object-cover"
              />
            </div>

            <div className="mt-4 flex gap-2.5">
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
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-black text-[10px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">upload_file</span>
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setShowPermissionDrawer(true)}
                className="px-3.5 py-1.5 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] text-white text-[10px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                Take Selfie
              </button>
            </div>

            <div className="mt-5">
              <h2 className="font-hanken font-bold text-xl text-black tracking-tight">{userName}</h2>
              <p className="font-hanken text-xs text-gray-400 font-semibold">{userEmail}</p>
            </div>
          </section>

          {/* Section: Security Preferences & Toggles */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
            <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
              Security Settings
            </h3>

            {/* Toggle PIN */}
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="font-hanken font-bold text-xs text-black">Require PIN Access</p>
                <p className="font-hanken text-[10px] text-gray-400">Enforce PIN check on login/payment flows</p>
              </div>
              <button
                onClick={handleTogglePinRequired}
                className={cn(
                  "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
                  isPinRequired ? "bg-[#07B038]" : "bg-gray-200"
                )}
              >
                <motion.div
                  layout
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: isPinRequired ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>

            {/* Toggle FaceID */}
            <div className="flex justify-between items-center py-2">
              <div>
                <p className="font-hanken font-bold text-xs text-black">Simulate FaceID Biometrics</p>
                <p className="font-hanken text-[10px] text-gray-400">Quick authentication via FaceID simulations</p>
              </div>
              <button
                onClick={handleToggleFaceId}
                className={cn(
                  "w-12 h-6 rounded-full p-0.5 transition-colors duration-300 focus:outline-none relative cursor-pointer",
                  isFaceIdEnabled ? "bg-[#07B038]" : "bg-gray-200"
                )}
              >
                <motion.div
                  layout
                  className="w-5 h-5 bg-white rounded-full shadow-md"
                  animate={{ x: isFaceIdEnabled ? 24 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                />
              </button>
            </div>
          </section>

          {/* Section: Daily Transfer Limit - 4 Grid Categories */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
            <div className="border-b border-gray-100/60 pb-2.5">
              <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500">
                Daily Transfer Limit Categories
              </h3>
              <p className="font-hanken text-[10px] text-gray-400 mt-0.5">Select a category to change your daily limit</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {LIMIT_CATEGORIES.map((cat) => {
                const isSelected = dailyLimit === cat.limit;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectLimitCategory(cat.limit)}
                    className={cn(
                      "p-3 rounded-xl border text-left flex flex-col justify-between h-24 transition-all duration-300 cursor-pointer",
                      isSelected ? cat.activeColor : cat.color + " hover:bg-gray-50 bg-white"
                    )}
                  >
                    <div className="flex justify-between items-start w-full">
                      <span className={cn(
                        "material-symbols-outlined text-[20px]",
                        isSelected ? "text-inherit" : "text-gray-400"
                      )} style={isSelected && cat.id === "diamond" ? { fontVariationSettings: '"FILL" 1' } : {}}>
                        {cat.icon}
                      </span>
                      {isSelected && (
                        <span className="material-symbols-outlined text-[16px] text-emerald-500 font-bold">check_circle</span>
                      )}
                    </div>
                    <div>
                      <p className="font-hanken font-bold text-xs text-black">{cat.label}</p>
                      <p className="font-hanken font-black text-sm text-black mt-0.5">
                        ₦{new Intl.NumberFormat("en-NG", { maximumFractionDigits: 0 }).format(cat.limit / 1000)}K
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Section: Change Access PIN Form */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
            <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
              Change Access PIN
            </h3>

            <form onSubmit={handleUpdatePin} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">Current 4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-center tracking-[0.5em] text-sm font-bold"
                    placeholder="••••"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black">New 4-Digit PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-center tracking-[0.5em] text-sm font-bold"
                      placeholder="••••"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black">Confirm PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-center tracking-[0.5em] text-sm font-bold"
                      placeholder="••••"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPin}
                className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingPin ? "Updating..." : "Update PIN"}
              </button>
            </form>
          </section>

          {/* Section: Change Password Form */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
            <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
              Change Account Password
            </h3>

            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">Current Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-gray-50 border-b border-gray-200 py-2 px-1 outline-none focus:border-black transition-colors text-black text-sm"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-gray-50 border-b border-gray-200 py-2 pl-1 pr-10 outline-none focus:border-black transition-colors text-black text-sm"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black cursor-pointer transition-colors p-1"
                    >
                      <span className="material-symbols-outlined text-[18px]">
                        {showPassword ? "visibility" : "visibility_off"}
                      </span>
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isUpdatingPassword}
                className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </button>
            </form>
          </section>

          {/* Section: Destructive Actions (Logout) */}
          <section className="pt-2">
            <button
              onClick={() => setIsLogoutOpen(true)}
              className="w-full py-4 bg-[#dc3545]/10 hover:bg-[#dc3545]/15 border border-[#dc3545]/20 text-[#dc3545] rounded-2xl flex items-center justify-center gap-2 font-bold uppercase tracking-widest text-xs active:scale-95 transition-all cursor-pointer"
            >
              <span className="material-symbols-outlined text-[20px]">logout</span>
              Sign Out from Device
            </button>
          </section>
        </motion.div>
      </main>

      {/* Camera Permission Sheet Modal */}
      <AnimatePresence>
        {showPermissionDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowPermissionDrawer(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
            />

            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] p-6 pb-8 z-[99999] flex flex-col items-center shadow-none"
            >
              <div className="w-10 h-1 bg-gray-300 rounded-full mb-5" />

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

              <div className="w-14 h-14 rounded-full bg-[#FC7A00]/10 flex items-center justify-center text-[#FC7A00] mb-4">
                <span className="material-symbols-outlined text-[28px] font-bold">photo_camera</span>
              </div>

              <p className="font-hanken text-sm text-gray-500 text-center max-w-[280px] mb-8 leading-relaxed">
                Take a quick selfie to immediately update your wallet avatar and keep your KYC up-to-date.
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

      {/* Selfie Capture Sheet Modal */}
      <AnimatePresence>
        {showCameraDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={stopCamera}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
            />

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
              <div className="w-12 h-1.5 bg-gray-200 rounded-full mt-4 mb-4 cursor-grab" />

              <div className="w-full px-6 flex justify-between items-center border-b border-gray-100 pb-4 mb-6">
                <button
                  type="button"
                  onClick={toggleCamera}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                  title="Switch Camera (Front/Back)"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">flip_camera_ios</span>
                </button>
                <h3 className="font-hanken font-bold text-base text-black text-center">
                  Take New Profile Photo
                </h3>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-grow flex flex-col justify-center items-center w-full px-6">
                <div className="relative w-full aspect-square max-w-[280px] rounded-[32px] overflow-hidden bg-black flex items-center justify-center border-2 border-[#FC7A00]">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className={cn(
                      "w-full h-full object-cover",
                      facingMode === "user" ? "scale-x-[-1]" : "scale-x-[1]"
                    )}
                  />

                  <div className="absolute inset-0 border-[24px] border-black/40 pointer-events-none flex items-center justify-center">
                    <div className="w-40 h-48 rounded-[100px] border-2 border-dashed border-white/60 flex items-center justify-center" />
                  </div>

                  {countdown !== null && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <motion.span
                        key={countdown}
                        initial={{ scale: 0.5, opacity: 0 }}
                        animate={{ scale: 1.5, opacity: 1 }}
                        exit={{ scale: 2, opacity: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-white text-5xl font-bold font-hanken"
                      >
                        {countdown}
                      </motion.span>
                    </div>
                  )}

                  {flash && (
                    <div className="absolute inset-0 bg-white z-10 animate-pulse" />
                  )}
                </div>
              </div>

              <div className="w-full p-6 border-t border-gray-100 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={triggerCapture}
                  disabled={countdown !== null}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  {countdown !== null ? "Get Ready..." : "Capture Photo"}
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

      <LogoutDrawer
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />

      <BottomNav />
    </>
  );
}
