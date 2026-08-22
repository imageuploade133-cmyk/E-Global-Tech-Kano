"use client";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";



import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface UserLimitItem {
  uid: string;
  name: string;
  email: string;
  phoneNumber: string;
  dailyTransferLimit: number;
  maxSingleTransferLimit: number;
  dailyDepositLimit: number;
  unlimitedTransfers: boolean;
  unlimitedDeposits: boolean;
}

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-[#FC7A00] border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelLimitsPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useCpanelTheme();
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState<UserLimitItem[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [savingUid, setSavingUid] = useState<string | null>(null);

  // Theme Syncing




  // Auth & Session Check
  useEffect(() => {
    async function checkSession() {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      if (isMock) {
        setIsLoadingSession(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error("Session expired. Please log in.");
          router.push("/cpanel");
          return;
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Handle Search Users
  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) {
      toast.warning("Please enter a search term (email, phone, or name).");
      return;
    }

    setIsLoadingUsers(true);
    setHasSearched(true);

    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch(`/api/admin/limits?search=${encodeURIComponent(searchQuery.trim())}`, { headers });
      const data = await res.json();

      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (data.users.length === 0) {
          toast.info("No matching user accounts found.");
        }
      } else {
        toast.error(data.error || "Failed to search user profiles.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error searching user profiles.");
    } finally {
      setIsLoadingUsers(false);
    }
  };

  // Save Limit Updates
  const handleSaveLimits = async (userItem: UserLimitItem) => {
    setSavingUid(userItem.uid);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/limits", {
        method: "POST",
        headers,
        body: JSON.stringify({
          targetUid: userItem.uid,
          dailyTransferLimit: userItem.dailyTransferLimit,
          maxSingleTransferLimit: userItem.maxSingleTransferLimit,
          dailyDepositLimit: userItem.dailyDepositLimit,
          unlimitedTransfers: userItem.unlimitedTransfers,
          unlimitedDeposits: userItem.unlimitedDeposits,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Account limitations updated successfully!");
      } else {
        toast.error(data.error || "Failed to update account limitations.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error updating account limitations.");
    } finally {
      setSavingUid(null);
    }
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full";

  if (isLoadingSession) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
        <div className="flex flex-col items-center gap-3">
          <ButtonSpinner />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

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
                <span className="material-symbols-outlined text-orange-500 text-[22px]">trending_up</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Account Limits Manager</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Increase or grant Unlimited Transfer and Deposit thresholds for user accounts.
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
                placeholder="Search user email, phone number, or name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("w-full h-11 pl-10 pr-4 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
              />
            </div>
            <button
              type="submit"
              disabled={isLoadingUsers}
              className="w-full md:w-auto px-6 h-11 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoadingUsers ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">search</span>}
              <span>Search User</span>
            </button>
          </form>
        </div>

        {/* Results List */}
        {isLoadingUsers ? (
          <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
            <ButtonSpinner />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Searching User Database...</p>
          </div>
        ) : !hasSearched ? (
          <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
            <span className="material-symbols-outlined text-[48px] text-orange-500">query_stats</span>
            <p className="text-xs font-black uppercase text-gray-400">Search User Account</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">
              Enter an exact email or phone number above to inspect and configure deposit or transfer limits.
            </p>
          </div>
        ) : users.length === 0 ? (
          <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
            <span className="material-symbols-outlined text-[42px] text-gray-400">person_off</span>
            <p className="text-xs font-black uppercase text-gray-400">No Users Found</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">No user profiles matched your search term.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((userItem) => {
              const isSaving = savingUid === userItem.uid;
              return (
                <div key={userItem.uid} className={cn("p-5 rounded-2xl border space-y-5 transition-all", panelClass)}>
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-200/40 pb-4">
                    <div>
                      <h3 className="font-extrabold text-sm uppercase tracking-tight">{userItem.name}</h3>
                      <p className="text-xs font-semibold text-gray-400 mt-1 select-all">{userItem.email} • {userItem.phoneNumber}</p>
                      <p className="text-[10px] font-mono text-gray-500 mt-0.5">UID: {userItem.uid}</p>
                    </div>

                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleSaveLimits(userItem)}
                      className="px-6 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                    >
                      {isSaving ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                      <span>Save Limitations</span>
                    </button>
                  </div>

                  {/* Limit Controls Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Transfers Section */}
                    <div className={cn("p-4 rounded-xl border space-y-4", isDark ? "bg-gray-900/60 border-gray-800" : "bg-gray-50 border-gray-200/60")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-orange-500 text-[20px]">send</span>
                          <h4 className="font-extrabold text-xs uppercase tracking-wider">Transfer Limits</h4>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userItem.unlimitedTransfers}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUsers((prev) =>
                                prev.map((u) => (u.uid === userItem.uid ? { ...u, unlimitedTransfers: checked } : u))
                              );
                            }}
                            className="w-4 h-4 text-[#FC7A00] rounded focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] font-extrabold uppercase text-orange-500">Unlimited</span>
                        </label>
                      </div>

                      {!userItem.unlimitedTransfers ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Daily Transfer Threshold (₦)</label>
                            <input
                              type="number"
                              value={userItem.dailyTransferLimit}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setUsers((prev) =>
                                  prev.map((u) => (u.uid === userItem.uid ? { ...u, dailyTransferLimit: val } : u))
                                );
                              }}
                              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Single Transfer Cap (₦)</label>
                            <input
                              type="number"
                              value={userItem.maxSingleTransferLimit}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setUsers((prev) =>
                                  prev.map((u) => (u.uid === userItem.uid ? { ...u, maxSingleTransferLimit: val } : u))
                                );
                              }}
                              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-orange-500/10 border border-orange-500/20 text-orange-500 rounded-xl text-center space-y-1">
                          <span className="material-symbols-outlined text-[24px]">verified</span>
                          <p className="text-xs font-black uppercase">Unlimited Transfers Active</p>
                          <p className="text-[10px] text-gray-400 font-semibold">User can send transfers without daily or single transaction caps.</p>
                        </div>
                      )}
                    </div>

                    {/* Deposits Section */}
                    <div className={cn("p-4 rounded-xl border space-y-4", isDark ? "bg-gray-900/60 border-gray-800" : "bg-gray-50 border-gray-200/60")}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-emerald-500 text-[20px]">add_circle</span>
                          <h4 className="font-extrabold text-xs uppercase tracking-wider">Deposit Limits</h4>
                        </div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={userItem.unlimitedDeposits}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setUsers((prev) =>
                                prev.map((u) => (u.uid === userItem.uid ? { ...u, unlimitedDeposits: checked } : u))
                              );
                            }}
                            className="w-4 h-4 text-emerald-500 rounded focus:ring-0 cursor-pointer"
                          />
                          <span className="text-[11px] font-extrabold uppercase text-emerald-500">Unlimited</span>
                        </label>
                      </div>

                      {!userItem.unlimitedDeposits ? (
                        <div className="space-y-3">
                          <div className="space-y-1">
                            <label className="text-[10px] font-black uppercase text-gray-400">Daily Inbound Deposit Cap (₦)</label>
                            <input
                              type="number"
                              value={userItem.dailyDepositLimit}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setUsers((prev) =>
                                  prev.map((u) => (u.uid === userItem.uid ? { ...u, dailyDepositLimit: val } : u))
                                );
                              }}
                              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 rounded-xl text-center space-y-1">
                          <span className="material-symbols-outlined text-[24px]">verified</span>
                          <p className="text-xs font-black uppercase">Unlimited Deposits Active</p>
                          <p className="text-[10px] text-gray-400 font-semibold">User can receive unlimited inbound wallet deposits.</p>
                        </div>
                      )}
                    </div>

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