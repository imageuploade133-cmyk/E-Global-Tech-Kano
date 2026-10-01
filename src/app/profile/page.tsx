"use client";

import { triggerHaptic } from "@/lib/haptics";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { LogoutDrawer } from "@/components/layout/LogoutDrawer";
import { useRouter } from "next/navigation";
import { KycVerificationDrawer } from "@/components/profile/KycVerificationDrawer";
import { handleAppSignOut } from "@/lib/logout-util";

import { ProfileHeaderSection } from "@/components/profile/ProfileHeaderSection";
import { ReferralSection } from "@/components/profile/ReferralSection";
import { KycStatusSection } from "@/components/profile/KycStatusSection";
import { SecuritySettingsSection } from "@/components/profile/SecuritySettingsSection";
import { TransferLimitsSection } from "@/components/profile/TransferLimitsSection";
import { ChangePinSection } from "@/components/profile/ChangePinSection";
import { ChangePasswordSection } from "@/components/profile/ChangePasswordSection";
import { PhoneNumberSection } from "@/components/profile/PhoneNumberSection";

export default function ProfilePage() {
  const { userData, user, loading, updateUserData } = useAuth();
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

  // Cache user token securely for the drawers to consume
  useEffect(() => {
    if (user && typeof user.getIdToken === "function") {
      user.getIdToken().then((idToken) => {
        (window as any).firebaseUserToken = idToken;
      }).catch((err) => {
        console.error("Failed to retrieve token:", err);
      });
    } else if (user) {
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

  // Security Toggles State
  const isPinRequired = userData?.isPinRequired !== false;
  const isFaceIdEnabled = userData?.isFaceIdEnabled === true;
  const is2faOtpEnabled = userData?.is2faOtpEnabled === true;
  const dailyLimit = userData?.dailyLimit ?? 500000;

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

        if (parsedAccount.accountNumber) {
          setStaticAccount(parsedAccount);
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

  const handleToggle2faOtp = async (enteredPin: string): Promise<boolean> => {
    try {
      let idToken = "";
      if (user) {
        idToken = await user.getIdToken();
      }

      // Verify 4-digit Transaction PIN first
      const verifyRes = await fetch("/api/auth/pin-verify-otp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ pin: enteredPin }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.success) {
        toast.error(verifyData.error || "Invalid Access PIN.");
        return false;
      }

      const targetState = !is2faOtpEnabled;
      await updateUserData({ is2faOtpEnabled: targetState });
      toast.success(targetState ? "2FA Login OTP Verification Enabled! 🛡️" : "2FA Login OTP Verification Disabled");
      return true;
    } catch {
      toast.error("Failed to update 2FA state");
      return false;
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
          <ProfileHeaderSection
            userName={userName}
            userEmail={userEmail}
            currentPhoto={currentPhoto}
            isProfileLoading={isProfileLoading}
            kycStatus={userData?.kycStatus as string | undefined}
            isFrozen={Boolean(userData?.isFrozen || userData?.status === "FROZEN")}
            onPhotoUploaded={async (photoURL) => {
              await updateUserData({ photoURL });
            }}
          />

          {/* Dedicated Section: Referral Program */}
          <ReferralSection
            onNavigateToReferrals={() => router.push("/referrals")}
          />

          {/* Dedicated Section: Identity Verification & KYC Flow */}
          <KycStatusSection
            kycStatus={userData?.kycStatus as string | undefined}
            bvn={userData?.bvn as string | undefined}
            nin={userData?.nin as string | undefined}
            kycRejectionReason={userData?.kycRejectionReason as string | undefined}
            loadingAccount={loadingAccount}
            isProfileLoading={isProfileLoading}
            staticAccount={staticAccount}
            onOpenKycDrawer={() => setIsKycDrawerOpen(true)}
          />

          {/* Section: Security Preferences & Toggles */}
          <SecuritySettingsSection
            isPinRequired={isPinRequired}
            isFaceIdEnabled={isFaceIdEnabled}
            is2faOtpEnabled={is2faOtpEnabled}
            onTogglePinRequired={handleTogglePinRequired}
            onToggleFaceId={handleToggleFaceId}
            onToggle2faOtp={handleToggle2faOtp}
          />

          {/* Section: Daily Transfer Limit */}
          <TransferLimitsSection
            dailyLimit={dailyLimit}
            onSelectLimitCategory={handleSelectLimitCategory}
          />

          {/* Section: Change Access PIN Form */}
          <ChangePinSection />

          {/* Section: Change Password Form */}
          <ChangePasswordSection />

          {/* Section: User Phone Number Management */}
          <PhoneNumberSection />

          {/* Section: Destructive Actions (Logout) */}
          <section className="pt-2">
            <button
              onClick={() => { triggerHaptic(); setIsLogoutOpen(true); }}
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
