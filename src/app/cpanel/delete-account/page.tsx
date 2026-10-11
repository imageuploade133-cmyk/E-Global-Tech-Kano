"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";

const ButtonSpinner = () => (
  <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin shrink-0" />
);

interface DeletionRequestUser {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  balance: number;
  kycStatus: string;
  kycLevel: number;
  isBanned: boolean;
  isFrozen: boolean;
  deleteRequestedAt: string;
  deleteReason: string;
  virtualAccountNumber: string;
  createdAt: string;
}

function CpanelDeleteAccountPageContent() {
  const { isDark, toggleTheme } = useCpanelTheme();
  const [requests, setRequests] = useState<DeletionRequestUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  const bgClass = isDark ? "bg-[#0b0f17] text-white" : "bg-[#f8fafc] text-gray-900";
  const panelClass = isDark ? "bg-[#111827] border-gray-800" : "bg-white border-gray-200/80 shadow-xs";
  const inputClass = isDark
    ? "bg-gray-900 border-gray-800 text-white placeholder-gray-500 focus:border-[#FC7A00]"
    : "bg-gray-50 border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00]";

  const fetchDeletionRequests = async (query = "") => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/admin/delete-account?search=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRequests(data.requests || []);
      } else {
        toast.error(data.error || "Failed to load deletion requests.");
      }
    } catch {
      toast.error("Network error loading account deletion requests.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeletionRequests();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDeletionRequests(searchQuery.trim());
  };

  const handleBanToggle = async (userItem: DeletionRequestUser, ban: boolean) => {
    setProcessingUid(userItem.uid);
    const actionLabel = ban ? "Banning" : "Unbanning";
    toast.loading(`${actionLabel} user account...`, { id: "ban-user" });

    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid: userItem.uid,
          action: ban ? "ban" : "unban",
          banReason: userItem.deleteReason || "Requested account deletion.",
        }),
      });

      const data = await res.json();
      toast.dismiss("ban-user");

      if (res.ok && data.success) {
        toast.success(data.message || `User account ${ban ? "banned" : "unbanned"} successfully!`);
        setRequests((prev) =>
          prev.map((r) => (r.uid === userItem.uid ? { ...r, isBanned: ban } : r))
        );
      } else {
        toast.error(data.error || "Failed to perform action.");
      }
    } catch {
      toast.dismiss("ban-user");
      toast.error("Network error updating user account status.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleDismissRequest = async (uid: string) => {
    setProcessingUid(uid);
    toast.loading("Dismissing request...", { id: "dismiss-req" });

    try {
      const res = await fetch("/api/admin/delete-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetUid: uid,
          action: "dismiss_request",
        }),
      });

      const data = await res.json();
      toast.dismiss("dismiss-req");

      if (res.ok && data.success) {
        toast.success("Account deletion request dismissed.");
        setRequests((prev) => prev.filter((r) => r.uid !== uid));
      } else {
        toast.error(data.error || "Failed to dismiss request.");
      }
    } catch {
      toast.dismiss("dismiss-req");
      toast.error("Network error dismissing request.");
    } finally {
      setProcessingUid(null);
    }
  };

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
                <span className="material-symbols-outlined text-red-600 text-[22px]">delete_forever</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Account Deletion Requests</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Inspect customer account deletion requests, verify wallet balances, and manage account ban controls.
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

        {/* Search Panel */}
        <div className={cn("p-5 rounded-2xl border space-y-4", panelClass)}>
          <form onSubmit={handleSearch} className="flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Filter by user email, phone number, name, or UID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(inputClass, "pl-10 pr-4 h-11 w-full outline-none rounded-xl text-xs font-semibold")}
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full md:w-auto px-6 h-11 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">search</span>}
              <span>Filter Requests</span>
            </button>
          </form>
        </div>

        {/* Requests List */}
        {isLoading ? (
          <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
            <ButtonSpinner />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Deletion Requests...</p>
          </div>
        ) : requests.length === 0 ? (
          <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
            <span className="material-symbols-outlined text-[48px] text-emerald-500">check_circle</span>
            <p className="text-xs font-black uppercase text-gray-400">No Account Deletion Requests</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">
              There are currently no pending account deletion requests from users.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-extrabold uppercase text-gray-400 tracking-wider">
              Pending Deletion Requests ({requests.length})
            </p>

            {requests.map((userItem) => {
              const isProcessing = processingUid === userItem.uid;
              return (
                <div key={userItem.uid} className={cn("p-5 rounded-2xl border space-y-4 transition-all", panelClass)}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/40 pb-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-extrabold text-sm uppercase tracking-tight">{userItem.name}</h3>
                        <span className={cn(
                          "px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                          userItem.isBanned
                            ? "bg-red-500/10 border-red-500/20 text-red-500"
                            : "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                        )}>
                          {userItem.isBanned ? "ACCOUNT BANNED" : "ACTIVE USER"}
                        </span>
                        {userItem.isFrozen && (
                          <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider bg-blue-500/10 border border-blue-500/20 text-blue-500">
                            FROZEN
                          </span>
                        )}
                      </div>

                      <p className="text-xs font-semibold text-gray-400 select-all">
                        Email: {userItem.email} • Phone: {userItem.phoneNumber}
                      </p>
                      <p className="text-[10px] font-mono text-gray-500">
                        UID: {userItem.uid} • Virtual Account: {userItem.virtualAccountNumber}
                      </p>
                    </div>

                    {/* Ban / Unban Actions */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                      {userItem.isBanned ? (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleBanToggle(userItem, false)}
                          className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          {isProcessing ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">lock_open</span>}
                          <span>Unband User</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isProcessing}
                          onClick={() => handleBanToggle(userItem, true)}
                          className="px-4 h-10 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                        >
                          {isProcessing ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">block</span>}
                          <span>Band Account</span>
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isProcessing}
                        onClick={() => handleDismissRequest(userItem.uid)}
                        className="px-3.5 h-10 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>

                  {/* Account Metrics & Deletion Reason */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1 text-xs">
                    <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                      <span className="text-[9.5px] font-black uppercase text-gray-400 block">Wallet Balance</span>
                      <span className="font-mono text-sm font-black text-emerald-600 mt-0.5 block">
                        ₦{userItem.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                      <span className="text-[9.5px] font-black uppercase text-gray-400 block">Identity / KYC Tier</span>
                      <span className="font-bold text-gray-800 mt-0.5 block uppercase">
                        {userItem.kycStatus} (Tier {userItem.kycLevel})
                      </span>
                    </div>

                    <div className="p-3 bg-gray-50/50 rounded-xl border border-gray-100/50">
                      <span className="text-[9.5px] font-black uppercase text-gray-400 block">Request Date</span>
                      <span className="font-semibold text-gray-700 mt-0.5 block">
                        {new Date(userItem.deleteRequestedAt).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Deletion Reason */}
                  <div className="p-3 bg-red-50/60 border border-red-100/80 rounded-xl space-y-1">
                    <span className="text-[9.5px] font-black uppercase text-red-600 tracking-wider block">User Submitted Reason</span>
                    <p className="text-xs font-semibold text-red-950 italic">
                      &quot;{userItem.deleteReason}&quot;
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}

export default function CpanelDeleteAccountPage() {
  return (
    <CpanelRouteGuard requiredPermission="users.manage">
      <CpanelDeleteAccountPageContent />
    </CpanelRouteGuard>
  );
}
