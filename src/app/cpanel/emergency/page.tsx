"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

function CpanelEmergencyPageContent() {
  const router = useRouter();
  const { isDark, toggleTheme } = useCpanelTheme();
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Form & Broadcast State
  const [isActive, setIsActive] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState<"info" | "warning" | "danger" | "emerald">("warning");
  const [badge, setBadge] = useState("EMERGENCY BROADCAST");
  const [icon, setIcon] = useState("campaign");
  const [updatedAt, setUpdatedAt] = useState("");
  const [updatedBy, setUpdatedBy] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Check Admin Unlock Session
  useEffect(() => {
    async function checkSession() {
      const isMock =
        typeof window !== "undefined" &&
        (window.location.search.includes("mock=true") ||
          sessionStorage.getItem("admin_session_unlocked") === "true");
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

  // Fetch Current Emergency Broadcast Settings
  const fetchBroadcast = async () => {
    setIsLoading(true);
    try {
      const isMock =
        typeof window !== "undefined" &&
        (window.location.search.includes("mock=true") ||
          sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { Authorization: "Bearer mock-admin-token" }
        : {};

      const res = await fetch("/api/admin/emergency", { headers });
      const data = await res.json();

      if (data.success && data.broadcast) {
        const b = data.broadcast;
        setIsActive(Boolean(b.active));
        setTitle(b.title || "");
        setMessage(b.message || "");
        setUrgency(b.urgency || "warning");
        setBadge(b.badge || "EMERGENCY BROADCAST");
        setIcon(b.icon || "campaign");
        setUpdatedAt(b.updatedAt || "");
        setUpdatedBy(b.updatedBy || "");
      } else {
        toast.error(data.error || "Failed to load broadcast settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error loading emergency broadcast.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchBroadcast();
    }
  }, [isLoadingSession]);

  // Save Broadcast Form
  const handleSaveBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isActive && (!title.trim() || !message.trim())) {
      toast.error("Title and Message are required when broadcast is active.");
      return;
    }

    setIsSaving(true);
    toast.loading(isActive ? "Publishing broadcast live..." : "Updating broadcast settings...", { id: "save-broadcast" });

    try {
      const isMock =
        typeof window !== "undefined" &&
        (window.location.search.includes("mock=true") ||
          sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/emergency", {
        method: "POST",
        headers,
        body: JSON.stringify({
          active: isActive,
          title,
          message,
          urgency,
          badge,
          icon,
        }),
      });

      const data = await res.json();
      toast.dismiss("save-broadcast");

      if (res.ok && data.success) {
        toast.success(data.message || "Broadcast updated successfully!");
        if (data.broadcast) {
          setUpdatedAt(data.broadcast.updatedAt);
          setUpdatedBy(data.broadcast.updatedBy);
        }
      } else {
        toast.error(data.error || "Failed to update emergency broadcast.");
      }
    } catch (err: any) {
      toast.dismiss("save-broadcast");
      toast.error(err.message || "Network error saving broadcast.");
    } finally {
      setIsSaving(false);
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
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">
            Verifying Admin Access...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header Bar */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn(
                "w-10 h-10 rounded-xl border flex items-center justify-center transition-all",
                isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100"
              )}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-rose-500 text-[24px]">campaign</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">
                  Emergency Broadcast Manager
                </h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Broadcast urgent system notifications, maintenance notices, or critical alerts directly above user wallet balance cards.
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
            <button
              type="button"
              onClick={fetchBroadcast}
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border-0"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Live Status Toggle Card */}
        <div className={cn("p-6 rounded-2xl border space-y-4 shadow-xs", panelClass)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-gray-200 dark:border-gray-800">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-3 h-3 rounded-full animate-ping",
                  isActive ? "bg-emerald-500" : "bg-gray-400"
                )} />
                <h3 className="font-extrabold text-sm uppercase tracking-wide">
                  Live Broadcast Status: <span className={isActive ? "text-emerald-500" : "text-gray-400"}>{isActive ? "ACTIVE & LIVE" : "DISABLED"}</span>
                </h3>
              </div>
              <p className="text-xs text-gray-400 font-medium">
                {isActive
                  ? "Broadcast is currently visible at the top of all user wallet cards."
                  : "Broadcast is currently hidden from user wallet cards."}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={cn(
                "px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm flex items-center gap-2 border-0 shrink-0",
                isActive
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-300"
              )}
            >
              <span className="material-symbols-outlined text-[18px]">
                {isActive ? "toggle_on" : "toggle_off"}
              </span>
              <span>{isActive ? "Disable Broadcast" : "Enable Live Broadcast"}</span>
            </button>
          </div>

          {updatedAt && (
            <p className="text-[11px] text-gray-400 font-mono">
              Last updated on {new Date(updatedAt).toLocaleString()} by {updatedBy || "System Admin"}
            </p>
          )}
        </div>

        {/* Form & Mobile Live Preview Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Broadcast Form */}
          <div className={cn("p-6 rounded-2xl border space-y-5 shadow-xs", panelClass)}>
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3">
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Broadcast Configuration</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Customize title, message, theme & badge</p>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs font-bold uppercase text-gray-400 animate-pulse">
                <ButtonSpinner /> Loading Broadcast Settings...
              </div>
            ) : (
              <form onSubmit={handleSaveBroadcast} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Broadcast Headline / Title *</label>
                  <input
                    type="text"
                    required={isActive}
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Scheduled System Maintenance / Upgrade"
                    className={inputClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Badge Label</label>
                    <input
                      type="text"
                      value={badge}
                      onChange={(e) => setBadge(e.target.value)}
                      placeholder="e.g. SYSTEM ALERT"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Urgency / Theme</label>
                    <select
                      value={urgency}
                      onChange={(e) => setUrgency(e.target.value as any)}
                      className={cn(inputClass, "cursor-pointer font-bold")}
                    >
                      <option value="danger">Danger / Critical (Red)</option>
                      <option value="warning">Warning / Alert (Orange/Amber)</option>
                      <option value="info">Information (Blue)</option>
                      <option value="emerald">Success / Update (Green)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Icon Name (Material Symbols)</label>
                  <select
                    value={icon}
                    onChange={(e) => setIcon(e.target.value)}
                    className={cn(inputClass, "cursor-pointer font-bold")}
                  >
                    <option value="campaign">campaign (Loudspeaker)</option>
                    <option value="warning">warning (Warning Triangle)</option>
                    <option value="error">error (Error Icon)</option>
                    <option value="info">info (Info Circle)</option>
                    <option value="verified">verified (Check Badge)</option>
                    <option value="build">build (Maintenance Wrench)</option>
                    <option value="notifications_active">notifications_active (Bell)</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Full Broadcast Information / Message *</label>
                  <textarea
                    rows={5}
                    required={isActive}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Write detailed broadcast information shown when the user taps the banner..."
                    className={cn("w-full p-3 rounded-xl text-xs font-semibold outline-none resize-none", inputClass, "h-32")}
                  />
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-3.5 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm active:scale-95 border-0 flex items-center gap-2"
                  >
                    {isSaving ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">campaign</span>}
                    <span>Save & Publish Broadcast</span>
                  </button>
                </div>
              </form>
            )}
          </div>

          {/* Right: Mobile Live Preview */}
          <div className={cn("p-6 rounded-2xl border space-y-5 shadow-xs", panelClass)}>
            <div className="border-b border-gray-200 dark:border-gray-800 pb-3 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm uppercase tracking-wide">Wallet Card Preview</h3>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Live rendering above wallet balance card</p>
              </div>
              <span className="material-symbols-outlined text-gray-400 text-[20px]">phone_iphone</span>
            </div>

            {/* Wallet Ticker Banner Preview */}
            <div className="space-y-3 p-4 rounded-3xl bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-wider text-gray-400 text-center">Top of Wallet Card</p>

              {/* Ticker Banner */}
              <div
                className={cn(
                  "p-3 rounded-2xl border flex items-center justify-between gap-2.5 transition-all shadow-xs cursor-pointer select-none",
                  urgency === "danger"
                    ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                    : urgency === "warning"
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400"
                    : urgency === "emerald"
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-blue-500/10 border-blue-500/30 text-blue-700 dark:text-blue-400"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="w-8 h-8 rounded-full bg-current/15 flex items-center justify-center shrink-0">
                    <span className="material-symbols-outlined text-[18px] animate-pulse">{icon || "campaign"}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider bg-current/20 text-current shrink-0">
                        {badge || "NOTICE"}
                      </span>
                      <h4 className="font-extrabold text-xs truncate text-black dark:text-white">
                        {title || "Broadcast Headline"}
                      </h4>
                    </div>
                    <p className="text-[10.5px] font-medium text-gray-600 dark:text-gray-300 truncate mt-0.5">
                      {message || "Broadcast message content snippet..."}
                    </p>
                  </div>
                </div>

                <span className="material-symbols-outlined text-[18px] text-gray-400 shrink-0">chevron_right</span>
              </div>

              {/* Mock Balance Card Preview */}
              <div className="aspect-[1.586/1] w-full rounded-2xl bg-gradient-to-br from-[#0c1324] to-[#1e293b] p-4 text-white flex flex-col justify-between shadow-md">
                <div className="flex justify-between items-center text-[10px] text-gray-300 font-bold uppercase tracking-wider">
                  <span>Available Balance</span>
                  <span className="px-2 py-0.5 bg-white/10 rounded">Tier 3 VIP</span>
                </div>
                <div>
                  <h2 className="text-2xl font-black font-mono">₦1,250,000.00</h2>
                  <p className="text-[9px] text-emerald-400 font-bold mt-0.5">Reward Bonus: ₦1,000.00</p>
                </div>
                <div className="flex justify-between items-end text-[10px]">
                  <div>
                    <span className="text-[8px] text-gray-400 block uppercase">Account Holder</span>
                    <strong className="font-extrabold">ABDULKADIR SHABA</strong>
                  </div>
                  <span className="font-mono font-bold bg-white/10 px-2 py-0.5 rounded">NGN</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CpanelEmergencyPage() {
  return (
    <CpanelRouteGuard requiredPermission="settings.manage">
      <CpanelEmergencyPageContent />
    </CpanelRouteGuard>
  );
}
