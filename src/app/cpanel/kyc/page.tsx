"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function CpanelKycPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [isDark, setIsDark] = useState(false);
  const [pendingKycList, setPendingKycUser] = useState<PendingKycUser[]>([]);
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({});
  const [selectedProvider, setSelectedProvider] = useState<Record<string, "flutterwave" | "squad">>({});

  const [isLoadingKyc, setIsLoadingKyc] = useState(false);
  const [isProcessingKyc, setIsProcessingKyc] = useState<string | null>(null);

  const [kycTab, setKycTab] = useState<"pending" | "verified_today" | "unverified">("pending");
  const [kycLastDocId, setKycLastDocId] = useState("");
  const [kycHasMore, setKycHasMore] = useState(false);
  const [kycTotalCount, setKycTotalCount] = useState(0);

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
    onConfirm: () => {},
  });

  const triggerAdminConfirm = (
    title: string,
    message: string,
    actionLabel: string,
    actionStyle: "danger" | "warning" | "success" | "info",
    onConfirm: () => void
  ) => {
    setAdminActionModal({ isOpen: true, title, message, actionLabel, actionStyle, onConfirm });
  };

  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cpanel_theme");
      if (cached === "dark") {
        setIsDark(true);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("cpanel_theme", next ? "dark" : "light");
      }
      return next;
    });
  };

  const fetchPendingKyc = async (isLoadMore: boolean = false, customTab?: "pending" | "verified_today" | "unverified") => {
    setIsLoadingKyc(true);
    const activeTabToFetch = customTab || kycTab;
    const lastDocIdToFetch = isLoadMore ? kycLastDocId : "";

    try {
      let idToken = "mock-admin-token";
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch(`/api/admin/kyc?tab=${activeTabToFetch}&limit=10&lastDocId=${lastDocIdToFetch}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        if (isLoadMore) {
          setPendingKycUser((prev) => [...prev, ...(data.pendingUsers || [])]);
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

  useEffect(() => {
    fetchPendingKyc(false, kycTab);
  }, [kycTab]);

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
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/kyc", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action, targetUid, reason, provider }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `KYC successfully processed!`);
        if (action === "approve" || action === "retry") {
          setPendingKycUser((prev) => prev.filter((u) => u.uid !== targetUid));
        } else if (action === "verify") {
          setPendingKycUser((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, kycStatus: "IDENTITY_VERIFIED" as any } : u)));
        } else if (action === "reject") {
          setPendingKycUser((prev) => prev.map((u) => (u.uid === targetUid ? { ...u, kycStatus: "REJECTED" as any } : u)));
        }
      } else {
        toast.error(data.error || "Failed to process KYC verification.");
      }
    } catch {
      toast.error("API connection error during verification processing.");
    } finally {
      setIsProcessingKyc(null);
    }
  };

  const handleDeleteUnverifiedUser = async (targetUid: string, name: string) => {
    triggerAdminConfirm(
      "Purge User Profile?",
      `Are you absolutely sure you want to permanently delete unverified user "${name.toUpperCase()}"? This action is IRREVERSIBLE.`,
      "Delete Permanently",
      "danger",
      async () => {
        toast.loading("Purging unverified user from server databases...");
        try {
          let idToken = "mock-admin-token";
          const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
          if (!isMock && user) {
            idToken = await user.getIdToken();
          }

          const res = await fetch("/api/admin/kyc", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${idToken}`,
            },
            body: JSON.stringify({ action: "delete_unverified", targetUid }),
          });

          const data = await res.json();
          toast.dismiss();
          if (res.ok && data.success) {
            toast.success(data.message || "User profile permanently deleted.");
            setPendingKycUser((prev) => prev.filter((u) => u.uid !== targetUid));
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

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark ? "bg-[#131927] border-gray-800" : "bg-white border-gray-200 shadow-sm";
  const inputClass = isDark
    ? "bg-gray-900/80 border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] rounded-xl px-3 py-2 text-xs outline-none transition-all w-full"
    : "bg-white border border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00] rounded-xl px-3 py-2 text-xs outline-none transition-all w-full";
  const labelClass = isDark ? "text-gray-300" : "text-gray-900";

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">verified_user</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">KYC Document Verification Queue</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Review customer BVN/NIN identity verification documents and provision virtual banking accounts.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={cn("px-3 h-10 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer", isDark ? "bg-gray-900 border-gray-800 text-yellow-400" : "bg-gray-100 border-gray-200 text-gray-700")}
            >
              <span className="material-symbols-outlined text-[18px]">{isDark ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <Link
              href="/cpanel"
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Control Panel</span>
            </Link>
          </div>
        </div>

        {/* Tab Controls */}
        <div className={cn("rounded-2xl p-6 border space-y-4", panelClass)}>
          <div className="flex items-center justify-between border-b pb-3 flex-wrap gap-2" style={{ borderColor: isDark ? "#1f2937" : "#f3f4f6" }}>
            <div>
              <h3 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                KYC Approvals Queue ({kycTotalCount})
              </h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Paginated low-cost Firestore query system</p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setKycTab("pending")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  kycTab === "pending"
                    ? "bg-[#FC7A00] text-white shadow-xs"
                    : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Pending Approvals
              </button>
              <button
                type="button"
                onClick={() => setKycTab("verified_today")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  kycTab === "verified_today"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Verified Today
              </button>
              <button
                type="button"
                onClick={() => setKycTab("unverified")}
                className={cn(
                  "px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer",
                  kycTab === "unverified"
                    ? "bg-rose-600 text-white shadow-xs"
                    : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                Unverified
              </button>
            </div>
          </div>

          {isLoadingKyc && pendingKycList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 uppercase tracking-widest font-bold text-xs">
              <ButtonSpinner /> Loading KYC Submissions...
            </div>
          ) : pendingKycList.length === 0 ? (
            <div className={cn("border rounded-xl p-6 text-center space-y-1.5", isDark ? "border-gray-800 bg-gray-900/50" : "border-gray-150 bg-gray-50/50")}>
              <span className="material-symbols-outlined text-[32px] text-emerald-500" style={{ fontVariationSettings: '"FILL" 1' }}>verified</span>
              <p className={cn("font-black text-xs uppercase", isDark ? "text-white" : "text-gray-800")}>Queue Clean</p>
              <p className="text-[11px] text-gray-400 font-medium">No pending user documents found in this tab.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingKycList.map((u) => {
                const processing = isProcessingKyc === u.uid;
                const reasonText = rejectionReason[u.uid] || "";
                const currentProvider = selectedProvider[u.uid] || "";

                return (
                  <div key={u.uid} className={cn("p-4 border rounded-2xl transition-all space-y-3", isDark ? "border-gray-800 bg-gray-900/40 hover:bg-gray-850/30" : "border-gray-150 bg-gray-50/50 hover:bg-gray-100/30")}>
                    <div className="flex justify-between items-start flex-wrap gap-2">
                      <div>
                        <h4 className={cn("font-extrabold text-sm leading-none", isDark ? "text-white" : "text-gray-900")}>{u.name}</h4>
                        <p className="text-xs font-semibold mt-1 select-all text-gray-400">{u.email}</p>
                        <p className="text-[10px] font-mono text-gray-400 mt-0.5">{u.phoneNumber}</p>
                      </div>

                      <div className="text-right">
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border",
                          u.kycStatus === "VERIFIED" && "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                          u.kycStatus === "IDENTITY_VERIFIED" && "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
                          u.kycStatus === "PENDING" && "bg-amber-500/10 text-amber-400 border-amber-500/20",
                          u.kycStatus === "REJECTED" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                          u.kycStatus === "PROVISIONING_FAILED" && "bg-rose-500/10 text-rose-400 border-rose-500/20",
                          u.kycStatus === "UNVERIFIED" && "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        )}>
                          {u.kycStatus}
                        </span>
                        <p className="text-[9px] font-mono text-gray-400 mt-1">{new Date(u.submittedAt).toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Selfie & Liveness Media */}
                    {(u.capturedSelfie || u.livenessChallenge) && (
                      <div className={cn("p-2.5 rounded-xl border flex items-center gap-3", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
                        {u.capturedSelfie && (
                          <div className="w-16 h-16 rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-100">
                            <img src={u.capturedSelfie} alt="Selfie" className="w-full h-full object-cover" />
                          </div>
                        )}
                        <div className="text-left space-y-0.5 text-[10px]">
                          <p className="font-extrabold uppercase text-[#FC7A00]">Biometric Selfie Verification</p>
                          {u.livenessChallenge && <p className="text-gray-400 font-semibold">Challenge: <span className="font-mono text-white">{u.livenessChallenge}</span></p>}
                        </div>
                      </div>
                    )}

                    {/* KYC Type & Number */}
                    <div className={cn("p-3 rounded-xl border space-y-1.5", isDark ? "bg-gray-800/60 border-gray-700" : "bg-white border-gray-200")}>
                      <div className="flex justify-between items-center text-[10px]">
                        <span className="font-black uppercase text-gray-400">{u.kycType.toUpperCase()} Number:</span>
                        <span className="font-mono font-bold select-all text-emerald-500">{u.kycNumber || "NOT PROVIDED"}</span>
                      </div>
                    </div>

                    {/* Provider Selector for Approval */}
                    {(u.kycStatus === "IDENTITY_VERIFIED" || u.kycStatus === "PROVISIONING_FAILED" || u.kycStatus === "PENDING") && (
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-gray-400">Select Virtual Account Gateway Provider *</label>
                        <select
                          value={currentProvider}
                          onChange={(e) => setSelectedProvider({ ...selectedProvider, [u.uid]: e.target.value as any })}
                          className={cn(
                            "w-full rounded-xl px-2.5 py-2 text-xs outline-none font-bold",
                            isDark ? "bg-gray-800 text-white border border-gray-700" : "bg-white text-black border border-gray-200"
                          )}
                        >
                          <option value="">-- Choose Virtual Bank Gateway --</option>
                          <option value="flutterwave">Flutterwave Gateway Rail</option>
                          <option value="squad">Squadco (GTBank) Virtual Account Rail</option>
                        </select>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200/30">
                      {u.kycStatus === "UNVERIFIED" && (
                        <button
                          type="button"
                          onClick={() => handleDeleteUnverifiedUser(u.uid, u.name)}
                          className="px-3 py-1.5 bg-red-600/10 hover:bg-red-600/20 text-red-500 border border-red-500/20 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer flex items-center gap-1"
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
                );
              })}
            </div>
          )}

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

      {/* Confirmation Modal */}
      {adminActionModal.isOpen && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className={cn("w-[92vw] sm:w-full max-w-sm p-6 rounded-3xl border text-center shadow-2xl space-y-4", panelClass)}>
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto border",
              adminActionModal.actionStyle === "danger" && "bg-red-50 text-red-500 border-red-200 dark:bg-red-950/40 dark:border-red-900/50"
            )}>
              <span className="material-symbols-outlined text-[24px]">gpp_maybe</span>
            </div>

            <div>
              <h4 className="font-extrabold text-sm uppercase text-gray-900 dark:text-white">{adminActionModal.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">{adminActionModal.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAdminActionModal((prev) => ({ ...prev, isOpen: false }))}
                className="py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdminActionModal((prev) => ({ ...prev, isOpen: false }));
                  adminActionModal.onConfirm();
                }}
                className="py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-red-700"
              >
                {adminActionModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
