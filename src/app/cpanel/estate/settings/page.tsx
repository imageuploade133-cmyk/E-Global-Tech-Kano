"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";
import { cn } from "@/lib/utils";

export default function CpanelEstateSettingsPage() {
  const { isDark } = useCpanelTheme();

  const [autoApproveListings, setAutoApproveListings] = useState(false);
  const [requireAgentKYC, setRequireAgentKYC] = useState(true);
  const [maxActiveListingsPerAgent, setMaxActiveListingsPerAgent] = useState("20");
  const [platformCommissionPercent, setPlatformCommissionPercent] = useState("2.5");
  const [enableVoiceNotes, setEnableVoiceNotes] = useState(true);
  const [enableAutoResponses, setEnableAutoResponses] = useState(true);
  const [chatSecurityNoticeUser, setChatSecurityNoticeUser] = useState("");
  const [chatSecurityNoticeAgent, setChatSecurityNoticeAgent] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/settings");
      const data = await res.json();
      if (data.success && data.settings) {
        const s = data.settings;
        setAutoApproveListings(Boolean(s.autoApproveListings));
        setRequireAgentKYC(Boolean(s.requireAgentKYC));
        setMaxActiveListingsPerAgent(String(s.maxActiveListingsPerAgent || 20));
        setPlatformCommissionPercent(String(s.platformCommissionPercent || 2.5));
        setEnableVoiceNotes(s.enableVoiceNotes !== false);
        setEnableAutoResponses(s.enableAutoResponses !== false);
        setChatSecurityNoticeUser(s.chatSecurityNoticeUser || "");
        setChatSecurityNoticeAgent(s.chatSecurityNoticeAgent || "");
      }
    } catch {
      toast.error("Failed to load property settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await fetch("/api/estate/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          autoApproveListings,
          requireAgentKYC,
          maxActiveListingsPerAgent: Number(maxActiveListingsPerAgent) || 20,
          platformCommissionPercent: Number(platformCommissionPercent) || 0,
          enableVoiceNotes,
          enableAutoResponses,
          chatSecurityNoticeUser,
          chatSecurityNoticeAgent,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Property marketplace settings saved!");
      } else {
        toast.error(data.error || "Failed to save settings.");
      }
    } catch {
      toast.error("Error communicating with server.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className={cn("p-4 sm:p-8 max-w-5xl mx-auto space-y-6 font-hanken text-black", isDark && "text-white")}>
      {/* Sticky Header */}
      <div className="flex items-center justify-between border-b pb-4 border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-[#FC7A00] flex items-center justify-center">
            <span className="material-symbols-outlined text-[24px]">settings</span>
          </div>
          <div>
            <h1 className="font-bodoni font-bold text-xl sm:text-2xl tracking-tight leading-none">
              Property Marketplace Settings
            </h1>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Configure marketplace policies, publishing limits, and chat security disclaimers
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={fetchSettings}
          disabled={isLoading}
          className="px-3.5 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-xs font-bold text-gray-800 dark:text-gray-200 cursor-pointer border-0 transition-all active:scale-95 disabled:opacity-50"
        >
          {isLoading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {isLoading ? (
        <div className="p-8 text-center text-xs font-bold text-gray-400 animate-pulse">
          Loading Property Settings...
        </div>
      ) : (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          {/* Section 1: Publishing & Approval Rules */}
          <div className={cn("p-5 sm:p-6 rounded-3xl border space-y-4 shadow-xs", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-2 border-b pb-3 border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">published_with_changes</span>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Publishing & Verification Controls</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-2xl border flex items-center justify-between", isDark ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200")}>
                <div>
                  <span className="text-xs font-bold block">Auto-Approve Property Listings</span>
                  <span className="text-[10.5px] text-gray-500 font-medium block">
                    Automatically publish new listings without manual admin review queue
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoApproveListings(!autoApproveListings)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-black uppercase border-0 cursor-pointer transition-all", autoApproveListings ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700")}
                >
                  {autoApproveListings ? "ON" : "OFF"}
                </button>
              </div>

              <div className={cn("p-4 rounded-2xl border flex items-center justify-between", isDark ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200")}>
                <div>
                  <span className="text-xs font-bold block">Require Verified Agent Identity</span>
                  <span className="text-[10.5px] text-gray-500 font-medium block">
                    Require agent profile verification before permitting property publishing
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setRequireAgentKYC(!requireAgentKYC)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-black uppercase border-0 cursor-pointer transition-all", requireAgentKYC ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700")}
                >
                  {requireAgentKYC ? "ON" : "OFF"}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Max Active Listings Per Agent
                </label>
                <input
                  type="number"
                  required
                  value={maxActiveListingsPerAgent}
                  onChange={(e) => setMaxActiveListingsPerAgent(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-2xl font-bold text-xs outline-none focus:border-[#FC7A00]"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Platform Marketplace Commission (%)
                </label>
                <input
                  type="number"
                  step="0.1"
                  required
                  value={platformCommissionPercent}
                  onChange={(e) => setPlatformCommissionPercent(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-2xl font-bold text-xs outline-none focus:border-[#FC7A00]"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Communication & Voice Note Controls */}
          <div className={cn("p-5 sm:p-6 rounded-3xl border space-y-4 shadow-xs", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-2 border-b pb-3 border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">forum</span>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Inquiry Chat & Voice Note Features</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className={cn("p-4 rounded-2xl border flex items-center justify-between", isDark ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200")}>
                <div>
                  <span className="text-xs font-bold block">50s Voice Note Recordings</span>
                  <span className="text-[10.5px] text-gray-500 font-medium block">
                    Allow buyers & agents to exchange encrypted voice notes in inquiry chat
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableVoiceNotes(!enableVoiceNotes)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-black uppercase border-0 cursor-pointer transition-all", enableVoiceNotes ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700")}
                >
                  {enableVoiceNotes ? "ON" : "OFF"}
                </button>
              </div>

              <div className={cn("p-4 rounded-2xl border flex items-center justify-between", isDark ? "bg-gray-950 border-gray-800" : "bg-gray-50 border-gray-200")}>
                <div>
                  <span className="text-xs font-bold block">Agent Automated Chat Auto-Responses</span>
                  <span className="text-[10.5px] text-gray-500 font-medium block">
                    Allow agent custom auto-responses to dispatch on customer inquiries
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setEnableAutoResponses(!enableAutoResponses)}
                  className={cn("px-3 py-1.5 rounded-xl text-xs font-black uppercase border-0 cursor-pointer transition-all", enableAutoResponses ? "bg-emerald-600 text-white" : "bg-gray-200 text-gray-700")}
                >
                  {enableAutoResponses ? "ON" : "OFF"}
                </button>
              </div>
            </div>
          </div>

          {/* Section 3: Chat Security Disclaimer Notices */}
          <div className={cn("p-5 sm:p-6 rounded-3xl border space-y-4 shadow-xs", isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200")}>
            <div className="flex items-center gap-2 border-b pb-3 border-gray-100 dark:border-gray-800">
              <span className="material-symbols-outlined text-amber-500 text-[20px]">shield_lock</span>
              <h3 className="font-extrabold text-sm uppercase tracking-wide">Pre-Chat Security Warning Disclaimers</h3>
            </div>

            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                User / Buyer Security Notice Message
              </label>
              <textarea
                rows={3}
                value={chatSecurityNoticeUser}
                onChange={(e) => setChatSecurityNoticeUser(e.target.value)}
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-2xl font-medium text-xs outline-none focus:border-[#FC7A00] resize-none"
              />
            </div>

            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                Agent / Publisher Compliance Notice Message
              </label>
              <textarea
                rows={3}
                value={chatSecurityNoticeAgent}
                onChange={(e) => setChatSecurityNoticeAgent(e.target.value)}
                className="w-full p-3.5 bg-gray-50 dark:bg-gray-950 border border-gray-300 dark:border-gray-800 rounded-2xl font-medium text-xs outline-none focus:border-[#FC7A00] resize-none"
              />
            </div>
          </div>

          {/* Save Action Bar */}
          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="py-4 px-8 bg-gradient-to-r from-[#FC7A00] via-amber-500 to-[#E06600] text-white font-black text-xs uppercase rounded-2xl border-0 cursor-pointer shadow-md hover:brightness-105 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">save</span>
              <span>{isSaving ? "Saving Settings..." : "Save Property Settings"}</span>
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
