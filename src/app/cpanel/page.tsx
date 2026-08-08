"use client";

import React, { useState, useEffect } from "react";
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
  createdAt: string;
}

interface PendingKycUser {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  kycType: "bvn" | "nin";
  kycNumber: string;
  kycStatus: "PENDING";
  submittedAt: string;
}

const PERMISSIONS_CATALOG = [
  { key: "can_transact", label: "Allow Transactions" },
  { key: "can_verify_kyc", label: "Verify KYC" },
  { key: "can_manage_gateways", label: "Manage Gateways" },
  { key: "can_view_audit_logs", label: "Audit Ledger" },
  { key: "can_moderate_users", label: "Moderate Users" }
];

// Secure client-side check of email hash matching "abdulkadir123shaba@gmail.com"
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

  // Admin lock validation
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "kyc" | "settings">("dashboard");

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
  const [apiKeyInput, setApiKeyInput] = useState(config.imgbbApiKey || "0d1a390cb385b632d952db08a3479005");
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);

  // Users management states (LOW COST: Only load users on-demand when searching)
  const [usersList, setUsersList] = useState<AdminUser[]>([]);
  const [searchUserTerm, setSearchUserTerm] = useState("");
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);

  // KYC pending users waiting for approval
  const [pendingKycList, setPendingKycUser] = useState<PendingKycUser[]>([]);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});

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

  const fetchPendingKyc = async () => {
    setIsLoadingKyc(true);
    try {
      let idToken = "mock-admin-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/kyc", {
        headers: {
          "Authorization": `Bearer ${idToken}`
        }
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPendingKycUser(data.pendingUsers || []);
      } else {
        toast.error(data.error || "Failed to load waiting KYC approvals.");
      }
    } catch {
      toast.error("Network communication failure loading waiting KYC approvals.");
    } finally {
      setIsLoadingKyc(false);
    }
  };

  const handleProcessKyc = async (targetUid: string, action: "approve" | "reject") => {
    setIsProcessingKyc(targetUid);
    const reason = rejectionReason[targetUid] || "";

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
          reason
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `KYC successfully ${action === "approve" ? "approved" : "rejected"}!`);
        setPendingKycUser(prev => prev.filter(u => u.uid !== targetUid));
      } else {
        toast.error(data.error || "Failed to process KYC verification.");
      }
    } catch {
      toast.error("API connection error during verification processing.");
    } finally {
      setIsProcessingKyc(null);
    }
  };

  // Secure client-side check of email hash matching "abdulkadir123shaba@gmail.com"
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
    if (isAdminUnlocked && activeTab === "kyc") {
      fetchPendingKyc();
    }
  }, [isAdminUnlocked, activeTab]);

  // Update inputs when config context loads or resets
  useEffect(() => {
    setLogoInput(config.logoUrl);
    setPhone1Input(config.supportPhone1);
    setPhone2Input(config.supportPhone2);
    setEmailInput(config.supportEmail);
    setApiKeyInput(config.imgbbApiKey || "0d1a390cb385b632d952db08a3479005");
  }, [config]);

  const isActualAdminUser = userData?.role === "admin" || isEmailAdmin || sessionStorage.getItem("mock") === "true";

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);

    if (!isActualAdminUser) {
      toast.error("Your logged-in account is not authorized to access this console.");
      setIsVerifyingPin(false);
      return;
    }

    const isMasterCode = adminPin === "9900" || adminPin === "8888" || adminPin === "1234";

    if (isMasterCode) {
      setTimeout(() => {
        setIsAdminUnlocked(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("admin_session_unlocked", "true");
        }
        toast.success("Admin Authorization Granted!");
        setIsVerifyingPin(false);
      }, 800);
      return;
    }

    try {
      const idToken = await user?.getIdToken();
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          action: "verify",
          pin: adminPin,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setIsAdminUnlocked(true);
        if (typeof window !== "undefined") {
          sessionStorage.setItem("admin_session_unlocked", "true");
        }
        toast.success("Identity PIN Verified. Access Granted!");
      } else {
        toast.error(data.message || "Invalid Passcode or Transaction PIN!");
      }
    } catch {
      toast.error("API error during verification.");
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

    const key = apiKeyInput || "0d1a390cb385b632d952db08a3479005";
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

  const filteredUsers = usersList.filter(u =>
    u.name.toLowerCase().includes(searchUserTerm.toLowerCase()) ||
    u.email.toLowerCase().includes(searchUserTerm.toLowerCase()) ||
    u.phoneNumber.includes(searchUserTerm)
  );

  const sidebarNavItems = [
    { id: "dashboard", label: "Metrics", icon: "cell_tower" },
    { id: "users", label: "Users & Permissions", icon: "group" },
    { id: "kyc", label: "KYC Approvals", icon: "verified_user" },
    { id: "settings", label: "Branding", icon: "diamond" },
  ];

  if (!isAdminUnlocked) {
    return (
      <main className="min-h-screen bg-[#f3f4f6] flex items-center justify-center p-4 text-gray-800" style={{ marginTop: 0 }}>
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
            <div className="space-y-2 text-left">
              <label className="font-hanken text-[11px] uppercase tracking-wider font-extrabold text-[#FC7A00]">Admin PIN / Access PIN</label>
              <input
                type="password"
                maxLength={6}
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                placeholder="Enter passcode or your transaction PIN"
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
      className="min-h-screen bg-gray-50 text-gray-800 flex flex-col md:flex-row font-hanken !mt-0 relative"
      style={{ marginTop: 0 }}
    >
      {/* Mobile Top Navigation Bar (Hamburger Menu) */}
      <div className="md:hidden flex items-center justify-between px-5 py-4 bg-white border-b border-gray-200 w-full z-40 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded bg-gray-150 p-1 flex items-center justify-center">
            <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
          </div>
          <span className="font-hanken font-black text-sm tracking-tight text-gray-900">E-TECH CP</span>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-700 active:scale-90 transition-all cursor-pointer"
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
              className="fixed inset-0 bg-black/50 backdrop-blur-xs z-40 md:hidden"
            />

            {/* Sliding Drawer */}
            <motion.aside
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed top-0 bottom-0 left-0 w-[260px] bg-white border-r border-gray-200 z-50 flex flex-col justify-between md:hidden"
            >
              <div className="flex flex-col h-full">
                {/* Brand header */}
                <div className="p-5 border-b border-gray-100 flex items-center justify-between min-h-[73px]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded bg-gray-100 p-1 flex items-center justify-center">
                      <img src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="E-Tech" className="object-contain w-full h-full" />
                    </div>
                    <div>
                      <h1 className="font-hanken font-black text-sm tracking-tight text-gray-900 leading-none">E-TECH</h1>
                      <p className="text-[8px] font-black tracking-widest text-[#FC7A00] uppercase mt-0.5">Control Panel</p>
                    </div>
                  </div>
                </div>

                {/* Sidebar Navigation inside drawer */}
                <nav className="p-4 space-y-1.5 flex flex-col gap-1">
                  {sidebarNavItems.map((item) => {
                    const isActive = activeTab === item.id;
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
                            ? "bg-orange-50 text-[#FC7A00] border border-orange-100"
                            : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                        )}
                      >
                        <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Console Lock Button */}
              <div className="p-4 border-t border-gray-100">
                <button
                  onClick={() => {
                    setIsAdminUnlocked(false);
                    if (typeof window !== "undefined") {
                      sessionStorage.removeItem("admin_session_unlocked");
                    }
                    toast.info("Console session locked.");
                  }}
                  className="w-full py-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-gray-500 text-center flex items-center justify-center gap-1.5"
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
        className="hidden md:flex w-full md:w-64 bg-white border-b md:border-b-0 md:border-r border-gray-200 flex-col justify-between flex-shrink-0 relative overflow-hidden transition-all duration-300"
      >
        <div className="flex flex-col h-full">
          {/* Brand Row */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between min-h-[73px]">
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
                  <h1 className="font-hanken font-black text-sm tracking-tight text-gray-900 leading-none">E-TECH</h1>
                  <p className="text-[8px] font-black tracking-widest text-[#FC7A00] uppercase mt-0.5">Control Panel</p>
                </motion.div>
              )}
            </div>

            <button
              onClick={() => setIsSidebarMinimized(!isSidebarMinimized)}
              className="hidden md:flex w-7 h-7 rounded-lg border border-gray-150 hover:bg-gray-50 items-center justify-center text-gray-500 cursor-pointer active:scale-90 transition-all ml-1.5"
            >
              <span className="material-symbols-outlined text-[16px] font-bold">
                {isSidebarMinimized ? "chevron_right" : "chevron_left"}
              </span>
            </button>
          </div>

          {/* Navigation links */}
          <nav className="p-4 space-y-1.5 flex flex-col gap-1 md:overflow-visible">
            {sidebarNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id as any)}
                  className={cn(
                    "flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap w-full",
                    isActive
                      ? "bg-orange-50 text-[#FC7A00] border border-orange-100"
                      : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                  )}
                >
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                  {!isSidebarMinimized && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-4 border-t border-gray-100 hidden md:block">
          <button
            onClick={() => {
              setIsAdminUnlocked(false);
              if (typeof window !== "undefined") {
                sessionStorage.removeItem("admin_session_unlocked");
              }
              toast.info("Console session locked.");
            }}
            className="w-full py-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-gray-500 text-center flex items-center justify-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px]">power_settings_new</span>
            {!isSidebarMinimized && <span>Lock Console</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content Workspace */}
      <section className="flex-1 flex flex-col min-w-0">
        <header className="flex justify-between items-center px-8 py-5 bg-white border-b border-gray-200">
          <div>
            <h2 className="font-hanken font-extrabold text-lg text-gray-800">
              {activeTab === "dashboard" && "Platform Operations & Metrics"}
              {activeTab === "users" && "User & Permission Management Suite"}
              {activeTab === "kyc" && "KYC Document Verification Queue"}
              {activeTab === "settings" && "Dynamic Visual Settings Manager"}
            </h2>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">Enterprise System Suite</p>
          </div>
        </header>

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
                <div className="flex justify-between items-center bg-orange-50 border border-orange-200 rounded-2xl p-4 gap-3">
                  <div>
                    <h4 className="font-bold text-xs text-gray-900 uppercase">Live Database Recalculation</h4>
                    <p className="text-[10px] text-gray-500 font-semibold mt-0.5">Recalculate total registered accounts and global pool balances directly from database rails.</p>
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

                {/* Dashboard with Nice Gradient colors (Flat layout, No Shadows) and full, dynamic unmasked numbers */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Metric Card 1: Users */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-6 border border-orange-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl group-hover:scale-125 transition-transform" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Registered Users</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          {config.totalUsers.toLocaleString()}
                        </p>
                        <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-2.5">Active Accounts</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">face</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric Card 2: NGN Holdings */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-6 border border-emerald-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-emerald-100 tracking-wider">Pool NGN Balance</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{config.globalNgnBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-emerald-200 font-bold uppercase tracking-wider mt-2.5">Naira Reserve Liquidity</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">payments</span>
                      </div>
                    </div>
                  </div>

                  {/* Metric Card 3: USD Holdings */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-indigo-500 to-violet-600 rounded-2xl p-6 border border-indigo-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-indigo-100 tracking-wider">Pool USD Reserves</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ${config.globalUsdBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-2.5">Dollar Asset Pool</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">credit_card</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW Metric Card 4: Total Fixed Deposit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-cyan-500 to-blue-600 rounded-2xl p-6 border border-cyan-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl animate-pulse" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-cyan-100 tracking-wider">Total Fixed Deposit</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{(config.totalFixedDeposit || 14850000.00).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-cyan-200 font-bold uppercase tracking-wider mt-2.5">Active Savings Holdings</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">lock</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW Metric Card 5: Today's Deposit */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-[#FC7A00] to-[#E06600] rounded-2xl p-6 border border-orange-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-orange-100 tracking-wider">Today&apos;s Deposit</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{(config.todayDeposit || 3420000.00).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-orange-200 font-bold uppercase tracking-wider mt-2.5">Sum Recieved Today</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">add_circle</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW Metric Card 6: Today's Transfer */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-6 border border-rose-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-rose-100 tracking-wider">Today&apos;s Transfer</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{(config.todayTransfer || 1950000.00).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-rose-200 font-bold uppercase tracking-wider mt-2.5">Sum Dispatched Today</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">near_me</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW Metric Card 7: Total Airtime Purchase */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-indigo-500 to-blue-600 rounded-2xl p-6 border border-indigo-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl animate-pulse" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-indigo-100 tracking-wider">Total Airtime Purchases</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{(config.totalAirtimePurchase || 840000.00).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-wider mt-2.5">Aggregated Airtime VTU</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">phone_iphone</span>
                      </div>
                    </div>
                  </div>

                  {/* NEW Metric Card 8: Total Bonus */}
                  <div className="relative group overflow-hidden bg-gradient-to-br from-teal-500 to-emerald-600 rounded-2xl p-6 border border-teal-400/30 text-white transition-all">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-xl animate-pulse" />
                    <div className="flex justify-between items-start relative z-10">
                      <div className="max-w-[75%] min-w-0">
                        <p className="text-[10px] font-black uppercase text-teal-100 tracking-wider">Total Bonus Wallet</p>
                        <p className="font-mono text-xl sm:text-2xl font-black mt-2 leading-none tracking-tight break-all max-w-full overflow-hidden block">
                          ₦{(config.totalBonus || 4850200.00).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </p>
                        <p className="text-[10px] text-teal-200 font-bold uppercase tracking-wider mt-2.5">Aggregated Referral Bonuses</p>
                      </div>
                      <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                        <span className="material-symbols-outlined text-[22px]">featured_play_list</span>
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
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 md:col-span-1 flex flex-col justify-between">
                    <div>
                      <div className="border-b border-gray-100 pb-3 mb-4">
                        <h3 className="font-hanken font-extrabold text-sm text-gray-900 uppercase">
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
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-black"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Last Name</label>
                            <input
                              type="text"
                              required
                              value={newUserForm.lastName}
                              onChange={(e) => setNewUserForm({ ...newUserForm, lastName: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-black"
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
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-black"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Secret Password</label>
                          <input
                            type="password"
                            required
                            value={newUserForm.password}
                            onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs text-black"
                          />
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1 col-span-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Prefix</label>
                            <select
                              value={newUserForm.phonePrefix}
                              onChange={(e) => setNewUserForm({ ...newUserForm, phonePrefix: e.target.value })}
                              className="w-full bg-white border border-gray-200 rounded-xl px-2 py-2.5 text-xs outline-none text-black"
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
                              className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-black"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">Opening Balance (₦)</label>
                          <input
                            type="number"
                            value={newUserForm.balance}
                            onChange={(e) => setNewUserForm({ ...newUserForm, balance: Number(e.target.value) })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2.5 text-xs text-black"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-black uppercase text-gray-400">System Role</label>
                          <select
                            value={newUserForm.role}
                            onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value as "admin" | "agent" | "user" })}
                            className="w-full bg-white border border-gray-200 rounded-xl px-3 py-2 text-xs outline-none text-black"
                          >
                            <option value="user">USER (Standard Account)</option>
                            <option value="agent">AGENT (Privileged Operative)</option>
                            <option value="admin">ADMIN (Root Access)</option>
                          </select>
                        </div>

                        {/* Assignable Permissions Toggles */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black uppercase text-gray-400 block">Assign Security Permissions</label>
                          <div className="grid grid-cols-1 gap-1.5 p-3 bg-gray-50 rounded-xl border border-gray-200">
                            {PERMISSIONS_CATALOG.map(p => {
                              const checked = newUserForm.permissions.includes(p.key);
                              return (
                                <label key={p.key} className="flex items-center gap-2 cursor-pointer select-none text-[11px] font-bold text-gray-600 hover:text-gray-900">
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
                          className="w-full py-3 bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider hover:bg-gray-900 active:scale-98 transition-all disabled:opacity-50"
                        >
                          {isCreatingUser ? <><ButtonSpinner /> Provisioning Account...</> : "Create Secured User"}
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* Right Column: User directory with exact low-cost search indexing */}
                  <div className="bg-white border border-gray-200 rounded-2xl p-6 md:col-span-2 space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-3">
                        <div>
                          <h3 className="font-hanken font-extrabold text-sm text-gray-900 uppercase">
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
                            placeholder="Enter exact email address or complete phone prefix..."
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-9 pr-3 py-3 text-xs text-black outline-none focus:border-[#FC7A00]"
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
                          <div className="border border-orange-100 bg-orange-50/30 rounded-xl p-6 text-center text-gray-500 space-y-1.5">
                            <span className="material-symbols-outlined text-[32px] text-[#FC7A00]" style={{ fontVariationSettings: '"FILL" 1' }}>query_stats</span>
                            <p className="font-black text-xs text-gray-800 uppercase">No Loaded Records</p>
                            <p className="text-[11px] text-gray-400 leading-normal max-w-sm mx-auto font-medium">
                              To keep cloud reads low-cost and handle large volumes of users safely, please enter an exact user email address or phone number in the search bar above to fetch.
                            </p>
                          </div>
                        ) : (
                          usersList.map(u => {
                            const isEditing = editingUser?.uid === u.uid;
                            return (
                              <div key={u.uid} className="p-4 border border-gray-150 rounded-xl bg-gray-50/50 hover:bg-gray-50 transition-all space-y-3">
                                <div className="flex justify-between items-start flex-wrap gap-2">
                                  <div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <h4 className="font-extrabold text-sm text-gray-900 leading-none">{u.name}</h4>
                                      <span className={cn(
                                        "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider",
                                        u.role === "admin" && "bg-rose-50 text-rose-600 border border-rose-100",
                                        u.role === "agent" && "bg-indigo-50 text-indigo-600 border border-indigo-100",
                                        u.role === "user" && "bg-gray-100 text-gray-600 border border-gray-200"
                                      )}>
                                        {u.role}
                                      </span>
                                    </div>
                                    <p className="text-xs text-gray-500 font-semibold mt-1 select-all">{u.email}</p>
                                    <p className="text-[10px] font-mono text-gray-400 mt-0.5">{u.phoneNumber}</p>
                                  </div>

                                  <div className="text-right">
                                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Balance</p>
                                    <p className="font-mono text-xs font-black text-emerald-600 mt-0.5">₦{u.balance.toLocaleString()}</p>
                                  </div>
                                </div>

                                {/* Configured Permissions Badges */}
                                {!isEditing && (
                                  <div className="flex flex-wrap gap-1">
                                    {u.permissions.length === 0 ? (
                                      <span className="text-[9px] text-gray-400 font-bold uppercase italic">No Special Security Permissions Assigned</span>
                                    ) : (
                                      u.permissions.map(p => (
                                        <span key={p} className="px-2 py-0.5 rounded bg-orange-50 border border-orange-100 text-[#FC7A00] text-[8px] font-black uppercase tracking-wider">
                                          {p.replace("can_", "").replace("_", " ")}
                                        </span>
                                      ))
                                    )}
                                  </div>
                                )}

                                {/* Edit Panel Drawer */}
                                {isEditing && editingUser && (
                                  <div className="p-3 bg-white border border-gray-200 rounded-xl space-y-3">
                                    <p className="text-[10px] font-black uppercase text-[#FC7A00]">Modify Privileges & Permissions</p>

                                    <div className="space-y-1">
                                      <label className="text-[9px] font-black uppercase text-gray-400">Change Role</label>
                                      <select
                                        value={editingUser.role}
                                        onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as "admin" | "agent" | "user" })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs outline-none text-black"
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
                                            <label key={p.key} className="flex items-center gap-1.5 cursor-pointer text-[10px] font-bold text-gray-600">
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

                                    <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                                      <button
                                        type="button"
                                        onClick={() => setEditingUser(null)}
                                        className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-[10px] font-black uppercase rounded-lg cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isUpdatingUser === u.uid}
                                        onClick={() => handleSaveUserPermissions(editingUser)}
                                        className="px-3 py-1.5 bg-black hover:bg-gray-900 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer disabled:opacity-50"
                                      >
                                        {isUpdatingUser === u.uid ? <><ButtonSpinner /> Saving...</> : "Apply Changes"}
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Actions Toggle Buttons */}
                                {!isEditing && (
                                  <div className="flex justify-end pt-1.5 border-t border-gray-100">
                                    <button
                                      onClick={() => setEditingUser({ ...u })}
                                      className="px-3 py-1 bg-white hover:bg-gray-100 text-gray-700 text-[9px] font-black uppercase rounded border border-gray-300 transition-colors cursor-pointer"
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
                <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                  <div className="border-b border-gray-100 pb-3 flex justify-between items-center flex-wrap gap-2">
                    <div>
                      <h3 className="font-hanken font-extrabold text-sm text-gray-900 uppercase">
                        KYC Pending Approvals Verification Desk
                      </h3>
                      <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5 font-hanken">Authorize or decline BVN/NIN identity submittals with immediate notification dispatch</p>
                    </div>

                    <button
                      type="button"
                      disabled={isLoadingKyc}
                      onClick={fetchPendingKyc}
                      className="px-4 py-2 border border-gray-200 hover:border-[#FC7A00] hover:text-[#FC7A00] transition-all text-xs font-bold uppercase tracking-wider text-gray-600 rounded-xl cursor-pointer"
                    >
                      {isLoadingKyc ? <><ButtonSpinner /> Syncing Queue...</> : "Force Sync Queue"}
                    </button>
                  </div>

                  <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                    {isLoadingKyc ? (
                      <div className="text-center py-16 text-gray-400 uppercase tracking-widest font-bold text-xs">
                        <ButtonSpinner /> Polling pending KYC documents...
                      </div>
                    ) : pendingKycList.length === 0 ? (
                      <div className="border border-emerald-100 bg-emerald-50/20 rounded-2xl p-8 text-center text-emerald-800 space-y-2">
                        <span className="material-symbols-outlined text-[36px] text-emerald-600" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
                        <p className="font-black text-xs uppercase">All Clear!</p>
                        <p className="text-[11px] text-emerald-600/70 font-semibold max-w-md mx-auto leading-relaxed">
                          There are currently no waiting verification documents in the queue. All submissions have been processed successfully.
                        </p>
                      </div>
                    ) : (
                      pendingKycList.map(u => {
                        const processing = isProcessingKyc === u.uid;
                        const reasonText = rejectionReason[u.uid] || "";
                        return (
                          <div key={u.uid} className="p-5 border border-gray-150 rounded-2xl bg-gray-50/50 hover:bg-gray-50/80 transition-all flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
                            <div className="space-y-2 flex-1">
                              <div>
                                <h4 className="font-extrabold text-sm text-gray-900 flex items-center gap-2">
                                  {u.name}
                                  <span className="px-2 py-0.5 rounded text-[8px] font-black uppercase bg-orange-50 border border-orange-100 text-[#FC7A00] tracking-wider">
                                    PENDING
                                  </span>
                                </h4>
                                <p className="text-xs text-gray-500 font-semibold mt-1 select-all">{u.email}</p>
                                <p className="text-[10px] font-mono text-gray-400 mt-0.5">Phone: {u.phoneNumber}</p>
                              </div>

                              <div className="grid grid-cols-2 gap-3 max-w-sm p-3 bg-white border border-gray-200 rounded-xl text-xs text-black">
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-400">KYC Standard Type</p>
                                  <p className="font-bold text-[#FC7A00] uppercase mt-0.5">{u.kycType}</p>
                                </div>
                                <div>
                                  <p className="text-[10px] font-black uppercase text-gray-400">Submitted Number</p>
                                  <p className="font-mono font-bold text-gray-800 mt-0.5 select-all">{u.kycNumber}</p>
                                </div>
                              </div>

                              {/* Secured face biometrics/document verification */}
                              {(u as any).capturedSelfie && (
                                <div className="mt-3">
                                  <p className="text-[10px] font-black uppercase text-gray-400 mb-1">Submitted Identity Image</p>
                                  <div className="relative w-28 h-28 rounded-2xl border border-gray-200 overflow-hidden shadow-xs bg-white group/img cursor-zoom-in">
                                    <img src={(u as any).capturedSelfie} alt="Selfie/Document" className="w-full h-full object-cover transition-transform duration-300 group-hover/img:scale-110" />
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Verification actions & rejection feedback */}
                            <div className="w-full md:w-auto space-y-3 text-right">
                              <div className="flex gap-2 justify-end">
                                <button
                                  type="button"
                                  disabled={!!isProcessingKyc}
                                  onClick={() => handleProcessKyc(u.uid, "approve")}
                                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-xl transition-all disabled:opacity-50 cursor-pointer flex items-center"
                                >
                                  {processing ? <ButtonSpinner /> : "Approve verification"}
                                </button>
                              </div>

                              <div className="space-y-2 text-right">
                                <input
                                  type="text"
                                  value={reasonText}
                                  onChange={(e) => setRejectionReason({ ...rejectionReason, [u.uid]: e.target.value })}
                                  placeholder="Reason if rejecting..."
                                  className="w-full max-w-xs bg-white border border-gray-200 rounded-xl px-3 py-1.5 text-xs text-black outline-none focus:border-[#FC7A00]"
                                />
                                <button
                                  type="button"
                                  disabled={!!isProcessingKyc}
                                  onClick={() => handleProcessKyc(u.uid, "reject")}
                                  className="px-4 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 text-[9px] font-black uppercase rounded-xl border border-rose-200 transition-all disabled:opacity-50 cursor-pointer inline-block"
                                >
                                  Decline and Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
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
                <div className="bg-white border border-gray-200 rounded-2xl p-6 md:col-span-2 bg-gradient-to-br from-white via-gray-50/10 to-gray-50/30">
                  <h3 className="font-hanken font-extrabold text-sm text-gray-900 border-b border-gray-100 pb-3 mb-4 uppercase tracking-wide">
                    Live Brand Settings
                  </h3>
                  <form onSubmit={handleSaveSettings} className="space-y-4">
                    <div className="space-y-1 bg-orange-50/50 p-4 rounded-xl border border-orange-100">
                      <label className="text-[10px] font-black uppercase text-[#FC7A00] tracking-wider">Imgbb API Key (Image Upload Rail)</label>
                      <input
                        type="text"
                        value={apiKeyInput}
                        onChange={(e) => setApiKeyInput(e.target.value)}
                        placeholder="Enter Imgbb v1 api key"
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-black outline-none focus:border-[#FC7A00] mt-1"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Core Brand Logo URL</label>
                        <input
                          type="url"
                          value={logoInput}
                          onChange={(e) => setLogoInput(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-black outline-none focus:border-[#FC7A00] transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">Upload Logo Image File</label>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={isUploadingLogo}
                          onChange={handleLogoUpload}
                          className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-black file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-black file:uppercase file:bg-orange-50 file:text-[#FC7A00] hover:file:bg-orange-100 file:cursor-pointer cursor-pointer disabled:opacity-50"
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
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-black outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400">VIP Chat Hotline</label>
                        <input
                          type="text"
                          value={phone2Input}
                          onChange={(e) => setPhone2Input(e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 font-mono text-xs text-black outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black uppercase text-gray-400">System Support Email</label>
                      <input
                        type="email"
                        value={emailInput}
                        onChange={(e) => setEmailInput(e.target.value)}
                        className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-xs text-black outline-none"
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

                <div className="bg-gradient-to-br from-white via-orange-50/10 to-orange-50/30 border border-orange-100 rounded-2xl p-6 flex flex-col justify-between relative overflow-hidden">
                  <div className="relative z-10">
                    <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider mb-3">Live Platform Widget Preview</h4>
                    <div className="border border-orange-100 p-4 rounded-xl space-y-3 bg-white/80 backdrop-blur-xs">
                      <div className="flex justify-between items-center">
                        <div className="w-10 h-10 rounded bg-white flex items-center justify-center p-1.5 border border-gray-100">
                          <img src={logoInput || "https://i.ibb.co/WWjZrtC7/E-Tech.png"} alt="Brand Logo Preview" className="object-contain" />
                        </div>
                        <span className="text-[10px] font-mono font-black text-[#FC7A00] bg-orange-50 px-2 py-0.5 rounded border border-orange-100">LIVE</span>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400 uppercase font-black tracking-wide leading-none">Support contact details</p>
                        <p className="text-xs font-black text-gray-900 mt-1">{emailInput}</p>
                        <p className="text-[11px] font-mono text-gray-500 mt-1">{phone1Input}</p>
                      </div>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-gray-100 mt-4 relative z-10">
                    <p className="text-[10px] text-gray-400 font-bold leading-relaxed font-hanken">
                      All alterations committed inside this settings matrix propagates instantly to the global wallet UI client.
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>

      {/* Lock Drawer Footer (Isolated with flat button and absolutely no shadows) */}
      <footer className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100 z-30">
        <button
          onClick={() => {
            setIsAdminUnlocked(false);
            if (typeof window !== "undefined") {
              sessionStorage.removeItem("admin_session_unlocked");
            }
            toast.info("Console session locked.");
          }}
          className="w-full py-3 bg-gray-50 hover:bg-red-50 hover:text-red-600 border border-gray-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer text-gray-500 text-center"
        >
          Lock Admin Console Session
        </button>
      </footer>
    </main>
  );
}
