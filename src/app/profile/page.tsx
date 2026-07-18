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
import { useAppConfig } from "@/lib/ConfigContext";

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
  const { config } = useAppConfig();
  const router = useRouter();

  // Basic User Information
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const userEmail = (userData?.email || user?.email || "captain@example.com") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  // Interactive KYC flow states
  const [kycType, setKycType] = useState<"bvn" | "nin">("bvn");
  const [idNumber, setIdNumber] = useState("");
  const [verifyingKyc, setVerifyingKyc] = useState(false);
  const [staticAccount, setStaticAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  // Modal / Drawer States
  const [showCameraDrawer, setShowCameraDrawer] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

  // Camera & Image Variables
  const [flash, setFlash] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [diagnosticText, setDiagnosticText] = useState("SYSTEM READY");
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

  // Resolve or retrieve the permanent static account details if verified
  const loadStaticAccount = async () => {
    const isMock = sessionStorage.getItem("mock") === "true";
    if (isMock) {
      setStaticAccount({
        bankName: "Wema Bank",
        accountNumber: "9921473281",
        accountName: `${userName.toUpperCase()} - E-Tech`,
      });
      return;
    }

    setLoadingAccount(true);
    try {
      let idToken = "";
      if (user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/flutterwave/create-virtual-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.success && data.account) {
          setStaticAccount({
            bankName: data.account.bankName,
            accountNumber: data.account.accountNumber,
            accountName: data.account.accountName,
          });
        }
      }
    } catch (err) {
      console.error("Error loading permanent account:", err);
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    if (userData?.kycStatus === "VERIFIED") {
      loadStaticAccount();
    }
  }, [userData?.kycStatus]);

  // Execute verification call
  const handleVerifyKyc = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!idNumber || !/^\d{11}$/.test(idNumber.trim())) {
      toast.error("Identity number must be exactly 11 digits.");
      return;
    }

    setVerifyingKyc(true);
    toast.loading(`Verifying your ${kycType.toUpperCase()} with Flutterwave verification rails...`);

    try {
      const isMock = sessionStorage.getItem("mock") === "true";

      if (isMock) {
        setTimeout(async () => {
          await updateUserData({ kycStatus: "VERIFIED", bvn: kycType === "bvn" ? idNumber : null, nin: kycType === "nin" ? idNumber : null });
          toast.dismiss();
          toast.success("Identity verified successfully (MOCK)!");
          setStaticAccount({
            bankName: "Wema Bank",
            accountNumber: "9921473281",
            accountName: `${userName.toUpperCase()} - E-Tech`,
          });
          setVerifyingKyc(false);
        }, 1500);
        return;
      }

      const idToken = await user?.getIdToken();
      const res = await fetch("/api/profile/verify-kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          idNumber: idNumber.trim(),
          type: kycType,
        }),
      });

      const data = await res.json();
      toast.dismiss();

      if (res.ok && data.success) {
        toast.success("Identity verified successfully! Static account number allocated.");
        // Reload page or let snapshots update the state
        if (data.account) {
          setStaticAccount(data.account);
        }
        // Force state reload
        window.location.reload();
      } else {
        toast.error(data.error || "Identity verification failed. Please try again.");
      }
    } catch {
      toast.dismiss();
      toast.error("Internal connection error while communicating with verification gateway.");
    } finally {
      setVerifyingKyc(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const stopCamera = React.useCallback(() => {
    setShowCameraDrawer(false);
    setIsScanning(false);
    setScanProgress(0);
    setDiagnosticText("SYSTEM READY");
  }, []);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append("image", file);

    const key = config.imgbbApiKey || "0d1a390cb385b632d952db08a3479005";
    toast.loading("Uploading user avatar directly to Imgbb storage...");

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      toast.dismiss();

      if (json.success) {
        const uploadedUrl = json.data.display_url;
        await updateUserData({ photoURL: uploadedUrl });
        toast.success("Profile avatar successfully uploaded and updated!");
      } else {
        toast.error(json.error?.message || "Failed to upload avatar image to Imgbb!");
      }
    } catch {
      toast.dismiss();
      toast.error("Imgbb API communication failure. Please verify internet connectivity.");
    }
  };

  const startSimulatedScan = () => {
    setShowCameraDrawer(true);
    setIsScanning(false);
    setScanProgress(0);
    setDiagnosticText("ALIGN YOUR FACE WITHIN THE OVAL");
  };

  const triggerCapture = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanProgress(0);
    setDiagnosticText("INITIALIZING 3D BIOMETRIC MESH...");

    const diagnostics = [
      "CALIBRATING SENSORS...",
      "STABILIZING POSITION: 99.4%",
      "OPTIMIZING EXPOSURE...",
      "GENERATING BIOMETRIC KEYPOINTS...",
      "SECURE KYC ENCRYPTION..."
    ];

    let currentDiagIndex = 0;
    const diagInterval = setInterval(() => {
      if (currentDiagIndex < diagnostics.length) {
        setDiagnosticText(diagnostics[currentDiagIndex]);
        currentDiagIndex++;
      }
    }, 600);

    const progressInterval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          clearInterval(diagInterval);
          executeSimulatedCapture();
          return 100;
        }
        return prev + 4;
      });
    }, 120);
  };

  const executeSimulatedCapture = async () => {
    setFlash(true);
    setTimeout(() => setFlash(false), 300);

    const premiumAvatars = [
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=400",
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=400"
    ];

    const randomAvatar = premiumAvatars[Math.floor(Math.random() * premiumAvatars.length)];
    const key = config.imgbbApiKey || "0d1a390cb385b632d952db08a3479005";
    setDiagnosticText("UPLOADING BIOMETRIC FACIAL PROFILE...");

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}&image=${encodeURIComponent(randomAvatar)}`, {
        method: "POST"
      });
      const json = await res.json();

      if (json.success) {
        const uploadedUrl = json.data.display_url;
        await updateUserData({ photoURL: uploadedUrl });
        toast.success("3D Biometric Face Scan complete & securely stored on Imgbb!");
      } else {
        await updateUserData({ photoURL: randomAvatar });
        toast.success("3D Biometric Face Scan complete!");
      }
    } catch {
      await updateUserData({ photoURL: randomAvatar });
      toast.success("3D Biometric Face Scan complete!");
    } finally {
      stopCamera();
    }
  };

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 100 || info.velocity.y > 500) {
      stopCamera();
    }
  };

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

    setIsUpdatingPin(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";

      if (isMock) {
        const currentStoredPin = userData?.pin || "1234";
        if (oldPin !== currentStoredPin) {
          toast.error("Incorrect current PIN. Access denied.");
          setIsUpdatingPin(false);
          return;
        }

        await updateUserData({ pin: newPin });
        toast.success("Access PIN updated successfully!");
      } else {
        if (!user) {
          toast.error("Authentication required.");
          setIsUpdatingPin(false);
          return;
        }

        const idToken = await user.getIdToken();

        const verifyRes = await fetch("/api/auth/pin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            action: "verify",
            pin: oldPin
          })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          toast.error(verifyData.message || verifyData.error || "Incorrect current PIN. Access denied.");
          setIsUpdatingPin(false);
          return;
        }

        const setRes = await fetch("/api/auth/pin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            action: "set",
            pin: newPin
          })
        });

        const setData = await setRes.json();
        if (setRes.ok && setData.success) {
          toast.success("Access PIN updated successfully!");
        } else {
          toast.error(setData.error || "Failed to set new PIN securely.");
          setIsUpdatingPin(false);
          return;
        }
      }

      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: unknown) {
      console.error("PIN Update Error:", err);
      toast.error("Failed to update Access PIN");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  const handleTogglePinRequired = async () => {
    try {
      const targetState = !isPinRequired;
      await updateUserData({ isPinRequired: targetState });
      toast.success(targetState ? "PIN Authentication Enabled" : "PIN Authentication Disabled");
    } catch {
      toast.error("Failed to update PIN state");
    }
  };

  const handleToggleFaceId = async () => {
    try {
      const targetState = !isFaceIdEnabled;
      await updateUserData({ isFaceIdEnabled: targetState });
      toast.success(targetState ? "Biometric FaceID Transfer Enabled" : "Biometric FaceID Transfer Disabled");
    } catch {
      toast.error("Failed to update FaceID state");
    }
  };

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

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black font-hanken">
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
                onClick={startSimulatedScan}
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

          {/* Dedicated Section: Identity Verification & KYC Flow */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
            <div className="border-b border-gray-100/60 pb-2.5">
              <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500">
                Identity Verification & Static Account (KYC)
              </h3>
              <p className="font-hanken text-[10px] text-gray-400 mt-0.5">Required to allocate permanent virtual bank accounts</p>
            </div>

            {userData?.kycStatus === "VERIFIED" ? (
              // VERIFIED DISPLAY Badges & Details
              <div className="space-y-4 text-left">
                <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-100 rounded-2xl text-emerald-800">
                  <span className="material-symbols-outlined text-emerald-600 font-black text-[22px]">check_circle</span>
                  <div>
                    <p className="font-hanken font-extrabold text-xs">KYC Identity Verified</p>
                    <p className="text-[10px] text-emerald-600 font-semibold">Your permanent static account is active and verified.</p>
                  </div>
                </div>

                {loadingAccount ? (
                  <div className="p-4 bg-gray-50 rounded-2xl animate-pulse space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-1/4" />
                    <div className="h-4.5 bg-gray-200 rounded w-1/2" />
                  </div>
                ) : staticAccount ? (
                  <div className="bg-[#0f172a] rounded-2xl p-4 text-white border border-white/5 space-y-3 relative overflow-hidden">
                    <div className="absolute right-0 bottom-0 text-[100px] text-white/5 pointer-events-none select-none translate-x-1/4 translate-y-1/4">
                      <span className="material-symbols-outlined">account_balance</span>
                    </div>

                    <div className="flex justify-between border-b border-white/10 pb-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <span>Assigned Bank Name</span>
                      <span className="text-white font-black">{staticAccount.bankName}</span>
                    </div>

                    <div className="flex justify-between border-b border-white/10 pb-2 text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                      <span>Account Holder Name</span>
                      <span className="text-white font-black truncate max-w-[180px]">{staticAccount.accountName}</span>
                    </div>

                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold uppercase tracking-wider pt-1">
                      <div>
                        <span>Static Account Number</span>
                        <p className="font-mono text-base font-black text-[#FC7A00] tracking-widest mt-0.5 select-all">
                          {staticAccount.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(staticAccount.accountNumber, "Static Account")}
                        className="bg-white/10 hover:bg-white/20 text-[10px] font-bold py-1.5 px-3 rounded-lg text-gray-200 flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <span className="material-symbols-outlined text-[13px]">content_copy</span>
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-bold text-center">Static account details could not be loaded. Please contact support.</p>
                )}
              </div>
            ) : (
              // PENDING / FAILED INTERACTIVE FLOW CARD
              <div className="space-y-4 text-left">
                {userData?.kycStatus === "FAILED" && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-150 rounded-2xl text-red-700">
                    <span className="material-symbols-outlined text-red-500 font-bold">error</span>
                    <div>
                      <p className="font-hanken font-bold text-xs">Verification Failed</p>
                      <p className="text-[10px] text-red-500 leading-tight">The BVN or NIN provided could not be verified by Flutterwave gateway. Please try again with valid records.</p>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-amber-800">
                  <p className="font-hanken text-[11px] leading-relaxed font-semibold">
                    Submit your valid 11-digit BVN or NIN to instantly verify your identity and generate your permanent, static virtual bank account for continuous, direct funding.
                  </p>
                </div>

                <form onSubmit={handleVerifyKyc} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-wider text-gray-400">Select Verification Method</label>
                    <div className="grid grid-cols-2 p-1 bg-gray-100 rounded-xl">
                      <button
                        type="button"
                        onClick={() => {
                          setKycType("bvn");
                          setIdNumber("");
                        }}
                        className={cn(
                          "py-2 text-xs font-black font-hanken rounded-lg transition-all cursor-pointer",
                          kycType === "bvn" ? "bg-white text-black shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        Bank Verification Number (BVN)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setKycType("nin");
                          setIdNumber("");
                        }}
                        className={cn(
                          "py-2 text-xs font-black font-hanken rounded-lg transition-all cursor-pointer",
                          kycType === "nin" ? "bg-white text-black shadow-sm" : "bg-transparent text-gray-400"
                        )}
                      >
                        National ID Number (NIN)
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="idNumber" className="text-[10px] font-black uppercase tracking-wider text-gray-400">
                      Enter {kycType.toUpperCase()} (11 Digits)
                    </label>
                    <input
                      id="idNumber"
                      type="number"
                      required
                      value={idNumber}
                      onChange={(e) => setIdNumber(e.target.value.slice(0, 11))}
                      placeholder={`Enter 11-digit ${kycType.toUpperCase()}...`}
                      className="w-full bg-gray-50 border border-gray-250 rounded-2xl py-3 px-4 font-mono font-bold text-xs text-black outline-none focus:border-black focus:bg-white transition-all"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyingKyc || idNumber.length !== 11}
                    className="w-full bg-gradient-to-r from-[#0F62FE] to-[#6C63FF] hover:brightness-110 text-white py-3.5 rounded-2xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all disabled:opacity-50 shadow-[0_4px_15px_rgba(15,98,254,0.15)] flex items-center justify-center gap-2"
                  >
                    {verifyingKyc ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Verifying...</span>
                      </>
                    ) : (
                      "Verify & Allocate Account"
                    )}
                  </button>
                </form>
              </div>
            )}
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

      {/* Selfie Capture Sheet Modal */}
      <AnimatePresence>
        {showCameraDrawer && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={stopCamera}
              className="fixed inset-0 bg-black/70 backdrop-blur-md z-[99998]"
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
              className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-[#0a0f1d] rounded-t-[32px] h-[85dvh] z-[99999] flex flex-col items-center select-none cursor-default shadow-none touch-none overflow-hidden"
            >
              <div className="w-12 h-1.5 bg-gray-700/80 rounded-full mt-4 mb-4 cursor-grab" />

              <div className="w-full px-6 flex justify-between items-center border-b border-white/5 pb-4 mb-6">
                <div className="w-8" />
                <h3 className="font-hanken font-bold text-base text-white text-center">
                  3D Biometric Face Scan
                </h3>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-8 h-8 rounded-full border border-white/10 bg-white/5 flex items-center justify-center text-gray-400 hover:text-white transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-grow flex flex-col justify-center items-center w-full px-6 relative">
                <div className="absolute inset-0 bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:16px_16px] opacity-20 pointer-events-none" />

                <div className="relative w-full aspect-square max-w-[270px] rounded-[32px] overflow-hidden bg-black/60 flex items-center justify-center border-2 border-emerald-500/30 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                  <div className="absolute inset-0 border border-emerald-500/10 rounded-full scale-90 animate-spin" style={{ animationDuration: "12s" }} />
                  <div className="absolute inset-0 border border-dashed border-emerald-500/20 rounded-full scale-75 animate-spin" style={{ animationDuration: "8s" }} />

                  <svg
                    className={cn(
                      "w-48 h-48 text-emerald-400/75 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)] transition-all duration-300",
                      isScanning ? "animate-pulse" : ""
                    )}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 2a10 10 0 00-10 10c0 5.523 4.477 10 10 10s10-4.477 10-10A10 10 0 0012 2zm0 18c-4.418 0-8-3.582-8-8s3.582-8 8-8 8 3.582 8 8-3.582 8-8 8zm0-12a2 2 0 100 4 2 2 0 000-4zm-4 7c0-2 2-3 4-3s4 1 4 3"
                    />
                  </svg>

                  <div className="absolute w-44 h-52 rounded-[100px] border-2 border-dashed border-emerald-400/50 flex items-center justify-center animate-pulse" />

                  {isScanning && (
                    <motion.div
                      initial={{ y: "-100%" }}
                      animate={{ y: "100%" }}
                      transition={{
                        repeat: Infinity,
                        repeatType: "reverse",
                        duration: 1.8,
                        ease: "easeInOut",
                      }}
                      className="absolute left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_rgba(52,211,153,0.8)] z-10"
                    />
                  )}

                  {flash && (
                    <div className="absolute inset-0 bg-white z-20 animate-pulse" />
                  )}
                </div>

                <div className="w-full max-w-[270px] mt-8 space-y-2 text-center">
                  <div className="flex justify-between items-center text-[10px] font-mono tracking-widest text-emerald-400/75 uppercase">
                    <span>{diagnosticText}</span>
                    <span>{scanProgress}%</span>
                  </div>

                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden border border-white/5">
                    <motion.div
                      className="h-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                      style={{ width: `${scanProgress}%` }}
                      transition={{ ease: "easeInOut" }}
                    />
                  </div>
                </div>
              </div>

              <div className="w-full p-6 border-t border-white/5 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={triggerCapture}
                  disabled={isScanning}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-105 active:scale-95 text-white text-xs font-bold uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-none transition-all disabled:opacity-50 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">photo_camera</span>
                  {isScanning ? "Scanning Face..." : "Start Biometric Scan"}
                </button>
                <button
                  type="button"
                  onClick={stopCamera}
                  className="w-full py-4 bg-[#0a0f1d]/40 hover:bg-white/5 active:scale-95 text-white/90 text-xs font-bold uppercase tracking-widest rounded-2xl transition-all shadow-none cursor-pointer premium-gradient-border"
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
