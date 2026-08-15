"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface AdminUser {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  role: "admin" | "agent" | "user";
  permissions: string[];
  balance: number;
  usdBalance?: number;
  xofBalance?: number;
  bonusBalance?: number;
  createdAt: string;
}

interface PendingKycUser {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  kycType: "bvn" | "nin";
  kycNumber: string;
  kycStatus: "PENDING" | "PENDING_REVIEW" | "VERIFYING" | "IDENTITY_VERIFIED" | "VERIFICATION_FAILED" | "PROCESSING" | "PROVISIONING" | "VERIFIED" | "REJECTED" | "PROVISIONING_FAILED" | "UNVERIFIED";
  submittedAt: string;
  capturedSelfie?: string;
  livenessChallenge?: string;
}

const PERMISSIONS_CATALOG = [
  { key: "can_transact", label: "Allow Transactions" },
  { key: "can_verify_kyc", label: "Verify KYC" },
  { key: "can_manage_gateways", label: "Manage Gateways" },
  { key: "can_view_audit_logs", label: "Audit Ledger" },
  { key: "can_moderate_users", label: "Moderate Users" }
];

// Secure client-side check of hashed email
async function computeSha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex;
}

// Global flat micro spinner
const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function AdminPage() {
  const { userData, user } = useAuth();
  const { config, updateConfig, syncRealFirebaseData } = useAppConfig();

  // Dark/Light Theme state with persistent local storage
  const [theme, setTheme] = useState<"light" | "dark">("light");

  // Load theme safely on client-side mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cpanel_theme");
      if (cached === "dark" || cached === "light") {
        setTheme(cached);
      }
    }
  }, []);

  const toggleTheme = () => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      if (typeof window !== "undefined") {
        localStorage.setItem("cpanel_theme", next);
      }
      return next;
    });
  };

  // Theme style classes helper
  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-gray-900 border-gray-800 text-white" : "bg-white border border-gray-200 text-gray-800";
  const inputClass = isDark ? "bg-gray-800 border-gray-700 text-white focus:border-orange-500 placeholder-gray-500 rounded-xl px-3 py-2 text-xs outline-none transition-all w-full" : "bg-white border border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00] rounded-xl px-3 py-2 text-xs outline-none transition-all w-full";
  const labelClass = isDark ? "text-gray-300" : "text-gray-900";
  const metaClass = isDark ? "text-gray-400" : "text-gray-500";

  // Admin lock validation
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [showLockConfirm, setShowLockConfirm] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "kyc" | "settings" | "whatsapp" | "profit" | "banners" | "investments" | "history">("dashboard");

  // Fixed Deposit States
  const [fdList, setFdList] = useState<any[]>([]);
  const [isLoadingFd, setIsLoadingFd] = useState(false);

  // User History States
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyTargetUser, setHistoryTargetUser] = useState<any | null>(null);
  const [historyTransactions, setHistoryTransactions] = useState<any[]>([]);
  const [historyInvestments, setHistoryInvestments] = useState<any[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(20);

  // Check cookie-based admin session on mount
  useEffect(() => {
    const checkCPanelSession = async () => {
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setIsAdminUnlocked(true);
          setAdminEmail(data.user.email);
          if (typeof window !== "undefined") {
            sessionStorage.setItem("admin_session_unlocked", "true");
          }
        }
      } catch (err) {
        console.warn("No active admin cookie session found on mount:", err);
      }
    };
    checkCPanelSession();
  }, []);

  // Pre-fill admin email when user loads as fallback
  useEffect(() => {
    if (user?.email && !adminEmail) {
      setAdminEmail(user.email);
    }
  }, [user, adminEmail]);

  // VTU & Transfer Margins State
  const [margins, setMargins] = useState<AdminUser["balance"] | any>({
    dataProfitMargin: 0,
    airtimeProfitMargin: 0,
    cableProfitMargin: 0,
    waecProfitMargin: 0,
    electricityProfitMargin: 0,
    transferProfitMargin: 0,
    bulkTransferProfitMargin: 0,
  });
  const [isLoadingMargins, setIsLoadingMargins] = useState(false);
  const [isSavingMargins, setIsSavingMargins] = useState(false);

  // WhatsApp Linking States
  const [whatsappStatus, setWhatsappStatus] = useState<"LINKED" | "UNLINKED">("UNLINKED");
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState<string | null>(null);
  const [whatsappLinkedAt, setWhatsappLinkedAt] = useState<string | null>(null);
  const [whatsappQrCode, setWhatsappQrCode] = useState<string | null>(null);
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);

  // WhatsApp API VM Configuration States
  const [whatsappApiUrlInput, setWhatsappApiUrlInput] = useState("");
  const [whatsappApiKeyInput, setWhatsappApiKeyInput] = useState("");
  const [whatsappInstanceIdInput, setWhatsappInstanceIdInput] = useState("");
  const [whatsappAdminUsernameInput, setWhatsappAdminUsernameInput] = useState("");
  const [whatsappAdminPasswordInput, setWhatsappAdminPasswordInput] = useState("");
  const [isSavingApiConfig, setIsSavingApiConfig] = useState(false);
  const [isLinkingWhatsapp, setIsLinkingWhatsapp] = useState(false);
  const [whatsappPairMode, setWhatsappPairMode] = useState<"qr" | "code">("qr");
  const [whatsappPhoneInput, setWhatsappPhoneInput] = useState("");
  const [whatsappPhonePrefix, setWhatsappPhonePrefix] = useState("+234");
  const [whatsappPairingCode, setWhatsappPairingCode] = useState<string | null>(null);
  const [whatsappCodeCountdown, setWhatsappCodeCountdown] = useState(120);
  const [whatsappLogs, setWhatsappLogs] = useState<string[]>([
    `[${new Date().toLocaleTimeString()}] WhatsApp Gateway engine ready.`,
    `[${new Date().toLocaleTimeString()}] Idle: Waiting for administrator action...`
  ]);

  // Slide Banner States
  const [banners, setBanners] = useState<any[]>([]);
  const [isLoadingBanners, setIsLoadingBanners] = useState(false);
  const [isSavingBanner, setIsSavingBanner] = useState(false);
  const [bannerImageUrl, setBannerImageUrl] = useState("");
  const [bannerTitle, setBannerTitle] = useState("");
  const [bannerDescription, setBannerDescription] = useState("");
  const [bannerTargetPage, setBannerTargetPage] = useState<"all" | "bills" | "investment" | "referral" | "transfer">("all");
  const [bannerLink, setBannerLink] = useState("");
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  // Banner customize states
  const [bannerOverlayFade, setBannerOverlayFade] = useState(config.bannerOverlayFadeEnabled !== false);
  const [bannerSlideInterval, setBannerSlideInterval] = useState(config.bannerSlideIntervalSeconds || 5);
  const [bannerBorderEnabled, setBannerBorderEnabled] = useState(config.bannerBorderEnabled !== false);
  const [bannerBorderColor, setBannerBorderColor] = useState(config.bannerBorderColor || "#e5e7eb");
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState(config.bannerBackgroundColor || "#111827");
  const [bannerImageMode, setBannerImageMode] = useState<"cover" | "contain">(config.bannerImageMode || "cover");
  const [bannerSlideEffect, setBannerSlideEffect] = useState<"fade" | "slide">(config.bannerSlideEffect || "fade");
  const [bannerImagePosition, setBannerImagePosition] = useState(config.bannerImagePosition || "center");
  const [bannerHeightMobile, setBannerHeightMobile] = useState(config.bannerHeightMobile || 150);
  const [bannerHeightDesktop, setBannerHeightDesktop] = useState(config.bannerHeightDesktop || 220);
  const [bannerTransferPosition, setBannerTransferPosition] = useState<"top" | "bottom">(config.bannerTransferPosition || "top");
  const [isSavingDisplaySettings, setIsSavingDisplaySettings] = useState(false);

  // Sync customize state with config when config updates
  useEffect(() => {
    setBannerOverlayFade(config.bannerOverlayFadeEnabled !== false);
    setBannerSlideInterval(config.bannerSlideIntervalSeconds || 5);
    setBannerBorderEnabled(config.bannerBorderEnabled !== false);
    setBannerBorderColor(config.bannerBorderColor || "#e5e7eb");
    setBannerBackgroundColor(config.bannerBackgroundColor || "#111827");
    setBannerImageMode(config.bannerImageMode || "cover");
    setBannerSlideEffect(config.bannerSlideEffect || "fade");
    setBannerImagePosition(config.bannerImagePosition || "center");
    setBannerHeightMobile(config.bannerHeightMobile || 150);
    setBannerHeightDesktop(config.bannerHeightDesktop || 220);
    setBannerTransferPosition(config.bannerTransferPosition || "top");
  }, [config]);

  const handleSaveDisplaySettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingDisplaySettings(true);
    try {
      await updateConfig({
        bannerOverlayFadeEnabled: bannerOverlayFade,
        bannerSlideIntervalSeconds: bannerSlideInterval,
        bannerBorderEnabled: bannerBorderEnabled,
        bannerBorderColor: bannerBorderColor,
        bannerBackgroundColor: bannerBackgroundColor,
        bannerImageMode: bannerImageMode,
        bannerSlideEffect: bannerSlideEffect,
        bannerImagePosition: bannerImagePosition,
        bannerHeightMobile: bannerHeightMobile,
        bannerHeightDesktop: bannerHeightDesktop,
        bannerTransferPosition: bannerTransferPosition,
      });
      toast.success("Banner display settings updated successfully!");
    } catch {
      toast.error("Failed to save banner display configurations.");
    } finally {
      setIsSavingDisplaySettings(false);
    }
  };

  // Mobile navigation drawer toggle (App-like slide menu)
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Loading States for all buttons to provide real-time user feedback
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);
  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [isSavingBranding, setIsSavingBranding] = useState(false);

  // User management loading states
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState<string | null>(null);

  // KYC verification loading states
  const [isLoadingKyc, setIsLoadingKyc] = useState(false);
  const [isProcessingKyc, setIsProcessingKyc] = useState<string | null>(null);

  // Sidebar minimize state (Desktop only)
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false);

  // Editable settings states
  const [logoInput, setLogoInput] = useState(config.logoUrl);
  const [phone1Input, setPhone1Input] = useState(config.supportPhone1);
  const [phone2Input, setPhone2Input] = useState(config.supportPhone2);
  const [emailInput, setEmailInput] = useState(config.supportEmail);
  const [apiKeyInput, setApiKeyInput] = useState(config.imgbbApiKey || "");
  const [uploadSizeInput, setUploadSizeInput] = useState(config.maxKycUploadSizeMb || 10);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [isUpdatingDetector, setIsUpdatingDetector] = useState(false);

  // Users management states (LOW COST: Only load users on-demand when searching)
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // KYC pending users waiting for approval
  const [pendingKycList, setPendingKycUser] = useState<PendingKycUser[]>([]);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  // Selected virtual account provider for each pending submission
  const [selectedProvider, setSelectedProvider] = useState<Record<string, "flutterwave" | "squad">>({});
  // Real-time pending count for sidebar badge
  const [kycPendingCount, setKycPendingCount] = useState(0);

  // Tab & pagination state for low cost KYC desk
  const [kycTab, setKycTab] = useState<"pending" | "verified_today" | "unverified">("pending");
  const [kycLastDocId, setKycLastDocId] = useState("");
  const [kycHasMore, setKycHasMore] = useState(false);
  const [kycTotalCount, setKycTotalCount] = useState(0);

  // Dedicated visual confirmation modal
  const [adminActionModal, setAdminActionModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionStyle: "danger" | "warning" | "success" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "",
    actionStyle: "danger",
    onConfirm: () => {}
  });

  const triggerAdminConfirm = (
    title: string,
    message: string,
    actionLabel: string,
    actionStyle: "danger" | "warning" | "success" | "info",
    onConfirm: () => void
  ) => {
    setAdminActionModal({
      isOpen: true,
      title,
      message,
      actionLabel,
      actionStyle,
      onConfirm
    });
  };

  // Add user form states
  const [newUserForm, setNewUserForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    phonePrefix: "+234",
    phoneNumber: "",
    balance: 0,
    role: "user" as "admin" | "agent" | "user",
    permissions: [] as string[]
  });

  const handleUserSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchUserTerm.trim()) {
      toast.warning("Please enter a search term (email address or phone number) to save read costs.");
      return;
    }

    setIsLoadingUsers(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      // LOW COST INDEXED EQUALITY LOOKUP
      const res = await fetch(`/api/admin/users?search=${encodeURIComponent(searchUserTerm.trim())}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setUsersList(data.users || []);
        if (data.users?.length === 0) {
          toast.info("No matching records found. Double check email or complete phone number prefix.");
        } else {
          toast.success(`Found ${data.users.length} matching result(s)!`);
        }
      } else {
        toast.error(data.error || "Failed to load system users securely.");
      }
    } catch {
      toast.error("Internal network error loading system users.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  const fetchPendingKyc = async (isLoadMore: boolean = false, customTab?: "pending" | "verified_today" | "unverified") => {
    setIsLoadingKyc(true);
    const activeTabToFetch = customTab || kycTab;
    const lastDocIdToFetch = isLoadMore ? kycLastDocId : "";

    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch(`/api/admin/kyc?tab=${activeTabToFetch}&limit=10&lastDocId=${lastDocIdToFetch}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (isLoadMore) {
          setPendingKycUser(prev => [...prev, ...(data.pendingUsers || [])]);
        } else {
          setPendingKycUser(data.pendingUsers || []);
        }
        setKycLastDocId(data.lastDocId || "");
        setKycHasMore(!!data.hasMore);
        setKycTotalCount(data.totalCount || 0);
      } else {
        toast.error(data.error || "Failed to load waiting KYC approvals.");
      }
    } catch {
      toast.error("Network communication failure loading waiting KYC approvals.");
    } finally {
      setIsLoadingKyc(false);
    }
  };

  const handleProcessKyc = async (targetUid: string, action: "verify" | "approve" | "reject" | "retry") => {
    setIsProcessingKyc(targetUid);
    const reason = rejectionReason[targetUid] || "";
    const provider = selectedProvider[targetUid];

    if ((action === "approve" || action === "retry") && !provider) {
      toast.error("Please explicitly select a virtual-account provider (Flutterwave or Squadco) before proceeding.");
      setIsProcessingKyc(null);
      return;
    }

    if (action === "reject" && !reason.trim()) {
      toast.error("Please enter a rejection reason before rejecting identity verification.");
      setIsProcessingKyc(null);
      return;
    }

    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action,
          targetUid,
          reason,
          provider
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `KYC successfully processed!`);
        if (action === "approve") {
          // Filter out on successful approval
          setPendingKycUser(prev => prev.filter(u => u.uid !== targetUid));
        } else if (action === "verify") {
          // Update status to IDENTITY_VERIFIED in the local list
          setPendingKycUser(prev => prev.map(u => u.uid === targetUid ? { ...u, kycStatus: "IDENTITY_VERIFIED" as any } : u));
        } else if (action === "reject") {
          setPendingKycUser(prev => prev.map(u => u.uid === targetUid ? { ...u, kycStatus: "REJECTED" as any } : u));
        } else if (action === "retry") {
          setPendingKycUser(prev => prev.filter(u => u.uid !== targetUid));
        }
      } else {
        toast.error(data.error || "Failed to process KYC verification.");
        if (action === "verify") {
          setPendingKycUser(prev => prev.map(u => u.uid === targetUid ? { ...u, kycStatus: "VERIFICATION_FAILED" as any } : u));
        } else if (action === "approve" || action === "retry") {
          setPendingKycUser(prev => prev.map(u => u.uid === targetUid ? { ...u, kycStatus: "PROVISIONING_FAILED" as any } : u));
        }
      }
    } catch {
      toast.error("API connection error during verification processing.");
    } finally {
      setIsProcessingKyc(null);
    }
  };

  // Secure client-side check of hashed email
  useEffect(() => {
    if (user?.email) {
      computeSha256(user.email.toLowerCase().trim()).then((hash) => {
        if (hash === "ecf61cafc0876921a1980895fe1fc038a0150845cf35941beba32a31c24f373b") {
          setIsEmailAdmin(true);
        }
      });
    }
  }, [user]);

  useEffect(() => {
    if (isAdminUnlocked && (activeTab === "kyc" || kycPendingCount === 0)) {
      fetchPendingKyc(false, kycTab);
    }
  }, [isAdminUnlocked, activeTab, kycTab]);

  useEffect(() => {
    // Only update the global sidebar badge count if tab is 'pending'
    if (kycTab === "pending") {
      setKycPendingCount(pendingKycList.length);
    }
  }, [pendingKycList, kycTab]);

  // Automatically trigger real-time metrics sync on load once authorized
  useEffect(() => {
    if (isAdminUnlocked) {
      syncRealFirebaseData();
    }
  }, [isAdminUnlocked]);

  // Update inputs when config context loads or resets
  useEffect(() => {
    setLogoInput(config.logoUrl);
    setPhone1Input(config.supportPhone1);
    setPhone2Input(config.supportPhone2);
    setEmailInput(config.supportEmail);
    setApiKeyInput(config.imgbbApiKey || "");
    setUploadSizeInput(config.maxKycUploadSizeMb || 10);
  }, [config]);

  // WhatsApp Gateway Sync & Operation Handlers
  const fetchWhatsappStatus = async () => {
    setIsLoadingWhatsapp(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/whatsapp", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setWhatsappStatus(data.status || "UNLINKED");
        setWhatsappPhoneNumber(data.phoneNumber || null);
        setWhatsappLinkedAt(data.linkedAt || null);
        setWhatsappQrCode(data.qrCode || null);
        if (data.apiConfig) {
          setWhatsappApiUrlInput(data.apiConfig.whatsappApiUrl || "");
          setWhatsappApiKeyInput(data.apiConfig.whatsappApiKey || "");
          setWhatsappInstanceIdInput(data.apiConfig.whatsappInstanceId || "");
          setWhatsappAdminUsernameInput(data.apiConfig.whatsappAdminUsername || "");
          setWhatsappAdminPasswordInput(data.apiConfig.whatsappAdminPassword || "");
        }
        if (data.status === "LINKED") {
          addWhatsappLog(`Active secure session found: ${data.phoneNumber} (Linked at: ${new Date(data.linkedAt).toLocaleString()})`);
          addWhatsappLog(`WhatsApp Gateway active and monitoring OTP dispatch rails.`);
        } else {
          addWhatsappLog(`WhatsApp Gateway disconnected. Please scan the QR code to pair.`);
        }
      }
    } catch (err: any) {
      console.error("Failed to load WhatsApp link status:", err);
      addWhatsappLog(`[ERROR] Failed to query status: ${err.message}`);
    } finally {
      setIsLoadingWhatsapp(false);
    }
  };

  const addWhatsappLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setWhatsappLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

  const fetchGlobalMargins = async () => {
    setIsLoadingMargins(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/vtu-profit", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMargins({
          dataProfitMargin: Number(data.dataProfitMargin) || 0,
          airtimeProfitMargin: Number(data.airtimeProfitMargin) || 0,
          cableProfitMargin: Number(data.cableProfitMargin) || 0,
          waecProfitMargin: Number(data.waecProfitMargin) || 0,
          electricityProfitMargin: Number(data.electricityProfitMargin) || 0,
          transferProfitMargin: Number(data.transferProfitMargin) || 0,
          bulkTransferProfitMargin: Number(data.bulkTransferProfitMargin) || 0,
        });
      }
    } catch (err) {
      console.error("Failed to load global profit margins:", err);
    } finally {
      setIsLoadingMargins(false);
    }
  };

  const handleSaveGlobalMargins = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingMargins(true);
    toast.loading("Applying and securing global markup configurations...");

    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/vtu-profit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(margins),
      });

      const data = await res.json();
      toast.dismiss();

      if (res.ok && data.success) {
        toast.success("Global administrative markups applied successfully!");
      } else {
        toast.error(data.error || "Failed to save settings.");
      }
    } catch (err) {
      toast.dismiss();
      console.error("Error saving configurations:", err);
      toast.error("Connection error. Could not save settings.");
    } finally {
      setIsSavingMargins(false);
    }
  };

  const updateMarginField = (key: string, value: string) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setMargins((prev: any) => ({
      ...prev,
      [key]: num,
    }));
  };

  useEffect(() => {
    if (isAdminUnlocked && activeTab === "whatsapp") {
      fetchWhatsappStatus();
    }
  }, [isAdminUnlocked, activeTab]);

  useEffect(() => {
    if (isAdminUnlocked && activeTab === "profit") {
      fetchGlobalMargins();
    }
  }, [isAdminUnlocked, activeTab]);

  const fetchBanners = async () => {
    setIsLoadingBanners(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/banners", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setBanners(data.banners || []);
      } else {
        toast.error(data.error || "Failed to load active banners.");
      }
    } catch {
      toast.error("Network communication failure loading banners.");
    } finally {
      setIsLoadingBanners(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked && activeTab === "banners") {
      fetchBanners();
    }
  }, [isAdminUnlocked, activeTab]);

  const handleBannerFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingBanner(true);
    const formData = new FormData();
    formData.append("image", file);

    const apiKey = config.imgbbApiKey || "";
    if (!apiKey) {
      toast.error("Imgbb API Key is missing. Please save an API key in the Branding Configurations under Settings tab.");
      setIsUploadingBanner(false);
      return;
    }

    toast.loading("Uploading banner image to ImgBB...");
    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${apiKey}`, {
        method: "POST",
        body: formData
      });
      const json = await res.json();
      toast.dismiss();

      if (json.success) {
        setBannerImageUrl(json.data.display_url);
        toast.success("Banner image uploaded successfully!");
      } else {
        toast.error(json.error?.message || "Failed to upload to ImgBB.");
      }
    } catch {
      toast.dismiss();
      toast.error("ImgBB API connection error.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleAddBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bannerImageUrl.trim()) {
      toast.error("Please upload or enter a banner image URL.");
      return;
    }

    setIsSavingBanner(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/banners", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          imageUrl: bannerImageUrl.trim(),
          title: bannerTitle.trim(),
          description: bannerDescription.trim(),
          targetPage: bannerTargetPage,
          link: bannerLink.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Banner slide created successfully!");
        setBannerImageUrl("");
        setBannerTitle("");
        setBannerDescription("");
        setBannerLink("");
        setBannerTargetPage("all");
        fetchBanners(); // Reload list
      } else {
        toast.error(data.error || "Failed to save banner slide.");
      }
    } catch {
      toast.error("API connection error while saving banner.");
    } finally {
      setIsSavingBanner(false);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    triggerAdminConfirm(
      "Delete Banner Slide?",
      "Are you absolutely sure you want to permanently delete this visual marketing banner slide from user screens?",
      "Delete Slide",
      "danger",
      async () => {
        try {
          const isMock = sessionStorage.getItem("mock") === "true";
          let idToken = "mock-admin-token";
          if (!isMock && user) {
            idToken = await user.getIdToken();
          }

          const res = await fetch(`/api/admin/banners?id=${id}`, {
            method: "DELETE",
            headers: {
              "Authorization": `Bearer ${idToken}`
            }
          });

          const data = await res.json();
          if (res.ok && data.success) {
            toast.success(data.message || "Banner slide deleted.");
            fetchBanners(); // Reload list
          } else {
            toast.error(data.error || "Failed to delete banner slide.");
          }
        } catch {
          toast.error("API connection error while deleting banner.");
        }
      }
    );
  };

  const fetchUserHistory = async (customLimit?: number) => {
    const limitVal = customLimit || historyLimit;
    setIsHistoryLoading(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch(`/api/admin/user-history?search=${encodeURIComponent(historySearchQuery.trim())}&limit=${limitVal}`, {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (!data.user) {
          toast.error(data.error || "No matching account found.");
          setHistoryTargetUser(null);
        } else {
          setHistoryTargetUser(data.user);
          setHistoryTransactions(data.transactions || []);
          setHistoryInvestments(data.investments || []);
        }
      } else {
        toast.error(data.error || "Failed to parse query.");
      }
    } catch {
      toast.error("Network communication failure searching user profile.");
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const fetchGlobalInvestments = async () => {
    setIsLoadingFd(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/investments", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setFdList(data.investments || []);
      }
    } catch (err) {
      console.error("Failed to load global investments:", err);
    } finally {
      setIsLoadingFd(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked && activeTab === "investments") {
      fetchGlobalInvestments();
    }
  }, [isAdminUnlocked, activeTab]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (whatsappPairingCode && whatsappCodeCountdown > 0) {
      timer = setInterval(() => {
        setWhatsappCodeCountdown(prev => prev - 1);
      }, 1000);
    } else if (whatsappCodeCountdown === 0) {
      setWhatsappPairingCode(null);
      addWhatsappLog("Pairing code session expired. Please generate a new code.");
    }
    return () => clearInterval(timer);
  }, [whatsappPairingCode, whatsappCodeCountdown]);

  const handleGeneratePairingCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!whatsappPhoneInput.trim()) {
      toast.error("Please enter a valid WhatsApp phone number.");
      return;
    }

    setIsLinkingWhatsapp(true);
    addWhatsappLog(`Requesting Pairing Code for phone prefix: ${whatsappPhonePrefix} number: ${whatsappPhoneInput}...`);

    // Simulate API request delay
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Generate random 8 character pairing code: e.g. A2B4-9F5Z
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let part1 = "";
    let part2 = "";
    for (let i = 0; i < 4; i++) {
      part1 += chars.charAt(Math.floor(Math.random() * chars.length));
      part2 += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const code = `${part1}-${part2}`;
    setWhatsappPairingCode(code);
    setWhatsappCodeCountdown(120);
    setIsLinkingWhatsapp(false);

    addWhatsappLog(`Pairing code generated successfully: ${code}`);
    addWhatsappLog(`Waiting for device connection. Open WhatsApp > Linked Devices > Link with Phone Number.`);
    toast.success("Pairing Code generated! Enter this code on your WhatsApp app.");

    // Simulate successful link after 12 seconds
    setTimeout(async () => {
      if (activeTab === "whatsapp" && whatsappPairingCode !== "") {
        addWhatsappLog("Device handshake initiated. Verifying pairing key...");
        await new Promise(resolve => setTimeout(resolve, 2000));
        await handleApplyWhatsappLink(`${whatsappPhonePrefix}${whatsappPhoneInput}`);
      }
    }, 12000);
  };

  const handleApplyWhatsappLink = async (numToLink: string) => {
    setIsLinkingWhatsapp(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action: "link",
          phoneNumber: numToLink
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setWhatsappStatus("LINKED");
        setWhatsappPhoneNumber(data.phoneNumber);
        setWhatsappLinkedAt(data.linkedAt);
        setWhatsappPairingCode(null);
        addWhatsappLog(`Success! WhatsApp Session fully linked. Active node: ${data.phoneNumber}`);
        toast.success("WhatsApp Gateway linked successfully!");
      } else {
        toast.error(data.error || "Failed to establish link state.");
        addWhatsappLog(`[ERROR] Link failed: ${data.error}`);
      }
    } catch (err: any) {
      toast.error("Network communication failure linking session.");
      addWhatsappLog(`[ERROR] Link API failure: ${err.message}`);
    } finally {
      setIsLinkingWhatsapp(false);
    }
  };

  const handleUnlinkWhatsapp = async () => {
    triggerAdminConfirm(
      "Unlink WhatsApp Instance?",
      "Are you absolutely sure you want to unlink and log out the WhatsApp sender instance? This will suspend all WhatsApp OTP dispatch systems immediately!",
      "Unlink Instance",
      "warning",
      async () => {
        setIsLinkingWhatsapp(true);
        addWhatsappLog("Dispatching unlink payload to session manager...");

        try {
          let idToken = "mock-admin-token";
          const isMock = sessionStorage.getItem("mock") === "true";
          if (!isMock && user) {
            idToken = await user.getIdToken();
          }

          const res = await fetch("/api/admin/whatsapp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              action: "unlink"
            })
          });

          const data = await res.json();
          if (res.ok && data.success) {
            setWhatsappStatus("UNLINKED");
            setWhatsappPhoneNumber(null);
            setWhatsappLinkedAt(null);
            setWhatsappPairingCode(null);
            addWhatsappLog("WhatsApp Session logged out and destroyed successfully.");
            toast.success("WhatsApp Gateway instance unlinked successfully.");
          } else {
            toast.error(data.error || "Unlink request failed.");
            addWhatsappLog(`[ERROR] Unlink failed: ${data.error}`);
          }
        } catch (err: any) {
          toast.error("Network error unlinking WhatsApp instance.");
          addWhatsappLog(`[ERROR] Unlink API error: ${err.message}`);
        } finally {
          setIsLinkingWhatsapp(false);
        }
      }
    );
  };

  const handleSaveWhatsappApiConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingApiConfig(true);
    addWhatsappLog("Applying and storing new WhatsApp API VM gateway configs...");

    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action: "save_api_config",
          whatsappApiUrl: whatsappApiUrlInput.trim(),
          whatsappApiKey: whatsappApiKeyInput.trim(),
          whatsappInstanceId: whatsappInstanceIdInput.trim(),
          whatsappAdminUsername: whatsappAdminUsernameInput.trim(),
          whatsappAdminPassword: whatsappAdminPasswordInput.trim()
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("WhatsApp API Credentials secured successfully!");
        addWhatsappLog("Success: WhatsApp API connection keys applied.");
        // Fetch status again with new keys
        fetchWhatsappStatus();
      } else {
        toast.error(data.error || "Failed to save configuration.");
      }
    } catch (err: any) {
      toast.error("Network communication failure applying settings.");
      addWhatsappLog(`[ERROR] Save config failed: ${err.message}`);
    } finally {
      setIsSavingApiConfig(false);
    }
  };

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);

    if (!adminEmail.trim()) {
      toast.error("Please enter your admin email address.");
      setIsVerifyingPin(false);
      return;
    }

    if (!adminPin || adminPin.length < 4) {
      toast.error("Please enter your 4-digit Access PIN.");
      setIsVerifyingPin(false);
      return;
    }

    try {
      const res = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: adminEmail,
          pin: adminPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminUnlocked(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("admin_session_unlocked", "true");
        }
        toast.success(data.message || "Identity PIN Verified. Access Granted!");
      } else {
        toast.error(data.error || "Invalid Email or Access PIN!");
      }
    } catch (err: any) {
      toast.error("API connection error during verification.");
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleRefreshFirebaseMetrics = async () => {
    setIsSyncingFirebase(true);
    toast.loading("Querying real-time Firestore database matrices...");
    try {
      await syncRealFirebaseData();
      toast.dismiss();
      toast.success("All counts and global pool balance aggregates recalculated!");
    } catch {
      toast.dismiss();
      toast.error("Failed to query live metrics.");
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingBranding(true);
    try {
      await updateConfig({
        logoUrl: logoInput,
        supportPhone1: phone1Input,
        supportPhone2: phone2Input,
        supportEmail: emailInput,
        imgbbApiKey: apiKeyInput,
        maxKycUploadSizeMb: uploadSizeInput,
      });
      toast.success("Branding, Support and API configurations applied!");
    } catch (err: unknown) {
      console.error(err);
      toast.error("Failed to commit settings updates to Firebase Firestore: Missing or insufficient permissions.");
    } finally {
      setIsSavingBranding(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingLogo(true);
    const formData = new FormData();
    formData.append("image", file);

    const key = apiKeyInput || "";
    if (!key) {
      toast.error("Imgbb API Key is missing. Please enter and save an API key under Branding Configurations.");
      setIsUploadingLogo(false);
      return;
    }
    toast.loading("Uploading app logo to Imgbb servers...");

    try {
      const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      toast.dismiss();

      if (json.success) {
        const uploadedUrl = json.data.display_url;
        setLogoInput(uploadedUrl);
        updateConfig({ logoUrl: uploadedUrl });
        toast.success("App logo successfully uploaded and updated!");
      } else {
        toast.error(json.error?.message || "Failed to upload logo image to Imgbb!");
      }
    } catch {
      toast.dismiss();
      toast.error("Imgbb API communication failure. Confirm internet connection and API token.");
    } finally {
      setIsUploadingLogo(false);
    }
  };

  const handleCreateUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingUser(true);

    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action: "create",
          ...newUserForm
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "User created successfully!");
        setNewUserForm({
          firstName: "",
          lastName: "",
          email: "",
          password: "",
          phonePrefix: "+234",
          phoneNumber: "",
          balance: 0,
          role: "user",
          permissions: []
        });
        setUsersList([]); // Reset list to save reads
      } else {
        toast.error(data.error || "Failed to create user securely.");
      }
    } catch {
      toast.error("Network communication failure during user creation.");
    } finally {
      setIsCreatingUser(false);
    }
  };

  const handleSaveUserPermissions = async (userToUpdate: AdminUser) => {
    setIsUpdatingUser(userToUpdate.uid);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({
          action: "update",
          targetUid: userToUpdate.uid,
          role: userToUpdate.role,
          permissions: userToUpdate.permissions
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Permissions updated successfully!");
        setEditingUser(null);
        setUsersList(prev => prev.map(u => u.uid === userToUpdate.uid ? { ...u, role: userToUpdate.role, permissions: userToUpdate.permissions } : u));
      } else {
        toast.error(data.error || "Failed to update permissions.");
      }
    } catch {
      toast.error("Network communication failure.");
    } finally {
      setIsUpdatingUser(null);
    }
  };

  const handleDeleteUnverifiedUser = async (targetUid: string, name: string) => {
    triggerAdminConfirm(
      "Purge User Profile?",
      `Are you absolutely sure you want to permanently delete unverified user "${name.toUpperCase()}"? This action is IRREVERSIBLE and will permanently delete their auth credentials, database documents, and wallet records.`,
      "Delete Permanently",
      "danger",
      async () => {
        toast.loading("Purging unverified user from server databases...");
        try {
          let idToken = "mock-admin-token";
          const isMock = sessionStorage.getItem("mock") === "true";
          if (!isMock && user) {
            idToken = await user.getIdToken();
          }

          const res = await fetch("/api/admin/kyc", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`
            },
            body: JSON.stringify({
              action: "delete_unverified",
              targetUid
            })
          });

          const data = await res.json();
          toast.dismiss();
          if (res.ok && data.success) {
            toast.success(data.message || "User profile permanently deleted.");
            // Filter out of current list
            setPendingKycUser(prev => prev.filter(u => u.uid !== targetUid));
          } else {
            toast.error(data.error || "Failed to delete user profile.");
          }
        } catch {
          toast.dismiss();
          toast.error("Network communication failure deleting user.");
        }
      }
    );
  };

  const sidebarNavItems = [
    { id: "dashboard", label: "Metrics", icon: "cell_tower" },
    { id: "users", label: "Users & Permissions", icon: "group" },
    { id: "kyc", label: "KYC Approvals", icon: "verified_user" },
    { id: "settings", label: "Branding", icon: "diamond" },
    { id: "store", label: "Store Manager", icon: "storefront", href: "/cpanel/store" },
    { id: "freeze", label: "Account Freeze", icon: "ac_unit", href: "/cpanel/freeze" },
    { id: "limits", label: "Account Limits", icon: "trending_up", href: "/cpanel/limits" },
    { id: "bank_logos", label: "Bank Logos", icon: "account_balance", href: "/cpanel/bank-logos" },
    { id: "bill_logos", label: "Bills Logos", icon: "receipt_long", href: "/cpanel/bill-logos" },
    { id: "whatsapp", label: "WhatsApp Link", icon: "hub" },
    { id: "profit", label: "Commission Markups", icon: "tune" },
    { id: "banners", label: "Slide Banners", icon: "photo_library" },
    { id: "investments", label: "Fixed Deposits", icon: "savings" },
    { id: "history", label: "User Ledger Audits", icon: "history" },
  ];

  if (!isAdminUnlocked) {
    return (
      <main className="!mt-0 min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800" style={{ marginTop: 0 }}>
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-white rounded-3xl p-8 border border-gray-200 flex flex-col items-center text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-100 flex items-center justify-center text-[#FC7A00]">
            <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>gpp_maybe</span>
          </div>

          <div>
            <h2 className="font-hanken font-extrabold text-2xl tracking-tight text-gray-900 leading-tight">Admin Gatekeeper</h2>
            <p className="font-hanken text-xs text-gray-500 mt-1.5 font-semibold leading-relaxed">
              Welcome to the E-Tech Enterprise Control Panel. Enter your administrative passcode or your secure transaction PIN to grant access.
            </p>
          </div>

          <form onSubmit={handleAdminVerify} className="w-full space-y-4">
            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin Email Address</label>
              <input
                type="email"
                required
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-3.5 text-left font-sans text-xs text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
              />
            </div>

            <div className="space-y-1.5 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin Access PIN</label>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter 4-digit Access PIN"
                className="w-full bg-gray-50 border border-gray-200 rounded-2xl px-4 py-4 text-center font-mono font-bold text-xl text-gray-900 placeholder-gray-300 outline-none focus:border-[#FC7A00] focus:bg-white transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isVerifyingPin}
              className="w-full py-4 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:bg-[#e06600] active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              {isVerifyingPin ? <><ButtonSpinner /> Verifying Authority...</> : "Verify Authority"}
            </button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main
      className={cn(
        "h-screen overflow-hidden flex flex-col md:flex-row font-hanken !mt-0 relative transition-colors duration-300",
        isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-800"
      )}
      style={{ marginTop: 0 }}
    >
      {/* Mobile Top Navigation Bar (Hamburger Menu) */}
      <div className={cn(
        "md:hidden flex items-center justify-between px-5 py-4 w-full z-40 shrink-0 border-b transition-colors duration-300",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gray-100 p-1 flex items-center justify-center">
            <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
          </div>
          <span className={cn("font-hanken font-black text-sm tracking-tight", isDark ? "text-white" : "text-gray-900")}>E-TECH CP</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className={cn(
            "w-10 h-10 rounded-full border flex items-center justify-center active:scale-90 transition-all cursor-pointer",
            isDark ? "border-gray-700 text-gray-200" : "border-gray-200 text-gray-700"
          )}
        >
          <span className="material-symbols-outlined text-[24px]">
            {isMobileMenuOpen ? "close" : "menu"}
          </span>
        </button>
      </div>

      {/* App-like Userfriendly Sidebar Slide Menu Drawer for Small Devices */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 md:hidden"
            />

            {/* Sliding Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className={cn(
                "fixed top-0 bottom-0 left-0 w-[260px] border-r z-50 flex flex-col justify-between md:hidden transition-colors duration-300",
                isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
              )}
            >
              <div className="flex flex-col h-full">
                {/* Brand header */}
                <div className={cn("p-5 border-b flex items-center justify-between min-h-[73px]", isDark ? "border-gray-800" : "border-gray-100")}>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gray-100 p-1 flex items-center justify-center">
                      <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
                    </div>
                    <div>
                      <h1 className={cn("font-hanken font-black text-sm tracking-tight", isDark ? "text-white" : "text-gray-900")}>E-TECH</h1>
                      <p className="text-[8px] font-black tracking-widest text-[#FC7A00] uppercase mt-0.5">Control Panel</p>
                    </div>
                  </div>
                </div>

                {/* Sidebar Navigation inside drawer */}
                <nav className="p-4 space-y-1.5 flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 max-h-[calc(100vh-160px)]">
                  {sidebarNavItems.map((item) => {
                    const isActive = activeTab === item.id;
                    if (item.href) {
                      return (
                        <Link
                          key={item.id}
                          href={item.href}
                          onClick={() => setIsMobileMenuOpen(false)}
                          className={cn(
                            "flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap w-full",
                            isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                          )}
                        >
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                          <span className="flex-1 text-left">{item.label}</span>
                        </Link>
                      );
                    }
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id as any);
                          setIsMobileMenuOpen(false);
                        }}
                        className={cn(
                          "flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap w-full",
                          isActive
                            ? "bg-orange-500/10 text-[#FC7A00] border border-orange-500/20"
                            : isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        )}
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        <span className="flex-1 text-left">{item.label}</span>
                        {item.id === "kyc" && kycPendingCount > 0 && (
                          <span className="relative flex h-5 w-5 items-center justify-center mr-1">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 text-[10px] font-sans font-bold text-white items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                              {kycPendingCount}
                            </span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Console Lock Button */}
              <div className={cn("p-4 border-t", isDark ? "border-gray-800" : "border-gray-100")}>
                <button
                  onClick={() => setShowLockConfirm(true)}
                  className={cn(
                    "w-full py-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
                    isDark
                      ? "bg-gray-800 hover:bg-red-950/20 hover:text-red-400 border-gray-700 text-gray-400"
                      : "bg-gray-50 hover:bg-red-50 hover:text-red-600 border-gray-200 text-gray-500"
                  )}
                >
                  <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
                  <span>Lock Console</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Standard Desktop Sidebar menu (Hidden on mobile) */}
      <motion.aside
        animate={{ width: isSidebarMinimized ? 80 : 256 }}
        className={cn(
          "hidden md:flex w-full md:w-64 border-b md:border-b-0 md:border-r flex-col justify-between flex-shrink-0 relative overflow-hidden transition-colors duration-300",
          isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Brand Row */}
          <div className={cn("p-5 border-b flex items-center justify-between min-h-[73px]", isDark ? "border-gray-800" : "border-gray-100")}>
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded bg-gray-100 p-1 flex-shrink-0 flex items-center justify-center">
                <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
              </div>
              {!isSidebarMinimized && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col"
                >
                  <h1 className={cn("font-hanken font-black text-sm tracking-tight", isDark ? "text-white" : "text-gray-900")}>E-TECH</h1>
                  <p className="text-[8px] font-black tracking-widest text-[#FC7A00] uppercase mt-0.5">Control Panel</p>
                </motion.div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              className={cn(
                "hidden md:flex w-7 h-7 rounded-lg border items-center justify-center cursor-pointer active:scale-90 transition-all ml-1.5",
                isDark ? "border-gray-700 hover:bg-gray-800 text-gray-400" : "border-gray-150 hover:bg-gray-50 text-gray-500"
              )}
            >
              <span className="material-symbols-outlined text-[16px] font-bold">
                {isSidebarMinimized ? "chevron_right" : "chevron_left"}
              </span>
            </button>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1.5 flex flex-col gap-1 overflow-y-auto no-scrollbar flex-1 max-h-[calc(100vh-160px)]">
            {sidebarNavItems.map((item) => {
              const isActive = activeTab === item.id;
              if (item.href) {
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap w-full",
                      isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                    )}
                  >
                    <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                    {!isSidebarMinimized && <span className="flex-1 text-left">{item.label}</span>}
                  </Link>
                );
              }
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap w-full",
                    isActive
                      ? "bg-orange-500/10 text-[#FC7A00] border border-orange-500/20"
                      : isDark ? "text-gray-400 hover:bg-gray-800 hover:text-white" : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {!isSidebarMinimized && <span className="flex-1 text-left">{item.label}</span>}
                  {item.id === "kyc" && kycPendingCount > 0 && (
                    <span className={cn("relative flex h-5 w-5 items-center justify-center mr-1", isSidebarMinimized ? "ml-auto" : "")}>
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-5 w-5 bg-red-600 text-[10px] font-sans font-bold text-white items-center justify-center shadow-[0_0_8px_rgba(239,68,68,0.6)]">
                        {kycPendingCount}
                      </span>
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        <div className={cn("p-4 border-t hidden md:block", isDark ? "border-gray-800" : "border-gray-100")}>
          <button
            onClick={() => setShowLockConfirm(true)}
            className={cn(
              "w-full py-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center flex items-center justify-center gap-1.5",
              isDark
                ? "bg-gray-800 hover:bg-red-950/20 hover:text-red-400 border-gray-700 text-gray-400"
                : "bg-gray-50 hover:bg-red-50 hover:text-red-600 border-gray-200 text-gray-500"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
            {!isSidebarMinimized && <span>Lock Console</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Workspace */}
      <section className="flex-1 flex flex-col min-w-0 h-full md:h-screen overflow-hidden">
        <div role="banner" className={cn(
          "flex justify-between items-center px-8 py-5 border-b transition-colors duration-300",
          isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
        )}>
          <div>
            <h2 className={cn("font-hanken font-extrabold text-lg", isDark ? "text-white" : "text-gray-800")}>
              {activeTab === "dashboard" && "Platform Operations & Metrics"}
              {activeTab === "users" && "User & Permission Management Suite"}
              {activeTab === "kyc" && "KYC Document Verification Queue"}
              {activeTab === "settings" && "Dynamic Visual Settings Manager"}
              {activeTab === "whatsapp" && "WhatsApp API Gateway Link"}
              {activeTab === "profit" && "Global Commission Markups Manager"}
              {activeTab === "banners" && "Interactive Slide Banners Manager"}
              {activeTab === "investments" && "Secure Fixed Deposits Auditing Panel"}
              {activeTab === "history" && "User Ledger Audits & History Logs"}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">Enterprise System Suite</p>
          </div>

          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 duration-300",
              isDark
                ? "bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700"
                : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100 hover:text-black"
            )}
          >
            <span className="material-symbols-outlined text-[16px]">
              {isDark ? "light_mode" : "dark_mode"}
            </span>
            <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
          </button>
        </div>

        <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24 md:pb-8">
          <AnimatePresence mode="wait">
            {/* Tab 1: Dashboard metrics */}
            {activeTab === "dashboard" && (
              <motion.div
                key="dashboard-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                <div className={cn(
                  "flex justify-between items-center rounded-2xl p-4 gap-3 border transition-colors duration-300",
                  isDark ? "bg-orange-950/20 border-orange-900/30 text-white" : "bg-orange-50 border-orange-200 text-black"
                )}>
                  <div>
                    <h4 className={cn("font-bold text-xs uppercase", isDark ? "text-orange-400" : "text-gray-900")}>Live Database Recalculation</h4>
                    <p className={cn("text-[10px] font-semibold mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>Recalculate total registered accounts and global pool balances directly from database rails.</p>
                  </div>
                  <button
                    type="button"
                    disabled={isSyncingFirebase}
                    onClick={handleRefreshFirebaseMetrics}
                    className="px-4 py-2 bg-[#FC7A00] hover:bg-[#e06600] text-white text-[10px] font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                  >
                    {isSyncingFirebase ? <><ButtonSpinner /> Recalculating...</> : "Sync Firebase Data"}
                  </button>
                </div>

                {/* Dashboard with gorgeous premium UI glassmorphic Cards with border glows & lift effects */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Card 1: Users */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-amber-500/90 to-orange-600/90 rounded-2xl p-6 border border-orange-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Registered Users</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          {config.totalUsers.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-3">Active Accounts</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">face</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 2: NGN Holdings */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-500/90 to-teal-600/90 rounded-2xl p-6 border border-emerald-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Pool NGN Balance</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.globalNgnBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-3">Naira Reserve Liquidity</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">payments</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 3: USD Holdings */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-indigo-500/90 to-violet-600/90 rounded-2xl p-6 border border-indigo-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-indigo-100 tracking-wider">Pool USD Reserves</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ${config.globalUsdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-3">Dollar Asset Pool</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">credit_card</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Total Fixed Deposit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-cyan-500/90 to-blue-600/90 rounded-2xl p-6 border border-cyan-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-cyan-100 tracking-wider">Total Fixed Deposit</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.totalFixedDeposit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase tracking-wider mt-3">Active Savings Holdings</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">lock</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 5: Today's Deposit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-orange-500/90 to-[#E06600]/90 rounded-2xl p-6 border border-orange-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Today&apos;s Deposit</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.todayDeposit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-3">Sum Received Today</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">add_circle</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 6: Today's Transfer */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-rose-500/90 to-red-600/90 rounded-2xl p-6 border border-rose-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-rose-100 tracking-wider">Today&apos;s Transfer</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.todayTransfer?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-rose-200 font-bold uppercase tracking-wider mt-3">Sum Dispatched Today</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">near_me</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 7: Total Airtime Purchase */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-pink-500/90 to-purple-600/90 rounded-2xl p-6 border border-pink-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-pink-100 tracking-wider">Total Airtime Purchases</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.totalAirtimePurchase?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-pink-200 font-bold uppercase tracking-wider mt-3">Aggregated Airtime VTU</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">phone_iphone</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 8: Total Bonus */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-teal-500/90 to-emerald-600/90 rounded-2xl p-6 border border-teal-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-teal-100 tracking-wider">Total Bonus Wallet</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.totalBonus?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-teal-200 font-bold uppercase tracking-wider mt-3">Aggregated Referral Bonuses</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">featured_play_list</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 9: Total Transfer Profit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-600/95 to-cyan-600/95 rounded-2xl p-6 border border-emerald-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Total Transfer Profit</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.totalTransferProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-3">Admin Transfer Markups</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">currency_exchange</span>
                      </div>
                    </div>
                  </div>

                  {/* Card 10: Total Data Profit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-fuchsia-500/90 to-pink-600/90 rounded-2xl p-6 border border-fuchsia-400/30 text-white shadow-xs hover:-translate-y-1 hover:scale-[1.02] transition-all duration-300">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-fuchsia-100 tracking-wider">Total Data Profit</p>
                        <p className="font-mono text-2xl sm:text-3xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.totalDataProfit?.toLocaleString(undefined, { minimumFractionDigits: 2 }) || "0.00"}
                        </p>
                        <p className="text-[10px] text-fuchsia-200 font-bold uppercase tracking-wider mt-3">Admin Data Plan Markups</p>
                      </div>
                      <div className="w-12 h-12 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[24px]">database</span>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 2: User & Permission Management (Low reads & Low Cost exact match search) */}
            {activeTab === "users" && (
              <motion.div
                key="users-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Left Column: Register New User Form */}
                  <div className={cn("rounded-2xl p-6 md:col-span-1 flex flex-col justify-between border transition-colors duration-300", panelClass)}>
                    <div>
                      <div className={cn("border-b pb-3 mb-4", isDark ? "border-gray-800" : "border-gray-100")}>
                        <h3 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                          Secure User Creator
                        </h3>
                        <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Setup Authenticated Profile & Roles</p>
                      </div>

                      <form onSubmit={handleCreateUserSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">First Name</label>
                            <input
                              type="text"
                              required
                              value={newUserForm.firstName}
                              onChange={(e) => setNewUserForm({ ...newUserForm, firstName: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Last Name</label>
                            <input
                              type="text"
                              required
                              value={newUserForm.lastName}
                              onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Email Address</label>
                          <input
                            type="email"
                            required
                            value={newUserForm.email}
                            onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                            className={inputClass}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Secret Password</label>
                          <input
                            type="password"
                            required
                            value={newUserForm.password}
                            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                            className={inputClass}
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1 col-span-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Prefix</label>
                            <select
                              value={newUserForm.phonePrefix}
                              onChange={(e) => setNewUserForm({ ...newUserForm, phonePrefix: e.target.value })}
                              className={cn(
                                "w-full rounded-xl px-2 py-2.5 text-xs outline-none transition-all",
                                isDark ? "bg-gray-800 border border-gray-700 text-white" : "bg-white border border-gray-200 text-black"
                              )}
                            >
                              <option value="+234">+234</option>
                              <option value="+227">+227</option>
                            </select>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <label className="text-[10px] font-black uppercase text-gray-400">Phone Number</label>
                            <input
                              type="tel"
                              required
                              value={newUserForm.phoneNumber}
                              onChange={(e) => setNewUserForm({ ...newUserForm, phoneNumber: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Opening Balance (₦)</label>
                          <input
                            type="number"
                            value={newUserForm.balance}
                            onChange={(e) => setNewUserForm({ ...newUserForm, balance: Number(e.target.value) })}
                            className={inputClass}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">System Role</label>
                          <select
                            value={newUserForm.role}
                            onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as "admin" | "agent" | "user" })}
                            className={cn(
                              "w-full rounded-xl px-3 py-2 text-xs outline-none transition-all",
                              isDark ? "bg-gray-800 border border-gray-700 text-white" : "bg-white border border-gray-200 text-black"
                            )}
                          >
                            <option value="user">USER (Standard Account)</option>
                            <option value="agent">AGENT (Privileged Operative)</option>
                            <option value="admin">ADMIN (Root Access)</option>
                          </select>
                        </div>

                        {/* Assignable Permissions Toggles */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 block">Assign Security Permissions</label>
                          <div className={cn("grid grid-cols-1 gap-1.5 p-3 rounded-xl border transition-colors duration-300", isDark ? "bg-gray-800/50 border-gray-700" : "bg-gray-50 border-gray-200")}>
                            {PERMISSIONS_CATALOG.map(p => {
                              const checked = newUserForm.permissions.includes(p.key);
                              return (
                                <label key={p.key} className={cn("flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold hover:text-[#FC7A00]", isDark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900")}>
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => {
                                      const updated = checked
                                        ? newUserForm.permissions.filter(k => k !== p.key)
                                        : [...newUserForm.permissions, p.key];
                                      setNewUserForm({ ...newUserForm, permissions: updated });
                                    }}
                                    className="rounded border-gray-300 text-[#FC7A00] focus:ring-[#FC7A00] h-3.5 w-3.5 cursor-pointer"
                                  />
                                  <span>{p.label}</span>
                                </label>
                              );
                            })}
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isCreatingUser}
                          className="w-full py-3 bg-black hover:bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50"
                        >
                          {isCreatingUser ? <><ButtonSpinner /> Provisioning Account...</> : "Create Secured User"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: User directory with exact low-cost search indexing */}
                  <div className={cn("rounded-2xl p-6 md:col-span-2 space-y-5 flex flex-col justify-between border transition-colors duration-300", panelClass)}>
                    <div className="space-y-4">
                      <div className={cn("flex flex-col sm:flex-row sm:items-center justify-between border-b pb-3 gap-3", isDark ? "border-gray-800" : "border-gray-100")}>
                        <div>
                          <h3 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                            System Directory ({usersList.length})
                          </h3>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">High volume, ultra low-read cost directory search</p>
                        </div>
                      </div>

                      {/* Precise Indexed search bar form to guarantee Low Low Reads */}
                      <form onSubmit={handleUserSearchSubmit} className="flex gap-2">
                        <div className="relative flex-1">
                          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                            search
                          </span>
                          <input
                            type="text"
                            required
                            value={searchUserTerm}
                            onChange={(e) => setSearchUserTerm(e.target.value)}
                            placeholder="Enter exact email, phone number, or 11-digit BVN..."
                            className={cn(
                              "w-full rounded-xl pl-9 pr-3 py-3 text-xs outline-none transition-all",
                              isDark ? "bg-gray-800 border border-gray-700 text-white focus:border-orange-500" : "bg-gray-50 border border-gray-200 text-black focus:border-[#FC7A00]"
                            )}
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={isLoadingUsers}
                          className="px-5 py-3 bg-black hover:bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 disabled:opacity-50 flex-shrink-0"
                        >
                          {isLoadingUsers ? <ButtonSpinner /> : "Search"}
                        </button>
                      </form>

                      {/* Search results catalog */}
                      <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                        {isLoadingUsers ? (
                          <div className="text-center py-12 text-gray-400 uppercase tracking-widest font-bold text-xs">
                            <ButtonSpinner /> Interrogating User Registry...
                          </div>
                        ) : usersList.length === 0 ? (
                          <div className={cn("border rounded-xl p-6 text-center space-y-1.5", isDark ? "border-orange-950/30 bg-orange-950/10 text-gray-400" : "border-orange-100 bg-orange-50/30 text-gray-500")}>
                            <span className="material-symbols-outlined text-[32px] text-[#FC7A00]" style={{ fontVariationSettings: '"FILL" 1' }}>query_stats</span>
                            <p className={cn("font-black text-xs uppercase", isDark ? "text-white" : "text-gray-800")}>No Loaded Records</p>
                            <p className="text-[11px] leading-normal max-w-sm mx-auto font-medium">
                              To keep cloud reads low-cost and handle large volumes of users safely, please enter an exact user email address or phone number in the search bar above to fetch.
                            </p>
                          </div>
                        ) : (
                          usersList.map(u => {
                            const isEditing = editingUser?.uid === u.uid;
                            return (
                              <div key={u.uid} className={cn("p-4 border rounded-xl transition-all space-y-3", isDark ? "border-gray-800 bg-gray-800/40 hover:bg-gray-800/80" : "border-gray-150 bg-gray-50/50 hover:bg-gray-50")}>
                                <div className="flex justify-between items-start flex-wrap gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className={cn("font-extrabold text-sm leading-none", isDark ? "text-white" : "text-gray-900")}>{u.name}</h4>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                        u.role === "admin" && "bg-rose-500/10 text-rose-400 border border-rose-500/20",
                                        u.role === "agent" && "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20",
                                        u.role === "user" && (isDark ? "bg-gray-700 text-gray-300 border border-gray-600" : "bg-gray-100 text-gray-600 border border-gray-200")
                                      )}>
                                        {u.role}
                                      </span>
                                    </div>
                                    <p className="text-xs font-semibold mt-1 select-all text-gray-400">{u.email}</p>
                                    <p className="text-[10px] font-mono text-gray-400 mt-0.5">{u.phoneNumber}</p>
                                  </div>

                                  <div className="text-right space-y-1">
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Balances</p>
                                    <p className="font-mono text-[11px] font-black text-emerald-500 leading-none">₦{u.balance.toLocaleString()}</p>
                                    <p className="font-mono text-[10px] font-extrabold text-blue-500 leading-none">${(u.usdBalance || 0).toLocaleString()}</p>
                                    <p className="font-mono text-[9px] font-bold text-indigo-500 leading-none">CFA{(u.xofBalance || 0).toLocaleString()}</p>
                                  </div>
                                </div>

                                {/* Configured Permissions Badges */}
                                {!isEditing && (
                                  <div className="flex flex-wrap gap-1">
                                    {u.permissions.length === 0 ? (
                                      <span className="text-[9px] text-gray-400 font-bold uppercase italic">No Special Security Permissions Assigned</span>
                                    ) : (
                                      u.permissions.map(p => (
                                        <span key={p} className="px-2 py-0.5 rounded bg-orange-500/10 border border-orange-500/20 text-[#FC7A00] text-[8px] font-black uppercase tracking-wider">
                                          {p.replace("can_", "").replace("_", " ")}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* Edit Panel Drawer */}
                                {isEditing && editingUser && (
                                  <div className={cn("p-4 border rounded-xl space-y-4 transition-colors duration-300", isDark ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200")}>
                                    <div className="space-y-3.5">
                                      <p className="text-[10px] font-black uppercase text-[#FC7A00]">Modify Privileges & Permissions</p>

                                      <div className="space-y-1">
                                        <label className="text-[9px] font-black uppercase text-gray-400">Change Role</label>
                                        <select
                                          value={editingUser.role}
                                          onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as "admin" | "agent" | "user" })}
                                          className={cn(
                                            "w-full rounded-lg px-2.5 py-1.5 text-xs outline-none",
                                            isDark ? "bg-gray-700 text-white border border-gray-600" : "bg-gray-50 text-black border border-gray-200"
                                          )}
                                        >
                                          <option value="user">USER</option>
                                          <option value="agent">AGENT</option>
                                          <option value="admin">ADMIN</option>
                                        </select>
                                      </div>

                                      <div className="space-y-2">
                                        <label className="text-[9px] font-black uppercase text-gray-400 block">Manage Assigned Permissions</label>
                                        <div className="grid grid-cols-2 gap-2">
                                          {PERMISSIONS_CATALOG.map(p => {
                                            const isChecked = editingUser.permissions.includes(p.key);
                                            return (
                                              <label key={p.key} className={cn("flex items-center gap-1.5 cursor-pointer text-[10px] font-bold", isDark ? "text-gray-300" : "text-gray-600")}>
                                                <input
                                                  type="checkbox"
                                                  checked={isChecked}
                                                  onChange={() => {
                                                    const updated = isChecked
                                                      ? editingUser.permissions.filter(k => k !== p.key)
                                                      : [...editingUser.permissions, p.key];
                                                    setEditingUser({ ...editingUser, permissions: updated });
                                                  }}
                                                  className="rounded text-[#FC7A00] h-3 w-3 cursor-pointer"
                                                />
                                                <span>{p.label}</span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      </div>

                                      <div className="flex justify-end gap-2 pt-2 border-t border-gray-150/10">
                                        <button
                                          type="button"
                                          onClick={() => setEditingUser(null)}
                                          className="px-3 py-1.5 bg-gray-500/10 hover:bg-gray-500/20 text-gray-400 hover:text-white text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button
                                          type="button"
                                          disabled={isUpdatingUser === u.uid}
                                          onClick={() => handleSaveUserPermissions(editingUser)}
                                          className="px-3 py-1.5 bg-black hover:bg-orange-500 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer disabled:opacity-50"
                                        >
                                          {isUpdatingUser === u.uid ? <><ButtonSpinner /> Saving...</> : "Apply Changes"}
                                        </button>
                                      </div>
                                    </div>

                                    {/* administrative deposit sub-form */}
                                    <div className={cn("p-3.5 rounded-xl border space-y-3 transition-colors duration-300", isDark ? "bg-gray-900 border-gray-850" : "bg-gray-50 border-gray-150")}>
                                      <p className="text-[10px] font-black uppercase text-emerald-500">Secured Administrative Capital Deposit</p>

                                      <div className="grid grid-cols-2 gap-2">
                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black uppercase text-gray-400">Currency</label>
                                          <select
                                            id={`deposit-currency-${u.uid}`}
                                            className={cn(
                                              "w-full rounded-lg px-2.5 py-2 text-xs outline-none",
                                              isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-white text-black border border-gray-250"
                                            )}
                                          >
                                            <option value="NGN">NGN (₦)</option>
                                            <option value="USD">USD ($)</option>
                                            <option value="XOF">XOF (CFA)</option>
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[9px] font-black uppercase text-gray-400">Amount to Credit</label>
                                          <input
                                            type="number"
                                            id={`deposit-amount-${u.uid}`}
                                            placeholder="e.g. 5000"
                                            className={inputClass}
                                          />
                                        </div>
                                      </div>

                                      <button
                                        type="button"
                                        disabled={isUpdatingUser === u.uid}
                                        onClick={async () => {
                                          const currencySelect = document.getElementById(`deposit-currency-${u.uid}`) as HTMLSelectElement;
                                          const amountInput = document.getElementById(`deposit-amount-${u.uid}`) as HTMLInputElement;
                                          const currency = currencySelect?.value || "NGN";
                                          const amount = parseFloat(amountInput?.value || "0");

                                          if (isNaN(amount) || amount <= 0) {
                                            toast.error("Please enter a valid positive amount to deposit.");
                                            return;
                                          }

                                          triggerAdminConfirm(
                                            "Confirm Secured Deposit?",
                                            `Are you sure you want to securely credit ${currency} ${amount.toLocaleString()} to user "${u.name.toUpperCase()}"?`,
                                            "Credit Wallet",
                                            "success",
                                            async () => {
                                              setIsUpdatingUser(u.uid);
                                              try {
                                                let idToken = "mock-admin-token";
                                                const isMock = sessionStorage.getItem("mock") === "true";
                                                if (!isMock && user) {
                                                  idToken = await user.getIdToken();
                                                }

                                                const res = await fetch("/api/admin/deposit", {
                                                  method: "POST",
                                                  headers: {
                                                    "Content-Type": "application/json",
                                                    "Authorization": `Bearer ${idToken}`
                                                  },
                                                  body: JSON.stringify({
                                                    targetUid: u.uid,
                                                    amount,
                                                    currency
                                                  })
                                                });

                                                const data = await res.json();
                                                if (res.ok && data.success) {
                                                  toast.success(data.message || "Capital credited successfully!");
                                                  if (amountInput) amountInput.value = "";

                                                  // Instantly update user's local balance in the directory listing
                                                  setUsersList(prev => prev.map(item => {
                                                    if (item.uid === u.uid) {
                                                      if (currency === "NGN") {
                                                        return { ...item, balance: item.balance + amount };
                                                      } else if (currency === "USD") {
                                                        return { ...item, usdBalance: (item.usdBalance || 0) + amount };
                                                      } else if (currency === "XOF") {
                                                        return { ...item, xofBalance: (item.xofBalance || 0) + amount };
                                                      }
                                                    }
                                                    return item;
                                                  }));
                                                } else {
                                                  toast.error(data.error || "Secured deposit operation failed.");
                                                }
                                              } catch {
                                                toast.error("Connection error. Could not execute capital deposit.");
                                              } finally {
                                                setIsUpdatingUser(null);
                                              }
                                            }
                                          );
                                        }}
                                        className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center disabled:opacity-50"
                                      >
                                        {isUpdatingUser === u.uid ? <><ButtonSpinner /> Processing...</> : "Verify & Credit Wallet"}
                                      </button>
                                    </div>

                                    {/* kyc reset section */}
                                    <div className={cn("p-3.5 rounded-xl border space-y-2 transition-colors duration-300", isDark ? "bg-gray-900 border-gray-850" : "bg-gray-50 border-gray-150")}>
                                      <p className="text-[10px] font-black uppercase text-red-500">Advanced Identity Control</p>
                                      <p className="text-[9px] text-gray-400 font-semibold leading-normal">
                                        Resetting account KYC immediately demotes their status to UNVERIFIED, blocking all regulated actions until they submit their identity BVN/NIN documents again.
                                      </p>
                                      <button
                                        type="button"
                                        disabled={isUpdatingUser === u.uid}
                                        onClick={async () => {
                                          triggerAdminConfirm(
                                            "Remove KYC Status?",
                                            `Are you absolutely sure you want to REMOVE KYC for "${u.name.toUpperCase()}"? This will instantly suspend their access to regulated operations and request a fresh KYC submission!`,
                                            "Remove KYC",
                                            "danger",
                                            async () => {
                                              setIsUpdatingUser(u.uid);
                                              try {
                                                let idToken = "mock-admin-token";
                                                const isMock = sessionStorage.getItem("mock") === "true";
                                                if (!isMock && user) {
                                                  idToken = await user.getIdToken();
                                                }

                                                const res = await fetch("/api/admin/kyc", {
                                                  method: "POST",
                                                  headers: {
                                                    "Content-Type": "application/json",
                                                    "Authorization": `Bearer ${idToken}`
                                                  },
                                                  body: JSON.stringify({
                                                    action: "reset_kyc",
                                                    targetUid: u.uid
                                                  })
                                                });

                                                const data = await res.json();
                                                if (res.ok && data.success) {
                                                  toast.success(data.message || "KYC status reset successfully!");
                                                  setEditingUser(null);
                                                } else {
                                                  toast.error(data.error || "Failed to reset KYC status.");
                                                }
                                              } catch {
                                                toast.error("Network error during administrative KYC reset.");
                                              } finally {
                                                setIsUpdatingUser(null);
                                              }
                                            }
                                          );
                                        }}
                                        className="w-full py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center disabled:opacity-50"
                                      >
                                        {isUpdatingUser === u.uid ? <><ButtonSpinner /> Resetting...</> : "Remove KYC & Force Re-verification"}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Actions Toggle Buttons */}
                                {!isEditing && (
                                  <div className={cn("flex justify-end pt-1.5 border-t", isDark ? "border-gray-800" : "border-gray-100")}>
                                    <button
                                      onClick={() => setEditingUser({ ...u })}
                                      className={cn(
                                        "px-3 py-1 hover:brightness-110 text-[9px] font-black uppercase rounded border transition-colors cursor-pointer",
                                        isDark ? "bg-gray-800 border-gray-700 text-gray-300" : "bg-white border-gray-300 text-gray-700"
                                      )}
                                    >
                                      Edit Role & Access Toggles
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 3: Dedicated KYC waiting for approvals queue */}
            {activeTab === "kyc" && (
              <motion.div
                key="kyc-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                <div className={cn("rounded-2xl p-6 space-y-4 border transition-colors duration-300", panelClass)}>
                  <div className={cn("border-b pb-3 flex justify-between items-center flex-wrap gap-2", isDark ? "border-gray-800" : "border-gray-100")}>
                    <div>
                      <h3 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                        KYC Verification Desk
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 font-hanken">Optimize pipeline reviews, load 10 lists at a time to reduce server costs</p>
                    </div>

                    <button
                      type="button"
                      disabled={isLoadingKyc}
                      onClick={() => fetchPendingKyc(false, kycTab)}
                      className={cn(
                        "px-4 py-2 border hover:border-[#FC7A00] hover:text-[#FC7A00] transition-all text-xs font-bold uppercase tracking-wider rounded-xl cursor-pointer",
                        isDark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-600"
                      )}
                    >
                      {isLoadingKyc ? "Syncing..." : "Sync List"}
                    </button>
                  </div>

                  {/* High Fidelity Tab Bar section for KYC Verification Queue */}
                  <div className="flex p-1 bg-gray-200/80 dark:bg-gray-800 rounded-xl gap-1">
                    {[
                      { id: "pending", label: "Pending Approvals" },
                      { id: "verified_today", label: "Verified Today" },
                      { id: "unverified", label: "Unverified" }
                    ].map((tabItem) => (
                      <button
                        key={tabItem.id}
                        type="button"
                        onClick={() => {
                          setKycTab(tabItem.id as any);
                          setKycLastDocId("");
                          setPendingKycUser([]);
                          fetchPendingKyc(false, tabItem.id as any);
                        }}
                        className={cn(
                          "flex-1 py-2 rounded-lg text-xs font-hanken font-extrabold uppercase tracking-wide transition-all cursor-pointer text-center",
                          kycTab === tabItem.id
                            ? "bg-white dark:bg-gray-950 text-[#FC7A00] shadow-sm border-0"
                            : isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-black"
                        )}
                      >
                        {tabItem.label}
                        {kycTab === tabItem.id && kycTotalCount > 0 && ` (${kycTotalCount})`}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                    {isLoadingKyc && pendingKycList.length === 0 ? (
                      <div className="text-center py-16 text-gray-400 uppercase tracking-widest font-bold text-xs">
                        <ButtonSpinner /> Loading system records...
                      </div>
                    ) : pendingKycList.length === 0 ? (
                      <div className={cn("rounded-2xl p-8 text-center space-y-2 border transition-colors duration-300", isDark ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-emerald-50/20 border-emerald-100 text-emerald-800")}>
                        <span className="material-symbols-outlined text-[36px] text-emerald-500" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                        <p className="font-black text-xs uppercase">No accounts found</p>
                        <p className={cn("text-[11px] font-semibold max-w-md mx-auto leading-relaxed", isDark ? "text-emerald-500/70" : "text-emerald-600/70")}>
                          There are currently no users found under the selected category list.
                        </p>
                      </div>
                    ) : (
                      pendingKycList.map(u => {
                        const processing = isProcessingKyc === u.uid;
                        const reasonText = rejectionReason[u.uid] || "";
                        return (
                          <div key={u.uid} className={cn("p-5 border rounded-2xl transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-5", isDark ? "border-gray-800 bg-gray-800/40 hover:bg-gray-800/60" : "border-gray-150 bg-gray-50/50 hover:bg-gray-50/80")}>
                            <div className="space-y-2 flex-1">
                              <div>
                                <h4 className={cn("font-extrabold text-sm flex items-center gap-2", isDark ? "text-white" : "text-gray-900")}>
                                  {u.name}
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                    (u.kycStatus === "PENDING" || u.kycStatus === "PENDING_REVIEW") && "bg-orange-500/10 border border-orange-500/20 text-[#FC7A00]",
                                    (u.kycStatus === "PROCESSING" || u.kycStatus === "VERIFYING") && "bg-blue-500/10 border border-blue-500/20 text-blue-500 animate-pulse",
                                    u.kycStatus === "VERIFIED" && "bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold",
                                    (u.kycStatus === "PROVISIONING_FAILED" || u.kycStatus === "VERIFICATION_FAILED") && "bg-red-500/10 border border-red-500/20 text-red-500",
                                    (u.kycStatus === "REJECTED" || u.kycStatus === "UNVERIFIED") && "bg-gray-500/10 border border-gray-500/20 text-gray-500"
                                  )}>
                                    {u.kycStatus}
                                  </span>
                                </h4>
                                <p className="text-xs font-semibold mt-1 select-all text-gray-400">{u.email}</p>
                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">Phone: {u.phoneNumber}</p>
                              </div>

                              <div className={cn("grid grid-cols-2 gap-3 max-w-sm p-3 rounded-xl text-xs border transition-colors duration-300", isDark ? "bg-gray-900 border-gray-850 text-white" : "bg-white border-gray-200 text-black")}>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-400">KYC Standard Type</p>
                                  <p className="font-bold text-[#FC7A00] uppercase mt-0.5">{u.kycType}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-400">Submitted Number</p>
                                  <p className={cn("font-mono font-bold mt-0.5 select-all", isDark ? "text-white" : "text-gray-800")}>{u.kycNumber}</p>
                                </div>
                              </div>

                              {u.livenessChallenge && (
                                <div className="text-[10px] font-bold text-gray-400">
                                  Liveness Challenge Performed: <span className="text-[#FC7A00] uppercase">{u.livenessChallenge}</span>
                                </div>
                              )}

                              {/* Secured face biometrics/document verification */}
                              {u.capturedSelfie && (
                                <div className="mt-3">
                                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Submitted Identity Image</p>
                                  <div className={cn("relative w-28 h-28 rounded-2xl border overflow-hidden shadow-xs bg-white group/img cursor-zoom-in", isDark ? "border-gray-700" : "border-gray-200")}>
                                    <img src={u.capturedSelfie} alt="Selfie/Document" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Verification actions & rejection feedback */}
                            <div className="w-full md:w-auto space-y-3 text-right">
                              {u.kycStatus !== "REJECTED" && u.kycStatus !== "VERIFIED" && u.kycStatus !== "UNVERIFIED" && (
                                <div className="flex items-center gap-2 justify-end mb-2">
                                  <label className="text-[10px] font-black uppercase text-gray-400">Provider:</label>
                                  <select
                                    value={selectedProvider[u.uid] || ""}
                                    onChange={(e) => setSelectedProvider({ ...selectedProvider, [u.uid]: e.target.value as "flutterwave" | "squad" })}
                                    className={cn(
                                      "rounded-lg px-2 py-1 text-[11px] font-bold outline-none border transition-colors cursor-pointer",
                                      isDark ? "bg-gray-800 border-gray-750 text-white" : "bg-white border-gray-250 text-black"
                                    )}
                                  >
                                    <option value="">-- Select Provider --</option>
                                    <option value="flutterwave">Flutterwave</option>
                                    <option value="squad">Squadco (GTBank)</option>
                                  </select>
                                </div>
                              )}

                              <div className="flex gap-2 justify-end flex-wrap">
                                {/* Admin can permanently delete unverified/pending/rejected users to clean database */}
                                {u.kycStatus !== "VERIFIED" && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUnverifiedUser(u.uid, u.name)}
                                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-sm justify-center"
                                  >
                                    <span className="material-symbols-outlined text-[14px]">delete_forever</span>
                                    <span>Delete User</span>
                                  </button>
                                )}

                                {(u.kycStatus === "PENDING" || u.kycStatus === "PENDING_REVIEW" || u.kycStatus === "VERIFICATION_FAILED") && (
                                  <button
                                    type="button"
                                    disabled={!!isProcessingKyc}
                                    onClick={() => handleProcessKyc(u.uid, "verify")}
                                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center"
                                  >
                                    {processing ? <ButtonSpinner /> : "Check Identity"}
                                  </button>
                                )}

                                {u.kycStatus === "IDENTITY_VERIFIED" && (
                                  <button
                                    type="button"
                                    disabled={!!isProcessingKyc}
                                    onClick={() => handleProcessKyc(u.uid, "approve")}
                                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center"
                                  >
                                    {processing ? <ButtonSpinner /> : "Approve & Provision"}
                                  </button>
                                )}

                                {u.kycStatus === "PROVISIONING_FAILED" && (
                                  <button
                                    type="button"
                                    disabled={!!isProcessingKyc}
                                    onClick={() => handleProcessKyc(u.uid, "retry")}
                                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-black uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                                  >
                                    {processing ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[14px]">refresh</span>}
                                    <span>Retry Provisioning</span>
                                  </button>
                                )}
                              </div>

                              {u.kycStatus !== "REJECTED" && u.kycStatus !== "VERIFIED" && u.kycStatus !== "UNVERIFIED" && (
                                <div className="space-y-2 text-right">
                                  <input
                                    type="text"
                                    value={reasonText}
                                    onChange={(e) => setRejectionReason({ ...rejectionReason, [u.uid]: e.target.value })}
                                    placeholder="Reason if rejecting..."
                                    className={inputClass}
                                  />
                                  <button
                                    type="button"
                                    disabled={!!isProcessingKyc}
                                    onClick={() => handleProcessKyc(u.uid, "reject")}
                                    className="px-4 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[9px] font-black uppercase rounded-xl border border-rose-500/20 transition-all disabled:opacity-50 cursor-pointer inline-block"
                                  >
                                    Decline and Reject
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}

                    {/* Pagination control triggered on demand to preserve low reads */}
                    {kycHasMore && (
                      <div className="pt-4 text-center">
                        <button
                          type="button"
                          disabled={isLoadingKyc}
                          onClick={() => fetchPendingKyc(true, kycTab)}
                          className={cn(
                            "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto",
                            isDark ? "bg-gray-800 text-[#FC7A00] border border-gray-700 hover:bg-gray-750" : "bg-orange-50 text-[#FC7A00] border border-orange-100 hover:bg-orange-100/50"
                          )}
                        >
                          {isLoadingKyc ? <ButtonSpinner /> : "Load More Users"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 4: Settings Branding */}
            {activeTab === "settings" && (
              <motion.div
                key="settings-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 md:grid-cols-3 gap-6"
              >
                <div className={cn("rounded-2xl p-6 md:col-span-2 border transition-colors duration-300", panelClass)}>
                  <h3 className={cn("font-hanken font-extrabold text-sm border-b pb-3 mb-4 uppercase tracking-wide", isDark ? "border-gray-800 text-white" : "border-gray-100 text-gray-900")}>
                    Live Brand Settings
                  </h3>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className={cn("space-y-1 p-4 rounded-xl border transition-colors duration-300", isDark ? "bg-orange-950/20 border-orange-900/30" : "bg-orange-50/50 border-orange-100")}>
                      <label className="text-[10px] font-black uppercase text-[#FC7A00] tracking-wider">Imgbb API Key (Image Upload Rail)</label>
                      <input
                        type="text"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="Enter Imgbb v1 api key"
                        className={inputClass}
                      />
                    </div>
                    <div className={cn("space-y-1 p-4 rounded-xl border transition-colors duration-300", isDark ? "bg-orange-950/20 border-orange-900/30" : "bg-orange-50/50 border-orange-100")}>
                      <label className="text-[10px] font-black uppercase text-[#FC7A00] tracking-wider">Max KYC Document Upload Size (MB)</label>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={uploadSizeInput}
                        onChange={(e) => setUploadSizeInput(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="e.g. 10"
                        className={inputClass}
                      />
                      <p className="text-[9px] text-gray-400 mt-1">Configure the maximum permitted file size in MB for Identity document image uploads.</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Core Brand Logo URL</label>
                        <input
                          type="url"
                          value={logoInput}
                          onChange={(e) => setLogoInput(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Upload Logo Image File</label>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingLogo}
                          onChange={handleLogoUpload}
                          className={cn(
                            "w-full rounded-xl px-4 py-2 text-xs cursor-pointer disabled:opacity-50",
                            isDark
                              ? "bg-gray-800 border border-gray-700 text-white file:bg-gray-700 file:text-white"
                              : "bg-gray-50 border border-gray-200 text-black file:bg-orange-50 file:text-[#FC7A00]"
                          )}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Toll-Free Support Line</label>
                        <input
                          type="text"
                          value={phone1Input}
                          onChange={(e) => setPhone1Input(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">VIP Chat Hotline</label>
                        <input
                          type="text"
                          value={phone2Input}
                          onChange={(e) => setPhone2Input(e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">System Support Email</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isSavingBranding}
                      className="px-6 py-3.5 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-98"
                    >
                      {isSavingBranding ? <><ButtonSpinner /> Saving configurations...</> : "Save Branding Configurations"}
                    </button>
                  </form>
                </div>

                <div className={cn("border rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden transition-colors duration-300", isDark ? "bg-orange-950/10 border-orange-900/30" : "bg-orange-50 border-orange-100")}>
                  <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Live Platform Widget Preview</h4>
                    <div className={cn("border p-4 rounded-xl space-y-3 transition-colors duration-300", isDark ? "bg-gray-900/80 border-gray-800" : "bg-white/80 border-gray-150")}>
                      <div className="flex justify-between items-center">
                        <div className="w-10 h-10 rounded bg-white flex items-center justify-center p-1.5 border border-gray-100">
                          <img src={logoInput || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="Brand Logo Preview" className="object-contain" />
                        </div>
                        <span className="text-[10px] font-mono font-black text-[#FC7A00] bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">LIVE</span>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-black tracking-wide leading-none">Support contact details</p>
                        <p className={cn("text-xs font-black mt-1.5", isDark ? "text-white" : "text-gray-900")}>{emailInput}</p>
                        <p className="text-[11px] font-mono text-gray-400 mt-1">{phone1Input}</p>
                      </div>
                    </div>
                  </div>
                  <div className={cn("pt-4 border-t mt-4 relative z-10", isDark ? "border-gray-800" : "border-gray-100")}>
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed font-hanken">
                      All alterations committed inside this settings matrix propagates instantly to the global wallet UI client.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 5: Dedicated WhatsApp API Gateway Link console */}
            {activeTab === "whatsapp" && (
              <motion.div
                key="whatsapp-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                {/* Connection Status Overview Banner */}
                <div className={cn(
                  "p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
                  whatsappStatus === "LINKED"
                    ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-300"
                    : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/25 text-amber-900 dark:text-amber-300"
                )}>
                  <div className="flex items-center gap-4 flex-wrap">
                    <div className={cn(
                      "w-14 h-14 rounded-2xl flex items-center justify-center font-bold text-white relative",
                      whatsappStatus === "LINKED"
                        ? "bg-gradient-to-tr from-emerald-500 to-teal-600 shadow-[0_4px_12px_rgba(16,185,129,0.2)] animate-pulse"
                        : "bg-gradient-to-tr from-amber-500 to-orange-600 shadow-[0_4px_12px_rgba(245,158,11,0.2)]"
                    )}>
                      <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                        {whatsappStatus === "LINKED" ? "cloud_done" : "cloud_off"}
                      </span>
                    </div>
                    <div>
                      <h3 className={cn("font-hanken font-extrabold text-base tracking-tight uppercase", isDark ? "text-white" : "text-gray-900")}>
                        Gateway Status: {whatsappStatus === "LINKED" ? "ACTIVE & LINKED" : "DISCONNECTED / OFFLINE"}
                      </h3>
                      {whatsappStatus === "LINKED" ? (
                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5">
                          Node: <span className="font-mono select-all font-bold">{whatsappPhoneNumber}</span> • Connected: <span className="font-mono font-bold">{whatsappLinkedAt ? new Date(whatsappLinkedAt).toLocaleString() : "Just now"}</span>
                        </p>
                      ) : (
                        <p className="text-xs text-amber-600 dark:text-amber-400 font-semibold mt-0.5">
                          WhatsApp OTP dispatch rails are currently disabled. Connect a sender device below to resume.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={isLoadingWhatsapp}
                      onClick={fetchWhatsappStatus}
                      className="px-4 py-2.5 bg-black hover:bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                    >
                      {isLoadingWhatsapp ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[16px]">refresh</span>}
                      <span>Refresh Status</span>
                    </button>

                    {whatsappStatus === "LINKED" && (
                      <button
                        type="button"
                        disabled={isLinkingWhatsapp}
                        onClick={handleUnlinkWhatsapp}
                        className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95 flex items-center gap-1.5 shadow-[0_4px_12px_rgba(220,38,38,0.2)] disabled:opacity-50"
                      >
                        {isLinkingWhatsapp ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[16px]">logout</span>}
                        <span>Unlink WhatsApp Sender</span>
                      </button>
                    )}
                  </div>
                </div>

                {whatsappStatus === "UNLINKED" && (
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
                    {/* Left side: Instructions and Pairing Panel */}
                    <div className={cn("rounded-2xl p-6 md:col-span-3 border transition-colors duration-300 space-y-6", panelClass)}>
                      <div className="border-b pb-4 flex justify-between items-center">
                        <div>
                          <h4 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                            Link WhatsApp Sender Device
                          </h4>
                          <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Setup professional OTP & notification delivery systems</p>
                        </div>

                        <button
                          type="button"
                          disabled={isLoadingWhatsapp}
                          onClick={fetchWhatsappStatus}
                          className="px-3 py-1.5 bg-[#FC7A00] text-white hover:brightness-105 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all flex items-center gap-1"
                        >
                          {isLoadingWhatsapp ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[14px]">refresh</span>}
                          <span>Reconnect / Fetch QR</span>
                        </button>
                      </div>

                      {/* Mode Toggles */}
                      <div className="grid grid-cols-2 gap-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl">
                        <button
                          type="button"
                          onClick={() => {
                            setWhatsappPairMode("qr");
                            setWhatsappPairingCode(null);
                          }}
                          className={cn(
                            "py-2 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer",
                            whatsappPairMode === "qr"
                              ? "bg-white dark:bg-gray-950 text-[#FC7A00] shadow-sm"
                              : "text-gray-400 hover:text-white"
                          )}
                        >
                          Scan QR Code
                        </button>
                        <button
                          type="button"
                          onClick={() => setWhatsappPairMode("code")}
                          className={cn(
                            "py-2 rounded-lg text-xs font-extrabold uppercase transition-all cursor-pointer",
                            whatsappPairMode === "code"
                              ? "bg-white dark:bg-gray-950 text-[#FC7A00] shadow-sm"
                              : "text-gray-400 hover:text-white"
                          )}
                        >
                          Use Pairing Code
                        </button>
                      </div>

                      {/* Conditional view based on link mode */}
                      {whatsappPairMode === "qr" ? (
                        <div className="flex flex-col items-center py-6 text-center space-y-5">
                          <p className="text-xs text-gray-400 max-w-sm leading-relaxed font-semibold">
                            Open WhatsApp on your phone, navigate to <span className="text-[#FC7A00] font-bold">Linked Devices</span>, choose <span className="text-[#FC7A00] font-bold">Link a Device</span>, and point your camera to scan this QR code:
                          </p>

                          <div className={cn("p-4 rounded-2xl bg-white border inline-block relative overflow-hidden group shadow-xs transition-colors", isDark ? "border-gray-800" : "border-gray-150")}>
                            {/* Embedded high fidelity QR Server API or Live VM Base64 QR code */}
                            <img
                              src={whatsappQrCode || `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=etech-auth-gateway-session-${Date.now()}&color=000000`}
                              alt="WhatsApp Pairing QR Code"
                              className="w-48 h-48 object-contain transition-transform group-hover:scale-102"
                            />
                            {isLinkingWhatsapp && (
                              <div className="absolute inset-0 bg-white/90 dark:bg-black/90 flex flex-col items-center justify-center p-4">
                                <ButtonSpinner />
                                <p className="text-[10px] font-black uppercase text-gray-500 mt-2">Pairing device...</p>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={async () => {
                                setIsLinkingWhatsapp(true);
                                addWhatsappLog("Simulating QR camera viewport scan...");
                                await new Promise(r => setTimeout(r, 2500));
                                await handleApplyWhatsappLink("+2348033123456");
                              }}
                              className="px-5 py-2.5 bg-black hover:bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                            >
                              Simulate Scanner Scan (Mock Link)
                            </button>
                            <button
                              type="button"
                              disabled={isLoadingWhatsapp}
                              onClick={fetchWhatsappStatus}
                              className={cn(
                                "px-4 py-2 border hover:border-[#FC7A00] hover:text-[#FC7A00] transition-all text-xs font-bold uppercase rounded-xl cursor-pointer",
                                isDark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-600"
                              )}
                            >
                              {isLoadingWhatsapp ? "Syncing..." : "Refresh Code"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <p className="text-xs text-gray-400 leading-relaxed font-semibold">
                            Enter your active WhatsApp phone number below to generate an 8-character code, then enter it directly in WhatsApp on your phone:
                          </p>

                          {!whatsappPairingCode ? (
                            <form onSubmit={handleGeneratePairingCode} className="space-y-4">
                              <div className="grid grid-cols-4 gap-2">
                                <div className="col-span-1">
                                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">Prefix</label>
                                  <select
                                    value={whatsappPhonePrefix}
                                    onChange={(e) => setWhatsappPhonePrefix(e.target.value)}
                                    className={cn(
                                      "w-full rounded-xl px-2 py-2.5 text-xs outline-none transition-all",
                                      isDark ? "bg-gray-800 border border-gray-700 text-white" : "bg-white border border-gray-200 text-black"
                                    )}
                                  >
                                    <option value="+234">+234 (NG)</option>
                                    <option value="+227">+227 (NE)</option>
                                    <option value="+1">+1 (US)</option>
                                  </select>
                                </div>
                                <div className="col-span-3">
                                  <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">WhatsApp Number</label>
                                  <input
                                    type="tel"
                                    required
                                    value={whatsappPhoneInput}
                                    onChange={(e) => setWhatsappPhoneInput(e.target.value)}
                                    placeholder="e.g. 8123456789"
                                    className={inputClass}
                                  />
                                </div>
                              </div>

                              <button
                                type="submit"
                                disabled={isLinkingWhatsapp}
                                className="w-full py-3.5 bg-black hover:bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50"
                              >
                                {isLinkingWhatsapp ? <><ButtonSpinner /> Requesting Pairing Key...</> : "Generate Pairing Code"}
                              </button>
                            </form>
                          ) : (
                            <div className="flex flex-col items-center py-4 text-center space-y-4">
                              <p className="text-[10px] font-black uppercase text-gray-400">Enter this code on your device:</p>
                              <div className="font-mono text-4xl font-black tracking-widest text-[#FC7A00] bg-gray-100 dark:bg-gray-800 px-6 py-4 rounded-2xl border border-gray-150 dark:border-gray-700 animate-pulse">
                                {whatsappPairingCode}
                              </div>
                              <p className="text-xs text-gray-500 font-semibold">
                                Code expires in <span className="font-mono text-[#FC7A00] font-black">{Math.floor(whatsappCodeCountdown / 60)}:{(whatsappCodeCountdown % 60).toString().padStart(2, "0")}</span>
                              </p>

                              <button
                                type="button"
                                onClick={() => setWhatsappPairingCode(null)}
                                className="text-[11px] text-[#FC7A00] hover:underline font-black uppercase tracking-wider cursor-pointer"
                              >
                                Cancel & Enter different number
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Right side: Dynamic WhatsApp API Configuration Form */}
                    <div className={cn("rounded-2xl p-6 md:col-span-2 border transition-colors duration-300 space-y-4", panelClass)}>
                      <div className="border-b pb-3.5">
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#FC7A00]">API Configuration Keys</h4>
                        <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Manage live connection to backend WhatsApp API VM</p>
                      </div>

                      <form onSubmit={handleSaveWhatsappApiConfig} className="space-y-3.5 text-left">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-404">WHATSAPP_API_URL</label>
                          <input
                            type="url"
                            value={whatsappApiUrlInput}
                            onChange={(e) => setWhatsappApiUrlInput(e.target.value)}
                            placeholder="e.g. http://192.168.1.100:3055"
                            className={inputClass}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-404">WHATSAPP_API_KEY</label>
                          <input
                            type="password"
                            value={whatsappApiKeyInput}
                            onChange={(e) => setWhatsappApiKeyInput(e.target.value)}
                            placeholder="Enter API apikey"
                            className={inputClass}
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-gray-404">WHATSAPP_INSTANCE_ID</label>
                          <input
                            type="text"
                            value={whatsappInstanceIdInput}
                            onChange={(e) => setWhatsappInstanceIdInput(e.target.value)}
                            placeholder="e.g. my-session-instance"
                            className={inputClass}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-gray-404">Admin User</label>
                            <input
                              type="text"
                              value={whatsappAdminUsernameInput}
                              onChange={(e) => setWhatsappAdminUsernameInput(e.target.value)}
                              placeholder="Username"
                              className={inputClass}
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black uppercase text-gray-404">Admin Pass</label>
                            <input
                              type="password"
                              value={whatsappAdminPasswordInput}
                              onChange={(e) => setWhatsappAdminPasswordInput(e.target.value)}
                              placeholder="Password"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingApiConfig}
                          className="w-full py-3.5 bg-black hover:bg-[#FC7A00] text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 disabled:opacity-50"
                        >
                          {isSavingApiConfig ? <><ButtonSpinner /> Saving Configs...</> : "Save API Configuration"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {/* Live Connection log terminal */}
                <div className={cn("rounded-2xl p-6 border transition-colors duration-300 space-y-4", panelClass)}>
                  <div className="flex justify-between items-center border-b pb-3">
                    <div>
                      <h4 className={cn("font-hanken font-extrabold text-xs uppercase", labelClass)}>
                        WhatsApp Gateway System Console Logs
                      </h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Real-time status updates and delivery heartbeats</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setWhatsappLogs([
                        `[${new Date().toLocaleTimeString()}] System console buffer cleared.`,
                        `[${new Date().toLocaleTimeString()}] Gateway Status: ${whatsappStatus}`
                      ])}
                      className={cn(
                        "px-3 py-1 border hover:border-red-500 hover:text-red-500 transition-all text-[9px] font-black uppercase rounded-lg cursor-pointer",
                        isDark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-500"
                      )}
                    >
                      Clear Logs
                    </button>
                  </div>

                  {/* Terminal emulator container */}
                  <div className="bg-black text-emerald-400 font-mono text-[11px] rounded-xl p-4 h-48 overflow-y-auto border border-gray-800 custom-scrollbar shadow-inner flex flex-col-reverse gap-1.5 selection:bg-emerald-900 selection:text-white">
                    {whatsappLogs.map((log, idx) => (
                      <div key={idx} className="leading-relaxed whitespace-pre-wrap select-text truncate">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 6: Secure Commission Markups Settings Panel */}
            {activeTab === "profit" && (
              <motion.div
                key="profit-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                {/* Secure Alert Banner */}
                <div className={cn(
                  "p-5 rounded-2xl border text-left flex items-start gap-3.5 transition-colors duration-300",
                  isDark ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-900"
                )}>
                  <span className="material-symbols-outlined text-[22px] shrink-0 text-emerald-500 font-bold">shield</span>
                  <div className="space-y-1">
                    <h3 className="font-bold text-xs uppercase tracking-wide">Secure Server-Side Markup Execution</h3>
                    <p className="text-[11px] leading-relaxed font-semibold opacity-85">
                      These global markup configs are stored in Firestore and loaded atomically by Google Cloud transaction engines. Public users or client-side packages can never access, read, or bypass these margins.
                    </p>
                  </div>
                </div>

                {isLoadingMargins ? (
                  <div className="py-24 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
                    <ButtonSpinner />
                    <span>Synchronizing commission guidelines...</span>
                  </div>
                ) : (
                  <form onSubmit={handleSaveGlobalMargins} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Left Block */}
                      <div className="space-y-4">
                        <div className={cn("p-6 border rounded-2xl transition-colors duration-300 space-y-4", panelClass)}>
                          <h4 className="text-xs font-black uppercase text-[#FC7A00] tracking-wider border-b pb-2">VTU Products Markup</h4>

                          <div className="space-y-4">
                            {/* Data Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Mobile Data Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.dataProfitMargin || ""}
                                onChange={(e) => updateMarginField("dataProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 50"
                              />
                              <p className="text-[9px] text-gray-500 font-semibold leading-relaxed mt-0.5">Added directly to MTN, Glo, Airtel & 9Mobile plans.</p>
                            </div>

                            {/* Airtime Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Airtime Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.airtimeProfitMargin || ""}
                                onChange={(e) => updateMarginField("airtimeProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 20"
                              />
                            </div>

                            {/* Cable TV Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Cable TV Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.cableProfitMargin || ""}
                                onChange={(e) => updateMarginField("cableProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 100"
                              />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Right Block */}
                      <div className="space-y-4">
                        <div className={cn("p-6 border rounded-2xl transition-colors duration-300 space-y-4", panelClass)}>
                          <h4 className="text-xs font-black uppercase text-[#FC7A00] tracking-wider border-b pb-2">Utility & Transfers Markup</h4>

                          <div className="space-y-4">
                            {/* Electricity Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Electricity Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.electricityProfitMargin || ""}
                                onChange={(e) => updateMarginField("electricityProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 150"
                              />
                            </div>

                            {/* WAEC Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">WAEC PIN Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.waecProfitMargin || ""}
                                onChange={(e) => updateMarginField("waecProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 200"
                              />
                            </div>

                            {/* Single Transfer Fee Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Single Transfer Fee Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.transferProfitMargin || ""}
                                onChange={(e) => updateMarginField("transferProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 50"
                              />
                              <p className="text-[9px] text-gray-500 font-semibold leading-relaxed mt-0.5">Markup fee added securely on Single out bank transfers.</p>
                            </div>

                            {/* Bulk Transfer Fee Markup */}
                            <div className="space-y-1">
                              <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Bulk Transfer Fee Markup (₦)</label>
                              <input
                                type="number"
                                value={margins.bulkTransferProfitMargin || ""}
                                onChange={(e) => updateMarginField("bulkTransferProfitMargin", e.target.value)}
                                className={inputClass}
                                placeholder="e.g. 30"
                              />
                              <p className="text-[9px] text-gray-500 font-semibold leading-relaxed mt-0.5">Markup fee added per recipient inside Bulk Transfers.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSavingMargins}
                      className="px-6 py-3.5 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-98 shadow-sm flex items-center justify-center"
                    >
                      {isSavingMargins ? <><ButtonSpinner /> Saving changes...</> : "Save Markup configurations"}
                    </button>
                  </form>
                )}
              </motion.div>
            )}

            {/* Tab 8: User History & Ledger Auditing Panel */}
            {activeTab === "history" && (
              <motion.div
                key="history-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                {/* Search Panel inside main page context */}
                <div className={cn("rounded-2xl p-6 border transition-all duration-300 space-y-4", panelClass)}>
                  <div>
                    <h3 className="font-extrabold text-sm uppercase">Secure Profile Search Engine</h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Audit user account profiles, transaction ledgers, and placements</p>
                  </div>

                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      if (!historySearchQuery.trim()) {
                        toast.warning("Please enter a user email or phone prefix to search.");
                        return;
                      }
                      setHistoryLimit(20);
                      setHistoryTargetUser(null);
                      setHistoryTransactions([]);
                      setHistoryInvestments([]);
                      await fetchUserHistory(20);
                      toast.success("User timeline populated!");
                    }}
                    className="flex gap-2"
                  >
                    <div className="relative flex-1">
                      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                        search
                      </span>
                      <input
                        type="text"
                        required
                        value={historySearchQuery}
                        onChange={(e) => setHistorySearchQuery(e.target.value)}
                        placeholder="Enter exact email, phone number, or 11-digit BVN (e.g. 12345678901)"
                        className={cn(
                          "w-full rounded-xl pl-9 pr-3 py-3 text-xs outline-none transition-all",
                          isDark ? "bg-gray-800 border border-gray-700 text-white focus:border-orange-500" : "bg-gray-50 border border-gray-200 text-black focus:border-[#FC7A00]"
                        )}
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isHistoryLoading}
                      className="px-5 py-3 bg-black hover:bg-gray-900 text-white rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 disabled:opacity-50 flex-shrink-0 cursor-pointer"
                    >
                      {isHistoryLoading ? (
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : "Inspect Profile"}
                    </button>
                  </form>
                </div>

                {/* Display Area */}
                <AnimatePresence mode="wait">
                  {isHistoryLoading ? (
                    <div className="py-24 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
                      <div className="w-8 h-8 rounded-full border-3 border-gray-250 border-t-[#FC7A00] animate-spin" />
                      <span>Querying database timelines securely...</span>
                    </div>
                  ) : historyTargetUser ? (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="space-y-6"
                    >
                      {/* Profile Card Summary & Balances */}
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        {/* Profile card */}
                        <div className={cn("p-5 rounded-2xl border transition-colors duration-300 md:col-span-1 space-y-4", panelClass)}>
                          <div className="border-b pb-3.5">
                            <h4 className="text-xs font-black uppercase tracking-wider text-[#FC7A00]">Account Summary</h4>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Enriched user profile meta-data</p>
                          </div>

                          <div className="space-y-3.5">
                            <div>
                              <p className="text-[10px] font-black uppercase text-gray-400">Legal Name</p>
                              <p className="font-extrabold text-sm mt-0.5 leading-tight">{historyTargetUser.name}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-black uppercase text-gray-400">Email Address</p>
                              <p className="font-semibold text-xs text-gray-400 mt-0.5 break-all select-all leading-tight">{historyTargetUser.email}</p>
                            </div>

                            <div>
                              <p className="text-[10px] font-black uppercase text-gray-400">Phone Number</p>
                              <p className="font-mono text-xs font-semibold text-gray-400 mt-0.5 select-all leading-tight">{historyTargetUser.phoneNumber}</p>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">KYC Status</p>
                                <span className={cn(
                                  "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider inline-block mt-0.5 border",
                                  historyTargetUser.kycStatus === "APPROVED" || historyTargetUser.kycStatus === "VERIFIED"
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-amber-500/10 text-amber-400 border-amber-500/20"
                                )}>
                                  {historyTargetUser.kycStatus}
                                </span>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">System Role</p>
                                <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-gray-500/10 text-gray-400 border border-gray-500/20 inline-block mt-0.5">
                                  {historyTargetUser.role}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Main Balance card */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-amber-500/90 to-orange-600/90 border border-orange-400/30 text-white shadow-xs flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">NGN Wallet Balance</p>
                            <p className="font-mono text-xl font-black mt-2 leading-none">
                              ₦{historyTargetUser.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="text-[9px] text-orange-200 font-bold uppercase tracking-wider mt-3">NGN Reserve Balance</p>
                        </div>

                        {/* USD Balance card */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-500/90 to-blue-600/90 border border-indigo-400/30 text-white shadow-xs flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase text-indigo-100 tracking-wider">USD Wallet Balance</p>
                            <p className="font-mono text-xl font-black mt-2 leading-none">
                              ${(historyTargetUser.usdBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="text-[9px] text-indigo-200 font-bold uppercase tracking-wider mt-3">USD Reserve Balance</p>
                        </div>

                        {/* XOF Balance card */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-fuchsia-500/90 to-pink-600/90 border border-fuchsia-400/30 text-white shadow-xs flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase text-fuchsia-100 tracking-wider">XOF Wallet Balance</p>
                            <p className="font-mono text-xl font-black mt-2 leading-none">
                              CFA{(historyTargetUser.xofBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="text-[9px] text-fuchsia-200 font-bold uppercase tracking-wider mt-3">XOF Reserve Balance</p>
                        </div>

                        {/* Bonus Balance card */}
                        <div className="p-5 rounded-2xl bg-gradient-to-br from-teal-500/90 to-emerald-600/90 border border-teal-400/30 text-white shadow-xs flex flex-col justify-between">
                          <div>
                            <p className="text-[10px] font-black uppercase text-teal-100 tracking-wider">Bonus Wallet Balance</p>
                            <p className="font-mono text-xl font-black mt-2 leading-none">
                              ₦{historyTargetUser.bonusBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </p>
                          </div>
                          <p className="text-[9px] text-teal-200 font-bold uppercase tracking-wider mt-3">Commissions & Referrals</p>
                        </div>
                      </div>

                      {/* Transactions list card */}
                      <div className={cn("p-6 rounded-2xl border transition-colors duration-300 space-y-4", panelClass)}>
                        <div className="border-b pb-3.5 flex justify-between items-center">
                          <div>
                            <h4 className="text-xs font-black uppercase text-[#FC7A00] tracking-wider">Transaction History Log</h4>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Full S2S ledger record audits ({historyTransactions.length})</p>
                          </div>
                        </div>

                        <div className="overflow-x-auto pr-1">
                          {historyTransactions.length === 0 ? (
                            <div className="text-center py-12 text-gray-500 uppercase font-black text-xs">
                              No transactional logs exist for this account.
                            </div>
                          ) : (
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-gray-250 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                  <th className="pb-3 pl-2">Description</th>
                                  <th className="pb-3 text-right">Amount</th>
                                  <th className="pb-3 text-center">Type</th>
                                  <th className="pb-3 text-center">Status</th>
                                  <th className="pb-3 text-center">Reference ID</th>
                                  <th className="pb-3 text-center">Timestamp</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                                {historyTransactions.map((tx) => {
                                  const isCredit = tx.type === "DEPOSIT" || tx.type === "REFUND";
                                  const isSuccess = tx.status === "SUCCESSFUL" || tx.status === "SUCCESS";
                                  return (
                                    <tr key={tx.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                                      <td className="py-3 pl-2 max-w-[220px] truncate" title={tx.description}>
                                        <p className="font-extrabold text-xs">{tx.description}</p>
                                      </td>
                                      <td className={cn(
                                        "py-3 text-right font-mono font-black text-xs",
                                        isCredit ? "text-emerald-500" : (isDark ? "text-white" : "text-gray-900")
                                      )}>
                                        {isCredit ? "+" : "-"}₦{tx.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-3 text-center font-bold">
                                        <span className="px-2 py-0.5 rounded text-[8px] bg-gray-500/10 border border-gray-500/20 text-gray-400 font-black uppercase tracking-wider">
                                          {tx.type}
                                        </span>
                                      </td>
                                      <td className="py-3 text-center">
                                        <span className={cn(
                                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                          isSuccess
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                                        )}>
                                          {tx.status}
                                        </span>
                                      </td>
                                      <td className="py-3 text-center font-mono text-[9px] text-gray-500 break-all select-all">
                                        {tx.reference}
                                      </td>
                                      <td className="py-3 text-center text-gray-400 text-[10px] font-semibold font-mono">
                                        {new Date(tx.createdAt).toLocaleString()}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                        </div>

                        {historyTransactions.length >= historyLimit && (
                          <div className="pt-4 text-center border-t" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                            <button
                              type="button"
                              disabled={isHistoryLoading}
                              onClick={async () => {
                                const nextLimit = historyLimit + 20;
                                setHistoryLimit(nextLimit);
                                await fetchUserHistory(nextLimit);
                              }}
                              className={cn(
                                "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto",
                                isDark ? "bg-gray-800 text-[#FC7A00] border border-gray-700 hover:bg-gray-750" : "bg-orange-50 text-[#FC7A00] border border-orange-100 hover:bg-orange-100/50"
                              )}
                            >
                              {isHistoryLoading ? <ButtonSpinner /> : "Load More Logs"}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Fixed Deposits list card */}
                      {historyInvestments.length > 0 && (
                        <div className={cn("p-6 rounded-2xl border transition-colors duration-300 space-y-4", panelClass)}>
                          <div className="border-b pb-3.5">
                            <h4 className="text-xs font-black uppercase text-[#FC7A00] tracking-wider">Fixed Deposits Placements</h4>
                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Savings placements & matures logs ({historyInvestments.length})</p>
                          </div>

                          <div className="overflow-x-auto pr-1">
                            <table className="w-full text-left border-collapse text-xs">
                              <thead>
                                <tr className="border-b border-gray-250 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                                  <th className="pb-3 pl-2">Savings Plan</th>
                                  <th className="pb-3 text-right">Principal</th>
                                  <th className="pb-3 text-center">Accrued Yield</th>
                                  <th className="pb-3 text-center">Status</th>
                                  <th className="pb-3 text-center">Timeline</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                                {historyInvestments.map((inv) => {
                                  const estYield = inv.amount * (Number(inv.interestRate) / 100);
                                  const isActive = inv.status === "ACTIVE";
                                  return (
                                    <tr key={inv.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                                      <td className="py-3 pl-2">
                                        <p className="font-extrabold text-xs">{inv.description}</p>
                                      </td>
                                      <td className="py-3 text-right font-mono font-bold text-xs">
                                        ₦{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                      </td>
                                      <td className="py-3 text-center font-mono font-black text-[#FC7A00]">
                                        {inv.interestRate}% (+₦{estYield.toLocaleString()})
                                      </td>
                                      <td className="py-3 text-center">
                                        <span className={cn(
                                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                          isActive
                                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                        )}>
                                          {inv.status}
                                        </span>
                                      </td>
                                      <td className="py-3 text-center">
                                        <p className="text-[9px] font-semibold text-gray-400">Created: {new Date(inv.createdAt).toLocaleDateString()}</p>
                                        <p className="text-[9px] font-extrabold text-[#FC7A00] mt-0.5">Matures: {new Date(inv.maturesAt).toLocaleDateString()}</p>
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {historyInvestments.length >= historyLimit && (
                            <div className="pt-4 text-center border-t" style={{ borderColor: isDark ? "#1f2937" : "#e5e7eb" }}>
                              <button
                                type="button"
                                disabled={isHistoryLoading}
                                onClick={async () => {
                                  const nextLimit = historyLimit + 20;
                                  setHistoryLimit(nextLimit);
                                  await fetchUserHistory(nextLimit);
                                }}
                                className={cn(
                                  "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5 mx-auto",
                                  isDark ? "bg-gray-800 text-[#FC7A00] border border-gray-700 hover:bg-gray-750" : "bg-orange-50 text-[#FC7A00] border border-orange-100 hover:bg-orange-100/50"
                                )}
                              >
                                {isHistoryLoading ? <ButtonSpinner /> : "Load More Deposits"}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </motion.div>
                  ) : (
                    <div className={cn("border rounded-xl p-8 text-center space-y-1.5", isDark ? "border-orange-950/30 bg-orange-950/10 text-gray-400" : "border-orange-100 bg-orange-50/30 text-gray-500")}>
                      <span className="material-symbols-outlined text-[32px] text-[#FC7A00]" style={{ fontVariationSettings: '"FILL" 1' }}>query_stats</span>
                      <p className={cn("font-black text-xs uppercase", isDark ? "text-white" : "text-gray-800")}>No Loaded Ledger</p>
                      <p className="text-[11px] leading-normal max-w-sm mx-auto font-medium">
                        To secure our database reads, please enter an exact user email address or phone prefix in the search panel above to fetch timelines and full financial ledgers.
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Tab 6.5: Deploy and Manage Slide Banners */}
            {activeTab === "banners" && (
              <motion.div
                key="banners-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn text-left"
              >
                <div className={cn(
                  "p-5 rounded-2xl border text-left flex items-start gap-3.5 transition-colors duration-300",
                  isDark ? "bg-[#FC7A00]/10 border-[#FC7A00]/20 text-[#FC7A00]" : "bg-orange-50 border-orange-200 text-orange-900"
                )}>
                  <div className="w-10 h-10 rounded-xl bg-[#FC7A00]/10 flex items-center justify-center flex-shrink-0">
                    <span className="material-symbols-outlined text-[24px]">view_carousel</span>
                  </div>
                  <div>
                    <h4 className={cn("font-hanken font-extrabold text-sm uppercase", isDark ? "text-white" : "text-gray-900")}>
                      Interactive Marketing Carousels
                    </h4>
                    <p className="text-[11px] leading-relaxed mt-0.5 font-semibold text-gray-500">
                      Deploy slide banners targeted directly to key sections (Bills VTU, Investments, and Referrals). These slides feature real-time automatic carousel transitions, custom caption overlays, action buttons, and full responsive support for any device viewport.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Create Banners Form & Display customizer */}
                  <div className="lg:col-span-1 space-y-6">
                    {/* Display configurations customizer inside Cpanel tab */}
                    <div className={cn("rounded-2xl p-5 border transition-all shadow-none", panelClass)}>
                      <div className={cn("border-b pb-3 mb-4 flex items-center gap-2", isDark ? "border-gray-800" : "border-gray-150")}>
                        <span className="material-symbols-outlined text-orange-500 text-[20px]">tune</span>
                        <h3 className="font-black text-xs uppercase tracking-wider">Display Settings</h3>
                      </div>

                      <form onSubmit={handleSaveDisplaySettings} className="space-y-4">
                        {/* Remove overlay fade */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Remove Overlay Fade</span>
                          <button
                            type="button"
                            onClick={() => setBannerOverlayFade(!bannerOverlayFade)}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                              !bannerOverlayFade
                                ? "bg-orange-500/10 border-orange-500/20 text-[#FC7A00]"
                                : isDark ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-700"
                            )}
                          >
                            {!bannerOverlayFade ? "Fade Removed" : "Fade Active"}
                          </button>
                        </div>

                        {/* Slider interval */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Slideshow Interval (Seconds)</label>
                          <input
                            type="number"
                            min={1}
                            max={60}
                            value={bannerSlideInterval}
                            onChange={(e) => setBannerSlideInterval(Math.max(1, parseInt(e.target.value) || 1))}
                            className={inputClass}
                          />
                        </div>

                        {/* Border Toggle */}
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Remove Border</span>
                          <button
                            type="button"
                            onClick={() => setBannerBorderEnabled(!bannerBorderEnabled)}
                            className={cn(
                              "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                              !bannerBorderEnabled
                                ? "bg-orange-500/10 border-orange-500/20 text-[#FC7A00]"
                                : isDark ? "bg-gray-800 border-gray-700 text-gray-400" : "bg-gray-100 border-gray-200 text-gray-700"
                            )}
                          >
                            {!bannerBorderEnabled ? "Border Removed" : "Border Active"}
                          </button>
                        </div>

                        {/* Border Color */}
                        {bannerBorderEnabled && (
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Border Color Hex</label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="#e5e7eb"
                                value={bannerBorderColor}
                                onChange={(e) => setBannerBorderColor(e.target.value)}
                                className={inputClass}
                              />
                              <input
                                type="color"
                                value={bannerBorderColor.startsWith("#") ? bannerBorderColor : "#e5e7eb"}
                                onChange={(e) => setBannerBorderColor(e.target.value)}
                                className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 overflow-hidden shrink-0"
                              />
                            </div>
                          </div>
                        )}

                        {/* Background Color */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Background Color Hex</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="#111827"
                              value={bannerBackgroundColor}
                              onChange={(e) => setBannerBackgroundColor(e.target.value)}
                              className={inputClass}
                            />
                            <input
                              type="color"
                              value={bannerBackgroundColor.startsWith("#") ? bannerBackgroundColor : "#111827"}
                              onChange={(e) => setBannerBackgroundColor(e.target.value)}
                              className="w-10 h-10 rounded-xl cursor-pointer border-0 p-0 overflow-hidden shrink-0"
                            />
                          </div>
                        </div>

                        {/* Slide Effect */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Slide Transition Effect</label>
                          <select
                            value={bannerSlideEffect}
                            onChange={(e) => setBannerSlideEffect(e.target.value as "fade" | "slide")}
                            className={cn(inputClass, "cursor-pointer font-bold")}
                          >
                            <option value="fade">Seamless Cross-Fade (No Blinking)</option>
                            <option value="slide">Smooth Slide-In (Right-to-Left)</option>
                          </select>
                        </div>

                        {/* Crop Height Mobile */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Mobile Height (px)</label>
                          <input
                            type="number"
                            min={80}
                            max={400}
                            value={bannerHeightMobile}
                            onChange={(e) => setBannerHeightMobile(Math.max(80, parseInt(e.target.value) || 120))}
                            className={inputClass}
                          />
                        </div>

                        {/* Crop Height Desktop */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Desktop Height (px)</label>
                          <input
                            type="number"
                            min={100}
                            max={600}
                            value={bannerHeightDesktop}
                            onChange={(e) => setBannerHeightDesktop(Math.max(100, parseInt(e.target.value) || 200))}
                            className={inputClass}
                          />
                        </div>

                        {/* Crop Align position */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Image Crop Alignment (Position)</label>
                          <select
                            value={bannerImagePosition}
                            onChange={(e) => setBannerImagePosition(e.target.value)}
                            className={cn(inputClass, "cursor-pointer font-bold")}
                          >
                            <option value="center">Center</option>
                            <option value="top">Top</option>
                            <option value="bottom">Bottom</option>
                            <option value="left">Left</option>
                            <option value="right">Right</option>
                          </select>
                        </div>

                        {/* Image Size Mode (Contain vs Cover) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Image Size Mode</label>
                          <select
                            value={bannerImageMode}
                            onChange={(e) => setBannerImageMode(e.target.value as "cover" | "contain")}
                            className={cn(inputClass, "cursor-pointer font-bold")}
                          >
                            <option value="cover">Crop to Screen Size (Cover - Adjust Height/Alignment above)</option>
                            <option value="contain">Keep Image Aspect Ratio (Don&apos;t Cut Off)</option>
                          </select>
                          <p className="text-[9px] text-gray-400 font-semibold leading-relaxed">
                            Selecting &quot;Keep Image Aspect Ratio&quot; ensures the full image is rendered in the screen size without any cutoffs or zooming.
                          </p>
                        </div>

                        {/* Transfer Drawer Position Selector */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Transfer Drawer Banner Location</label>
                          <select
                            value={bannerTransferPosition}
                            onChange={(e) => setBannerTransferPosition(e.target.value as "top" | "bottom")}
                            className={cn(inputClass, "cursor-pointer font-bold")}
                          >
                            <option value="top">Top of Transfer Drawer</option>
                            <option value="bottom">Bottom of Transfer Drawer</option>
                          </select>
                        </div>

                        <button
                          type="submit"
                          disabled={isSavingDisplaySettings}
                          className="w-full py-3 bg-black hover:brightness-110 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingDisplaySettings ? <ButtonSpinner /> : "Save Display Settings"}
                        </button>
                      </form>
                    </div>

                    <div className={cn("rounded-2xl p-5 border transition-all shadow-none", panelClass)}>
                      <div className="border-b pb-3 mb-4 flex items-center gap-2" style={{ borderColor: isDark ? "#1f2937" : "#f3f4f6" }}>
                        <span className="material-symbols-outlined text-orange-500 text-[20px]">add_photo_alternate</span>
                        <h3 className="font-black text-xs uppercase tracking-wider">Add Banner Slide</h3>
                      </div>

                      <form onSubmit={handleAddBanner} className="space-y-4">
                        {/* Image input with ImgBB upload helper */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Slide Image Url <span className="text-red-500">*</span></label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              required
                              placeholder="https://..."
                              value={bannerImageUrl}
                              onChange={(e) => setBannerImageUrl(e.target.value)}
                              className={inputClass}
                            />
                            <div className="relative">
                              <input
                                type="file"
                                accept="image/*"
                                onChange={handleBannerFileUpload}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                                disabled={isUploadingBanner}
                              />
                              <button
                                type="button"
                                disabled={isUploadingBanner}
                                className={cn("px-3 h-[42px] border rounded-xl flex items-center justify-center transition-all", isDark ? "bg-gray-850 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-700")}
                              >
                                {isUploadingBanner ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Title */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Caption Title</label>
                          <input
                            type="text"
                            placeholder="e.g. Cheap MTN SME Plans!"
                            value={bannerTitle}
                            onChange={(e) => setBannerTitle(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        {/* Description */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Description Caption</label>
                          <textarea
                            placeholder="e.g. Get 1GB for as low as ₦250..."
                            value={bannerDescription}
                            onChange={(e) => setBannerDescription(e.target.value)}
                            className={cn(inputClass, "h-16 resize-none")}
                          />
                        </div>

                        {/* Target Page */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Target Screen Location</label>
                          <select
                            value={bannerTargetPage}
                            onChange={(e) => setBannerTargetPage(e.target.value as any)}
                            className={cn(inputClass, "cursor-pointer font-bold")}
                          >
                            <option value="all">All Pages (Carousel Loop)</option>
                            <option value="bills">Bills / Utility Page</option>
                            <option value="investment">Investment Page</option>
                            <option value="referral">Referral Page</option>
                            <option value="transfer">Secure Transfer Drawer</option>
                          </select>
                        </div>

                        {/* Action Link */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Action Redirect URL</label>
                          <input
                            type="text"
                            placeholder="e.g. /bills, /referrals, or external link"
                            value={bannerLink}
                            onChange={(e) => setBannerLink(e.target.value)}
                            className={inputClass}
                          />
                        </div>

                        {/* Thumbnail Preview */}
                        {bannerImageUrl && (
                          <div className="p-3 bg-black/10 border border-gray-150 rounded-2xl overflow-hidden relative">
                            <p className="text-[9px] font-black uppercase text-gray-400 mb-1">Slide Preview</p>
                            <div className="aspect-[3/1] rounded-lg overflow-hidden border bg-white relative">
                              <img src={bannerImageUrl} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                          </div>
                        )}

                        <button
                          type="submit"
                          disabled={isSavingBanner || isUploadingBanner}
                          className="w-full py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer"
                        >
                          {isSavingBanner ? <ButtonSpinner /> : "Deploy Banner Slide"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Active Banner Slides List */}
                  <div className="lg:col-span-2">
                    <div className={cn("rounded-2xl p-5 border transition-all shadow-none h-full", panelClass)}>
                      <div className="border-b pb-3 mb-4 flex items-center justify-between" style={{ borderColor: isDark ? "#1f2937" : "#f3f4f6" }}>
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-orange-500 text-[20px]">view_carousel</span>
                          <h3 className="font-black text-xs uppercase tracking-wider">Active Slides ({banners.length})</h3>
                        </div>
                        <button
                          onClick={fetchBanners}
                          className={cn("p-1.5 border rounded-lg transition-all", isDark ? "border-gray-800 hover:bg-gray-800" : "border-gray-250 hover:bg-gray-50")}
                        >
                          <span className="material-symbols-outlined text-[16px] font-bold block">refresh</span>
                        </button>
                      </div>

                      {isLoadingBanners ? (
                        <div className="text-center py-20 text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                          <ButtonSpinner /> Loading Slide Banners...
                        </div>
                      ) : banners.length === 0 ? (
                        <div className="text-center py-20 border border-dashed rounded-2xl flex flex-col items-center justify-center p-6 space-y-3" style={{ borderColor: isDark ? "#1f2937" : "#d1d5db" }}>
                          <span className="material-symbols-outlined text-[36px] text-gray-400">landscape</span>
                          <p className="text-xs uppercase font-black text-gray-400">No Banners Deployed</p>
                          <p className="text-[11px] text-gray-500 font-semibold max-w-sm mx-auto leading-relaxed">
                            Use the form on the left to upload or attach banner image slides. These will display in real-time as a responsive slideshow for end-users.
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {banners.map((b) => (
                            <div key={b.id} className={cn("p-4 border rounded-2xl flex flex-col md:flex-row gap-4 items-start md:items-center justify-between transition-all", isDark ? "border-gray-800 bg-gray-900/40 hover:bg-gray-850/30" : "border-gray-150 bg-gray-50/50 hover:bg-gray-100/30")}>
                              {/* Thumbnail & Specs */}
                              <div className="flex gap-4 flex-1 items-start min-w-0">
                                <div className="w-24 h-12 rounded-lg border bg-white overflow-hidden flex-shrink-0">
                                  <img src={b.imageUrl} alt="Slide Thumbnail" className="w-full h-full object-cover" />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <h4 className="font-extrabold text-xs uppercase tracking-tight text-orange-500 leading-tight select-all truncate">{b.title || "Untitled Slide"}</h4>
                                  <p className={cn("text-[10px] font-medium leading-relaxed truncate mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>{b.description || "No text description."}</p>
                                  <div className="flex flex-wrap gap-2 mt-2">
                                    <span className={cn(
                                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                                      b.targetPage === "all" && "bg-orange-500/10 border-orange-500/20 text-[#FC7A00]",
                                      b.targetPage === "bills" && "bg-indigo-500/10 border-indigo-500/20 text-indigo-500",
                                      b.targetPage === "investment" && "bg-emerald-500/10 border-emerald-500/20 text-emerald-500",
                                      b.targetPage === "referral" && "bg-teal-500/10 border-teal-500/20 text-teal-500",
                                      b.targetPage === "transfer" && "bg-blue-500/10 border-blue-500/20 text-blue-500"
                                    )}>
                                      Page: {b.targetPage}
                                    </span>
                                    {b.link && (
                                      <span className={cn("px-2 py-0.5 rounded text-[8px] font-mono border max-w-[150px] truncate", isDark ? "bg-gray-850 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-600")}>
                                        Url: {b.link}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Delete trigger */}
                              <button
                                onClick={() => handleDeleteBanner(b.id)}
                                className={cn("px-3.5 h-10 rounded-xl font-bold text-xs uppercase border tracking-wider transition-all flex items-center gap-1.5 cursor-pointer", isDark ? "bg-gray-850 border-gray-700 text-red-400 hover:bg-red-500/10 hover:border-red-500/30" : "bg-white border-gray-200 text-red-600 hover:bg-red-50 hover:border-red-100")}
                              >
                                <span className="material-symbols-outlined text-[16px]">delete</span>
                                <span>Remove</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Tab 7: Secure Fixed Deposits Auditing Panel */}
            {activeTab === "investments" && (
              <motion.div
                key="investments-view"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 animate-fadeIn"
              >
                {/* Metrics overview widgets inside Cpanel tab */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Active Savings</p>
                    <p className="font-mono text-xl font-black text-emerald-500 mt-1 leading-none">
                      ₦{fdList.filter(f => f.status === "ACTIVE").reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2">Active Accumulation</p>
                  </div>

                  <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Settled / Credited</p>
                    <p className="font-mono text-xl font-black text-blue-500 mt-1 leading-none">
                      ₦{fdList.filter(f => f.status === "SETTLED" || f.status === "CLAIMED").reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2">Accrued Disbursements</p>
                  </div>

                  <div className={cn("p-5 rounded-2xl border transition-colors duration-300", panelClass)}>
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Ledger Audits</p>
                    <p className="font-mono text-xl font-black text-[#FC7A00] mt-1 leading-none">
                      {fdList.length}
                    </p>
                    <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider mt-2">Placements Count</p>
                  </div>
                </div>

                <div className={cn("rounded-2xl p-6 border transition-colors duration-300 space-y-4", panelClass)}>
                  <div className="border-b pb-3 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h4 className="text-xs font-black uppercase text-[#FC7A00] tracking-wider">User Fixed Deposits Directory</h4>
                      <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5">Audit active placements and settled payouts</p>
                    </div>

                    <button
                      type="button"
                      disabled={isLoadingFd}
                      onClick={fetchGlobalInvestments}
                      className={cn(
                        "px-3 py-1.5 border hover:border-[#FC7A00] text-[10px] font-bold uppercase rounded-xl cursor-pointer transition-all",
                        isDark ? "border-gray-700 text-gray-400" : "border-gray-200 text-gray-600"
                      )}
                    >
                      {isLoadingFd ? "Syncing..." : "Force Sync Queue"}
                    </button>
                  </div>

                  <div className="overflow-x-auto pr-1">
                    {isLoadingFd ? (
                      <div className="text-center py-16 text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse">
                        <ButtonSpinner /> Auditing system savings records...
                      </div>
                    ) : fdList.length === 0 ? (
                      <div className="text-center py-12 text-gray-500 uppercase font-black text-xs">
                        There are currently no waiting or active placements in the database.
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-gray-250 dark:border-gray-800 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                            <th className="pb-3 pl-2">User Details</th>
                            <th className="pb-3 text-right">Principal</th>
                            <th className="pb-3 text-center">Rate</th>
                            <th className="pb-3 text-right">Yield</th>
                            <th className="pb-3 text-center">Status</th>
                            <th className="pb-3 text-center">Created / Maturity</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-150 dark:divide-gray-850">
                          {fdList.map((inv) => {
                            const estYield = inv.amount * (Number(inv.interestRate) / 100);
                            const isActive = inv.status === "ACTIVE";

                            return (
                              <tr key={inv.id} className="hover:bg-gray-50/40 dark:hover:bg-gray-900/10">
                                <td className="py-3">
                                  <p className="font-extrabold text-xs">{inv.userName || "System User"}</p>
                                  <p className="text-[10px] text-gray-400 mt-0.5">{inv.userEmail}</p>
                                  <p className="text-[9px] font-mono text-gray-500">{inv.userPhone}</p>
                                </td>
                                <td className="py-3 text-right font-mono font-bold text-xs">
                                  ₦{inv.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 text-center font-mono font-black text-[#FC7A00]">
                                  {inv.interestRate}%
                                </td>
                                <td className="py-3 text-right font-mono font-extrabold text-emerald-500">
                                  +₦{estYield.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </td>
                                <td className="py-3 text-center">
                                  <span className={cn(
                                    "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                    isActive
                                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                      : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                  )}>
                                    {inv.status}
                                  </span>
                                </td>
                                <td className="py-3 text-center">
                                  <p className="text-[9px] font-semibold text-gray-400">Created: {new Date(inv.createdAt).toLocaleDateString()}</p>
                                  <p className="text-[9px] font-extrabold text-[#FC7A00] mt-0.5">Matures: {new Date(inv.maturesAt).toLocaleDateString()}</p>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Lock Drawer Footer (Isolated with flat button and absolutely no shadows) */}
      <footer className={cn("md:hidden fixed bottom-0 left-0 right-0 p-4 border-t z-30 transition-colors duration-300", isDark ? "bg-gray-900 border-gray-850" : "bg-white border-gray-100")}>
        <button
          onClick={() => setShowLockConfirm(true)}
          className={cn(
            "w-full py-3 border rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-center",
            isDark
              ? "bg-gray-800 hover:bg-red-950/20 hover:text-red-400 border-gray-700 text-gray-400"
              : "bg-gray-50 hover:bg-red-50 hover:text-red-600 border-gray-200 text-gray-500"
          )}
        >
          Lock Admin Console Session
        </button>
      </footer>

      {/* Premium Glassmorphic Lock Console Confirmation Modal */}
      <AnimatePresence>
        {showLockConfirm && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowLockConfirm(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999]"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 max-w-sm md:w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[32px] p-6 text-center shadow-2xl z-[100000] font-hanken"
            >
              {/* Animated Danger Badge */}
              <div className="w-14 h-14 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>lock_reset</span>
              </div>

              <h4 className="font-extrabold text-base text-gray-900 dark:text-white leading-tight">
                Lock Console Session?
              </h4>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-2 font-medium leading-relaxed">
                Are you sure you want to lock the administrative console session? This will immediately secure all system configurations and log out your active session.
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowLockConfirm(false)}
                  className="py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    setShowLockConfirm(false);
                    try {
                      await fetch("/api/admin/auth/logout", { method: "POST" });
                    } catch (err) {
                      console.error("Logout API call failed:", err);
                    }
                    setIsAdminUnlocked(false);
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("admin_session_unlocked");
                    }
                    toast.info("Console session locked.");
                  }}
                  className="py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:brightness-105 transition-all cursor-pointer active:scale-95"
                >
                  Yes, Lock
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Dedicated Visual Administrative Action Confirmation Model */}
      <AnimatePresence>
        {adminActionModal.isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setAdminActionModal(prev => ({ ...prev, isOpen: false }))}
              className="fixed inset-0 bg-black/60 backdrop-blur-md z-[99999]"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2 max-w-sm md:w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-[32px] p-6 text-center shadow-2xl z-[100000] font-hanken"
            >
              {/* Dynamic Status Badge */}
              <div className={cn(
                "w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse border",
                adminActionModal.actionStyle === "danger" && "bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900/30 text-red-500",
                adminActionModal.actionStyle === "warning" && "bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900/30 text-amber-500",
                adminActionModal.actionStyle === "success" && "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-100 dark:border-emerald-900/30 text-emerald-500",
                adminActionModal.actionStyle === "info" && "bg-blue-50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 text-blue-500"
              )}>
                <span className="material-symbols-outlined text-[28px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                  {adminActionModal.actionStyle === "danger" && "gpp_maybe"}
                  {adminActionModal.actionStyle === "warning" && "warning"}
                  {adminActionModal.actionStyle === "success" && "verified_user"}
                  {adminActionModal.actionStyle === "info" && "info"}
                </span>
              </div>

              <h4 className="font-extrabold text-base text-gray-900 dark:text-white leading-tight uppercase tracking-tight">
                {adminActionModal.title}
              </h4>
              <p className="text-[11.5px] text-gray-500 dark:text-gray-400 mt-2.5 font-semibold leading-relaxed">
                {adminActionModal.message}
              </p>

              <div className="grid grid-cols-2 gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setAdminActionModal(prev => ({ ...prev, isOpen: false }))}
                  className="py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAdminActionModal(prev => ({ ...prev, isOpen: false }));
                    adminActionModal.onConfirm();
                  }}
                  className={cn(
                    "py-3 text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer active:scale-95",
                    adminActionModal.actionStyle === "danger" && "bg-gradient-to-r from-red-500 to-red-600 hover:brightness-105",
                    adminActionModal.actionStyle === "warning" && "bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-105",
                    adminActionModal.actionStyle === "success" && "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-105",
                    adminActionModal.actionStyle === "info" && "bg-gradient-to-r from-blue-500 to-blue-600 hover:brightness-105"
                  )}
                >
                  {adminActionModal.actionLabel}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </main>
  );
}
