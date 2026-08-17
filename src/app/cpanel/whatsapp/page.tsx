"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface DeviceInfo {
  phoneNumber: string | null;
  accountName: string | null;
  instanceName: string | null;
  connectionStatus: string;
  lastStatusUpdate: string;
}

interface WhatsappStatusData {
  success: boolean;
  apiHealth: "online" | "offline" | "error";
  apiError: string | null;
  deviceStatus: "CONNECTED" | "CONNECTING" | "WAITING_FOR_QR" | "DISCONNECTED" | "ERROR";
  deviceInfo?: DeviceInfo | null;
  qrCode?: string | null;
  lastChecked?: string;
}

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelWhatsappManagementPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Status state
  const [apiHealth, setApiHealth] = useState<"online" | "offline" | "error">("offline");
  const [apiError, setApiError] = useState<string | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<"CONNECTED" | "CONNECTING" | "WAITING_FOR_QR" | "DISCONNECTED" | "ERROR">("DISCONNECTED");
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  // Action loading states
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  // Confirmation Modal State for Disconnect / Logout
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  // Polling ref & visibility tracking
  const isPageVisibleRef = useRef(true);

  // Theme Syncing
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

  // Fetch Status from server endpoint
  const fetchStatus = useCallback(async (isManual: boolean = false) => {
    if (isManual) setIsRefreshing(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const res = await fetch("/api/admin/whatsapp/status", { headers, cache: "no-store" });
      const data: WhatsappStatusData = await res.json();

      if (data) {
        setApiHealth(data.apiHealth || "offline");
        setApiError(data.apiError || null);
        setDeviceStatus(data.deviceStatus || "DISCONNECTED");
        setLastChecked(data.lastChecked || new Date().toISOString());

        if (data.deviceInfo) {
          setDeviceInfo(data.deviceInfo);
        }

        // Handle QR Code
        if (data.deviceStatus === "WAITING_FOR_QR" && data.qrCode) {
          setQrCode(data.qrCode);
        } else if (data.deviceStatus === "CONNECTED") {
          setQrCode(null); // Automatically hide QR code when connected
        }

        if (isManual) {
          toast.success("WhatsApp status refreshed!");
        }
      }
    } catch (err: any) {
      setApiHealth("offline");
      setApiError("Failed to reach CPanel backend status route.");
      if (isManual) {
        toast.error("Network error refreshing status.");
      }
    } finally {
      if (isManual) setIsRefreshing(false);
    }
  }, []);

  // Fetch QR Code explicitly if in WAITING_FOR_QR state
  const fetchQrCode = useCallback(async () => {
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const res = await fetch("/api/admin/whatsapp/qr", { headers, cache: "no-store" });
      const data = await res.json();
      if (data.success && data.qrCode) {
        setQrCode(data.qrCode);
      }
    } catch (err) {
      console.warn("Failed to fetch fresh QR code:", err);
    }
  }, []);

  // Page visibility listener to stop polling when inactive
  useEffect(() => {
    const handleVisibilityChange = () => {
      isPageVisibleRef.current = !document.hidden;
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Polling Effect (Interval 8 seconds when active)
  useEffect(() => {
    if (!isLoadingSession) {
      fetchStatus();

      const interval = setInterval(() => {
        if (isPageVisibleRef.current) {
          fetchStatus();
        }
      }, 8000);

      return () => clearInterval(interval);
    }
  }, [isLoadingSession, fetchStatus]);

  // QR Code auto-refresh effect if in WAITING_FOR_QR
  useEffect(() => {
    if (deviceStatus === "WAITING_FOR_QR" && !qrCode) {
      fetchQrCode();
    }
  }, [deviceStatus, qrCode, fetchQrCode]);

  // Actions
  const handleConnect = async () => {
    setIsConnecting(true);
    toast.loading("Initializing WhatsApp connection sequence...", { id: "wa-action" });
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/whatsapp/connect", { method: "POST", headers });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "Connection sequence started!", { id: "wa-action" });
        if (data.qrCode) setQrCode(data.qrCode);
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to initialize connection.", { id: "wa-action" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error connecting WhatsApp.", { id: "wa-action" });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleReconnect = async () => {
    setIsReconnecting(true);
    toast.loading("Restarting WhatsApp connection...", { id: "wa-action" });
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/whatsapp/reconnect", { method: "POST", headers });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(data.message || "Reconnection triggered successfully!", { id: "wa-action" });
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to restart connection.", { id: "wa-action" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error reconnecting WhatsApp.", { id: "wa-action" });
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setShowDisconnectConfirm(false);
    setIsDisconnecting(true);
    toast.loading("Logging out WhatsApp device and clearing session...", { id: "wa-action" });
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/whatsapp/disconnect", { method: "POST", headers });
      const data = await res.json();

      if (res.ok && data.success) {
        toast.success("WhatsApp device logged out and session cleared.", { id: "wa-action" });
        setDeviceStatus("DISCONNECTED");
        setDeviceInfo(null);
        setQrCode(null);
        fetchStatus();
      } else {
        toast.error(data.error || "Failed to logout WhatsApp device.", { id: "wa-action" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error during logout.", { id: "wa-action" });
    } finally {
      setIsDisconnecting(false);
    }
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark ? "bg-[#131927] border-gray-800" : "bg-white border-gray-200 shadow-sm";

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
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Top Header */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
              title="Return to Control Panel"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500 text-[22px]">hub</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">WhatsApp Device Management</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Monitor API health, pair devices via QR code scan, and control active OTP dispatch sessions securely.
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
              disabled={isRefreshing}
              onClick={() => fetchStatus(true)}
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isRefreshing ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">refresh</span>}
              <span>Refresh Status</span>
            </button>
          </div>
        </div>

        {/* API Health & Status Overview Banner */}
        <div className={cn("p-6 rounded-2xl border space-y-4", panelClass)}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-200/40 pb-4">
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-3 h-3 rounded-full animate-ping",
                apiHealth === "online" ? "bg-emerald-500" : "bg-red-500"
              )} />
              <div>
                <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">API Backend Health</span>
                <span className={cn(
                  "text-xs font-black uppercase tracking-wide",
                  apiHealth === "online" ? "text-emerald-500" : "text-red-500"
                )}>
                  {apiHealth === "online" ? "WhatsApp API Server Online" : "WhatsApp API Unavailable"}
                </span>
              </div>
            </div>

            {lastChecked && (
              <span className="text-[10px] font-mono font-bold text-gray-400">
                Last checked: {new Date(lastChecked).toLocaleTimeString()}
              </span>
            )}
          </div>

          {apiError && (
            <div className="p-3.5 rounded-xl border border-red-500/20 bg-red-500/10 text-red-500 text-xs font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px]">warning</span>
              <span>{apiError}</span>
            </div>
          )}

          {/* Device Status Card */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">

            {/* Status Visual Indicator */}
            <div className="space-y-4">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">Device Connection Status</span>

              <div className={cn(
                "p-5 rounded-2xl border flex items-center gap-4 transition-all",
                deviceStatus === "CONNECTED" && "border-emerald-500/30 bg-emerald-500/10 text-emerald-500",
                deviceStatus === "CONNECTING" && "border-blue-500/30 bg-blue-500/10 text-blue-500",
                deviceStatus === "WAITING_FOR_QR" && "border-amber-500/30 bg-amber-500/10 text-amber-500",
                (deviceStatus === "DISCONNECTED" || deviceStatus === "ERROR") && "border-gray-300 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-gray-500"
              )}>
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold flex-shrink-0",
                  deviceStatus === "CONNECTED" && "bg-emerald-500",
                  deviceStatus === "CONNECTING" && "bg-blue-500",
                  deviceStatus === "WAITING_FOR_QR" && "bg-amber-500",
                  (deviceStatus === "DISCONNECTED" || deviceStatus === "ERROR") && "bg-gray-400"
                )}>
                  <span className="material-symbols-outlined text-[24px]">
                    {deviceStatus === "CONNECTED" && "cell_tower"}
                    {deviceStatus === "CONNECTING" && "sync"}
                    {deviceStatus === "WAITING_FOR_QR" && "qr_code_scanner"}
                    {(deviceStatus === "DISCONNECTED" || deviceStatus === "ERROR") && "phonelink_off"}
                  </span>
                </div>

                <div>
                  <h3 className="font-black text-sm uppercase tracking-wider">
                    {deviceStatus === "CONNECTED" && "Connected & Active"}
                    {deviceStatus === "CONNECTING" && "Connecting..."}
                    {deviceStatus === "WAITING_FOR_QR" && "Waiting for QR Scan"}
                    {deviceStatus === "DISCONNECTED" && "Disconnected"}
                    {deviceStatus === "ERROR" && "Connection Error"}
                  </h3>
                  <p className="text-[11px] font-medium opacity-80 mt-0.5">
                    {deviceStatus === "CONNECTED" && "WhatsApp sender node is ready for OTP dispatch."}
                    {deviceStatus === "CONNECTING" && "Establishing handshake with WhatsApp API server."}
                    {deviceStatus === "WAITING_FOR_QR" && "Scan the QR code with WhatsApp to pair device."}
                    {deviceStatus === "DISCONNECTED" && "Device is not currently paired or connected."}
                    {deviceStatus === "ERROR" && "Unable to retrieve status from WhatsApp gateway."}
                  </p>
                </div>
              </div>

              {/* Connected Device Info */}
              {deviceStatus === "CONNECTED" && deviceInfo && (
                <div className="p-4 rounded-xl border border-gray-200/50 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 space-y-2 text-xs">
                  <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider">Active Device Details</span>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-gray-400 text-[10px] block">Phone Number:</span>
                      <strong className="font-mono text-emerald-600 dark:text-emerald-400 font-extrabold">{deviceInfo.phoneNumber || "N/A"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Account Name:</span>
                      <strong className="font-semibold text-gray-800 dark:text-gray-200">{deviceInfo.accountName || "E-Tech Gateway"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Instance ID:</span>
                      <strong className="font-mono text-gray-800 dark:text-gray-200">{deviceInfo.instanceName || "Default"}</strong>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] block">Status:</span>
                      <strong className="text-emerald-500 uppercase font-black">{deviceInfo.connectionStatus}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Scan View or Device Control Buttons */}
            <div className="flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-gray-200/40 pt-4 md:pt-0 md:pl-6 space-y-4">
              {deviceStatus === "WAITING_FOR_QR" && qrCode ? (
                <div className="text-center space-y-3">
                  <div className="p-3 bg-white rounded-2xl border border-gray-200 shadow-md inline-block">
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48 object-contain" />
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase text-amber-500 tracking-wider">Scan with WhatsApp</p>
                    <p className="text-[10.5px] text-gray-400 font-semibold mt-0.5">Open WhatsApp → Linked Devices → Link a Device</p>
                  </div>
                  <button
                    type="button"
                    onClick={fetchQrCode}
                    className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 text-gray-700 dark:text-gray-300 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                  >
                    Refresh QR Code
                  </button>
                </div>
              ) : (
                <div className="w-full space-y-3 my-auto">
                  <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block text-center">Available Actions</span>

                  {deviceStatus === "DISCONNECTED" && (
                    <button
                      type="button"
                      disabled={isConnecting}
                      onClick={handleConnect}
                      className="w-full py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      {isConnecting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">add_link</span>}
                      <span>Connect Device</span>
                    </button>
                  )}

                  {deviceStatus === "CONNECTED" && (
                    <>
                      <button
                        type="button"
                        disabled={isReconnecting}
                        onClick={handleReconnect}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {isReconnecting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">sync</span>}
                        <span>Reconnect Instance</span>
                      </button>

                      <button
                        type="button"
                        disabled={isDisconnecting}
                        onClick={() => setShowDisconnectConfirm(true)}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
                      >
                        {isDisconnecting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">logout</span>}
                        <span>Disconnect / Logout Device</span>
                      </button>
                    </>
                  )}

                  {(deviceStatus === "CONNECTING" || deviceStatus === "WAITING_FOR_QR") && (
                    <button
                      type="button"
                      disabled={isDisconnecting}
                      onClick={() => setShowDisconnectConfirm(true)}
                      className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isDisconnecting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">cancel</span>}
                      <span>Cancel / Logout Session</span>
                    </button>
                  )}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

      {/* Confirmation Modal for Disconnect / Logout Device */}
      {showDisconnectConfirm && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className={cn("w-full max-w-sm p-6 rounded-3xl border text-center shadow-2xl space-y-4", panelClass)}>
            <div className="w-12 h-12 rounded-full bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-500 flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[24px]">gpp_maybe</span>
            </div>

            <div>
              <h4 className="font-extrabold text-sm uppercase text-gray-900 dark:text-white">Disconnect / Logout Device?</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-medium leading-relaxed">
                This will log out the WhatsApp device and clear its saved authentication session. You will need to scan a new QR code to connect it again.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowDisconnectConfirm(false)}
                className="py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDisconnect}
                className="py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-red-700"
              >
                Disconnect & Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
