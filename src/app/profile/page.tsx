"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
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
import { KycVerificationDrawer } from "@/components/profile/KycVerificationDrawer";
import { uploadImageSecurely } from "@/lib/image-upload";
import { handleAppSignOut } from "@/lib/logout-util";

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
  const { userData, user, loading, updateUserData } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const [isKycDrawerOpen, setIsKycDrawerOpen] = useState(false);

  const [isProfileLoading, setIsProfileLoading] = useState(true);

  useEffect(() => {
    if (!loading) {
      const timer = setTimeout(() => {
        setIsProfileLoading(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // Basic User Information
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const userEmail = (userData?.email || user?.email || "captain@example.com") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const isCustomAvatar = (url?: string) => {
    if (!url) return false;
    if (url.includes("aida-public") || url.includes("googleusercontent.com/aida-public")) return false;
    return url.includes("i.ibb.co") || url.includes("ibb.co") || url.includes("images.unsplash.com");
  };

  const [imgError, setImgError] = useState(false);
  const hasCustomPhoto = isCustomAvatar(currentPhoto) && !imgError;

  // Cache user token securely for the drawers to consume
  useEffect(() => {
    if (user && typeof user.getIdToken === "function") {
      user.getIdToken().then((idToken) => {
        (window as any).firebaseUserToken = idToken;
      }).catch((err) => {
        console.error("Failed to retrieve token:", err);
      });
    } else if (user) {
      // Mock fallback
      (window as any).firebaseUserToken = "mock-token";
    }
  }, [user]);

  // Interactive KYC flow states
  const [staticAccount, setStaticAccount] = useState<{
    bankName: string;
    accountNumber: string;
    accountName: string;
  } | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(false);

  // Modal / Drawer States
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);

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

  // Phone Number State for users without a registered phone number
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [isSavingPhone, setIsSavingPhone] = useState(false);

  const handleSavePhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPhoneNumber) return;
    if (!/^\d{10,15}$/.test(newPhoneNumber.trim())) {
      toast.error("Please enter a valid phone number containing 10 to 15 digits.");
      return;
    }

    setIsSavingPhone(true);
    try {
      await updateUserData({
        phoneNumber: newPhoneNumber.trim()
      });
      toast.success("Phone number successfully added to your profile!");
      setNewPhoneNumber("");
    } catch (err: any) {
      console.error("Failed to save phone number:", err);
      toast.error(err.message || "Failed to update phone number. Please try again.");
    } finally {
      setIsSavingPhone(false);
    }
  };

  // Resolve or retrieve the permanent static account details if verified
  const loadStaticAccount = async () => {
    if (!user) return;
    const isMock = sessionStorage.getItem("mock") === "true";
    if (isMock) {
      setStaticAccount({
        bankName: "Wema Bank",
        accountNumber: "9921473281",
        accountName: `${userName.toUpperCase()}`,
      });
      return;
    }

    setLoadingAccount(true);
    try {
      let idToken = "";
      if (user) {
        idToken = await user.getIdToken();
      }

      const fullname = userData?.name || user?.displayName || "Captain User";
      const nameParts = fullname.trim().split(/\s+/);
      const firstname = nameParts[0] || "Customer";
      const lastname = nameParts.slice(1).join(" ") || "Wallet";

      const payload = {
        email: user?.email || userData?.email || `user-${user?.uid}@e-tech-hub.com`,
        phone: userData?.phoneNumber || userData?.phone || "08012345678",
        firstname,
        lastname,
        userId: user?.uid,
        isPermanent: true,
        is_permanent: true,
        bvn: userData?.bvn || userData?.nin || "22222222222",
        narration: `${firstname} ${lastname}`.trim().slice(0, 35)
      };

      const res = await fetch("/api/flutterwave/create-virtual-account", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("Raw API response from profile loadStaticAccount:", data);

        let bankName = "";
        let accountNumber = "";
        let accountName = "";

        if (data.account) {
          bankName = data.account.bankName || data.account.bank_name || "";
          accountNumber = data.account.accountNumber || data.account.account_number || "";
          accountName = data.account.accountName || data.account.account_name || "";
        } else if (data.data) {
          bankName = data.data.bankName || data.data.bank_name || "";
          accountNumber = data.data.accountNumber || data.data.account_number || "";
          accountName = data.data.accountName || data.data.account_name || "";
        } else {
          bankName = data.bankName || data.bank_name || "";
          accountNumber = data.accountNumber || data.account_number || "";
          accountName = data.accountName || data.account_name || "";
        }

        const parsedAccount = {
          bankName: String(bankName || "").trim(),
          accountNumber: String(accountNumber || "").trim(),
          accountName: String(accountName || "").trim()
        };

        console.log("Parsed account object (profile):", parsedAccount);

        if (parsedAccount.accountNumber) {
          setStaticAccount(parsedAccount);
          console.log("React state after update (setStaticAccount):", parsedAccount);
        } else {
          console.log("Why the Pending card is being rendered: parsedAccount.accountNumber is missing or empty.");
        }
      }
    } catch (err) {
      console.error("Error loading permanent account from Firestore:", err);
    } finally {
      setLoadingAccount(false);
    }
  };

  useEffect(() => {
    if (user && userData?.kycStatus === "VERIFIED") {
      loadStaticAccount();
    } else {
      setStaticAccount(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, userData?.kycStatus]);


  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image file size should be less than 5MB");
      return;
    }

    toast.loading("Uploading profile avatar securely...");

    try {
      const result = await uploadImageSecurely(file, "profile_avatar");
      toast.dismiss();

      if (result.success && result.url) {
        await updateUserData({ photoURL: result.url });
        toast.success("Profile avatar successfully uploaded and updated!");
      } else {
        toast.error(result.error || "Failed to upload avatar image!");
      }
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || "Avatar image upload failed.");
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
    await handleAppSignOut(router);
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
          <section className="premium-gradient-card premium-gradient-border p-6 flex flex-col items-center text-center h-[230px]">
            {isProfileLoading ? (
              <div className="w-24 h-24 rounded-full skeleton-shimmer shadow-lg" />
            ) : hasCustomPhoto ? (
              <div className="relative w-24 h-24 rounded-full overflow-hidden border-2 border-[#FC7A00] flex items-center justify-center bg-gray-50 shadow-lg">
                <Image
                  src={currentPhoto}
                  alt="Profile Avatar"
                  fill
                  className="object-cover"
                  priority
                  onError={() => setImgError(true)}
                />
              </div>
            ) : (
              <div className="relative w-24 h-24 rounded-full bg-gradient-to-tr from-[#FC7A00] to-[#FF9022] border-2 border-[#FC7A00] flex items-center justify-center text-white shadow-lg">
                <span className="material-symbols-outlined text-[48px] font-bold">person</span>
              </div>
            )}

            <div className="mt-4 flex gap-2.5">
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
              <button
                disabled={isProfileLoading}
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-3.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-black text-[10px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[14px]">upload_file</span>
                Upload Avatar File
              </button>
            </div>

            <div className="mt-5 w-full flex flex-col items-center">
              {isProfileLoading ? (
                <div className="space-y-2 w-full flex flex-col items-center">
                  <div className="h-5 bg-gray-200 rounded skeleton-shimmer w-32" />
                  <div className="h-3.5 bg-gray-100 rounded skeleton-shimmer w-44" />
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <h2 className="font-hanken font-bold text-xl text-black tracking-tight leading-none">{userName}</h2>
                    <span className="px-2 py-0.5 text-[9px] font-black uppercase tracking-wider bg-[#FC7A00]/10 text-[#FC7A00] border border-[#FC7A00]/30 rounded-full">
                      {userData?.kycStatus === "VERIFIED" ? "Tier 3 VIP" : "Tier 1 Standard"}
                    </span>
                  </div>
                  <p className="font-hanken text-xs text-gray-400 font-semibold mt-1.5 leading-none">{userEmail}</p>

                  {(userData?.isFrozen || userData?.status === "FROZEN") && (
                    <div className="mt-2.5 px-3 py-1 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-1.5 text-rose-600 text-[10.5px] font-extrabold">
                      <span className="material-symbols-outlined text-[14px]">ac_unit</span>
                      <span>Account Suspended / Frozen</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </section>

          {/* Dedicated Section: Referral Program */}
          <section className="premium-gradient-card premium-gradient-border p-6 space-y-4 relative overflow-hidden">
            <div className="absolute right-0 top-0 opacity-5 text-[100px] select-none pointer-events-none translate-x-1/6 -translate-y-1/6">
              <span className="material-symbols-outlined font-black text-black">group_add</span>
            </div>

            <div className="border-b border-gray-100/60 pb-2.5">
              <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500">
                Referral Program
              </h3>
              <p className="font-hanken text-[10px] text-gray-400 mt-0.5">Invite your friends and earn premium bonuses</p>
            </div>

            <p className="font-hanken text-xs leading-relaxed text-gray-600">
              Share your Account ID with users, and earn <strong className="text-black">₦1,000 Naira</strong> atomically once they register and fund their wallets with a minimum of ₦2,000 Naira.
            </p>

            <button
              type="button"
              onClick={() => router.push("/referrals")}
              className="w-full bg-[#FC7A00] hover:bg-[#E06600] text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[16px]">group_add</span>
              View My Referrals
            </button>
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

                {/* Masked BVN or NIN */}
                {!!(userData?.bvn || userData?.nin) && (
                  <div className="flex justify-between items-center p-3 bg-gray-50 border border-gray-150 rounded-2xl">
                    <div>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">
                        Verified {userData?.bvn ? "BVN" : "NIN"} Document
                      </p>
                      <p className="font-mono text-sm font-extrabold text-gray-800 tracking-widest mt-0.5">
                        {(() => {
                          const bvnVal = (userData?.bvn as string | undefined) || "";
                          const ninVal = (userData?.nin as string | undefined) || "";
                          const val = bvnVal || ninVal || "";
                          const cleaned = val.trim();
                          if (cleaned.length < 4) return cleaned;
                          return cleaned.slice(0, 2) + "*".repeat(cleaned.length - 4) + cleaned.slice(-2);
                        })()}
                      </p>
                    </div>
                    <span className="bg-emerald-100 text-emerald-800 text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wide">
                      Verified
                    </span>
                  </div>
                )}

                {loadingAccount || isProfileLoading ? (
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 border border-gray-250 rounded-2xl p-5 space-y-4 relative overflow-hidden">
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                      <div className="h-3 bg-gray-200 rounded skeleton-shimmer w-1/3" />
                      <div className="h-3 bg-gray-200 rounded skeleton-shimmer w-1/4" />
                    </div>
                    <div className="flex justify-between items-center pb-2 border-b border-gray-200/50">
                      <div className="h-3 bg-gray-200 rounded skeleton-shimmer w-1/4" />
                      <div className="h-3.5 bg-gray-200 rounded skeleton-shimmer w-1/3" />
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <div className="space-y-1.5 flex-1">
                        <div className="h-2.5 bg-gray-150 rounded skeleton-shimmer w-1/4" />
                        <div className="h-4.5 bg-gray-200 rounded skeleton-shimmer w-1/3" />
                      </div>
                      <div className="h-8 bg-gray-200 rounded-lg skeleton-shimmer w-16" />
                    </div>
                  </div>
                ) : staticAccount ? (
                  <div className="bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a] rounded-2xl p-5 text-white border-2 border-primary/20 space-y-4 relative overflow-hidden shadow-xl">
                    <div className="absolute right-0 bottom-0 text-[120px] text-white/5 pointer-events-none select-none translate-x-1/6 translate-y-1/6">
                      <span className="material-symbols-outlined">account_balance</span>
                    </div>

                    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                      <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-primary text-[20px]">account_balance</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Assigned Bank Name</p>
                        <p className="text-sm text-white font-extrabold tracking-wide mt-0.5 truncate">{staticAccount.bankName}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 border-b border-white/10 pb-3">
                      <div className="w-10 h-10 rounded-xl bg-[#00d084]/10 border border-[#00d084]/25 flex items-center justify-center shrink-0">
                        <span className="material-symbols-outlined text-[#00d084] text-[20px]">badge</span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Account Holder Name</p>
                        <p className="text-sm text-white font-extrabold tracking-wide mt-0.5 truncate">{staticAccount.accountName}</p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Static Account Number</p>
                        <p className="font-mono text-lg min-[360px]:text-xl font-black text-primary tracking-widest mt-0.5 select-all">
                          {staticAccount.accountNumber}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(staticAccount.accountNumber, "Static Account")}
                        className="bg-primary hover:bg-primary/90 text-surface-dim text-[11px] font-black py-2.5 px-4 rounded-xl flex items-center gap-1.5 active:scale-95 transition-all shadow-md shadow-primary/10 shrink-0 cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[14px] font-bold">content_copy</span>
                        Copy
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-gray-400 font-bold text-center">Static account details could not be loaded. Please contact support.</p>
                )}
              </div>
            ) : ["PENDING", "PENDING_REVIEW", "VERIFYING", "PROCESSING", "PROVISIONING", "IDENTITY_VERIFIED", "PROVISIONING_FAILED"].includes((userData?.kycStatus as string) || "") ? (
              // PENDING REVIEW / VERIFYING / PROVISIONING STATE DISPLAY
              <div className="space-y-4 text-left animate-fadeIn">
                <div className="flex items-center gap-3 p-4 bg-amber-50/70 border border-amber-100 rounded-2xl text-amber-800">
                  <span className="material-symbols-outlined text-amber-600 font-black text-[24px] animate-pulse shrink-0">pending_actions</span>
                  <div>
                    <p className="font-hanken font-extrabold text-xs uppercase tracking-wider text-amber-700">
                      Pending In Review
                    </p>
                    <p className="text-[11px] text-amber-800 font-bold leading-relaxed mt-1">
                      Your account will be approved or rejected in 30 minutes. Thanks for banking with us.
                    </p>
                  </div>
                </div>

                <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase">Current Status</span>
                    <span className="font-black text-[10px] uppercase px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 tracking-wider">
                      Pending In Review
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-gray-400 font-semibold uppercase">Verification Time</span>
                    <span className="font-mono text-gray-800 font-bold">~ 30 Minutes</span>
                  </div>
                </div>
              </div>
            ) : (
              // PENDING / FAILED INTERACTIVE FLOW CARD
              <div className="space-y-4 text-left">
                {(userData?.kycStatus === "REJECTED" || userData?.kycStatus === "VERIFICATION_FAILED" || userData?.kycStatus === "FAILED") && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-150 rounded-2xl text-red-700">
                    <span className="material-symbols-outlined text-red-500 font-bold">error</span>
                    <div>
                      <p className="font-hanken font-bold text-xs">KYC Verification Unsuccessful</p>
                      <p className="text-[10px] text-red-500 leading-tight">
                        {(userData?.kycRejectionReason as string) || "Your KYC verification was unsuccessful. Please check the information provided and try again."}
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-amber-50/50 border border-amber-100 rounded-2xl p-4 text-amber-800">
                  <p className="font-hanken text-[11px] leading-relaxed font-semibold">
                    Submit your valid 11-digit BVN or NIN and upload your identity document photo to instantly verify your identity and request permanent virtual bank account allocation.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setIsKycDrawerOpen(true)}
                  className="w-full bg-gradient-to-r from-[#FC7A00] to-[#FF9022] hover:brightness-110 text-white py-4 rounded-2xl border border-white/10 text-xs font-black uppercase tracking-widest active:scale-95 transition-all shadow-[0_4px_15px_rgba(252,122,0,0.15)] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px] font-bold">verified_user</span>
                  Verify My Identity
                </button>
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">Current 4-Digit PIN</label>
                  <input
                    type="password"
                    maxLength={4}
                    required
                    value={oldPin}
                    onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
                    placeholder="••••"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black">New 4-Digit PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
                      placeholder="••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-black">Confirm PIN</label>
                    <input
                      type="password"
                      maxLength={4}
                      required
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                      className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
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
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">Current Password</label>
                  <input
                    type="password"
                    required
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    placeholder="••••••••"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-white border border-black rounded-2xl pl-4 pr-10 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
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

          {/* Section: User Phone Number Management */}
          {userData?.phoneNumber || userData?.phone ? (
            <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
              <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
                Registered Phone Number
              </h3>
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-emerald-600">check_circle</span>
                <div>
                  <p className="font-hanken text-xs font-semibold text-black">
                    {(userData?.phoneNumber || userData?.phone) as string}
                  </p>
                  <p className="font-hanken text-[10px] text-gray-400">
                    Your phone number is securely registered and verified.
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
              <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-[#FC7A00] border-b border-gray-100/60 pb-2.5">
                Add Phone Number
              </h3>
              <p className="font-hanken text-xs text-gray-500">
                You currently do not have a phone number associated with your profile. Please add your registered WhatsApp number to secure and enable full wallet features.
              </p>
              <form onSubmit={handleSavePhone} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-black">WhatsApp Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value.replace(/\D/g, ""))}
                    className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                    placeholder="e.g. 2348031234567"
                  />
                  <p className="text-[9px] text-gray-400">Include your country code (e.g. 234 for Nigeria) with no spaces or leading plus sign.</p>
                </div>
                <button
                  type="submit"
                  disabled={isSavingPhone || !newPhoneNumber}
                  className="w-full h-11 bg-black hover:bg-black/80 text-white font-hanken font-bold text-xs rounded-2xl cursor-pointer shadow active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {isSavingPhone ? "Saving..." : "Add Phone Number to Profile"}
                </button>
              </form>
            </section>
          )}

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

      <KycVerificationDrawer
        isOpen={isKycDrawerOpen}
        onClose={() => setIsKycDrawerOpen(false)}
        onSuccess={() => {
          setIsKycDrawerOpen(false);
          window.location.reload();
        }}
      />

      <LogoutDrawer
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleLogoutConfirm}
      />

      <BottomNav />
    </>
  );
}
