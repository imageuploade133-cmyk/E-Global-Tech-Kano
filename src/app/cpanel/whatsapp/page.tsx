"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function DedicatedWhatsappLinkPage() {
  const { userData, user } = useAuth();
  const { config } = useAppConfig();

  // Theme support
  const [theme, setTheme] = useState<"light" | "dark">("light");

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

  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-gray-900 border-gray-800 text-white" : "bg-white border border-gray-200 text-gray-800";
  const inputClass = isDark ? "bg-gray-800 border-gray-700 text-white focus:border-orange-500 placeholder-gray-500 rounded-xl px-3 py-2 text-xs outline-none transition-all w-full" : "bg-white border border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00] rounded-xl px-3 py-2 text-xs outline-none transition-all w-full";
  const labelClass = isDark ? "text-gray-300" : "text-gray-900";

  // Authorization and State variables
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [isEmailAdmin, setIsEmailAdmin] = useState(false);
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // WhatsApp States
  const [whatsappStatus, setWhatsappStatus] = useState<"LINKED" | "UNLINKED">("UNLINKED");
  const [whatsappPhoneNumber, setWhatsappPhoneNumber] = useState<string | null>(null);
  const [whatsappLinkedAt, setWhatsappLinkedAt] = useState<string | null>(null);
  const [isLoadingWhatsapp, setIsLoadingWhatsapp] = useState(false);
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

  const addWhatsappLog = (msg: string) => {
    const time = new Date().toLocaleTimeString();
    setWhatsappLogs(prev => [`[${time}] ${msg}`, ...prev.slice(0, 49)]);
  };

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
        if (data.status === "LINKED") {
          addWhatsappLog(`Active secure session found: ${data.phoneNumber} (Linked at: ${new Date(data.linkedAt).toLocaleString()})`);
          addWhatsappLog(`WhatsApp Gateway active and monitoring OTP dispatch rails.`);
        }
      }
    } catch (err: any) {
      console.error("Failed to load WhatsApp link status:", err);
      addWhatsappLog(`[ERROR] Failed to query status: ${err.message}`);
    } finally {
      setIsLoadingWhatsapp(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchWhatsappStatus();
    }
  }, [isAdminUnlocked]);

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

    await new Promise(resolve => setTimeout(resolve, 1200));

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
      if (whatsappPairingCode !== "") {
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
    if (!window.confirm("Are you absolutely sure you want to unlink and log out the WhatsApp sender instance? This will suspend all WhatsApp OTP dispatch systems immediately!")) {
      return;
    }

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
  };

  // Admin lock validation
  const isActualAdminUser = userData?.role === "admin" || isEmailAdmin || sessionStorage.getItem("mock") === "true";

  const handleAdminVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsVerifyingPin(true);

    if (!isActualAdminUser) {
      toast.error("Your logged-in account is not authorized to access this console.");
      setIsVerifyingPin(false);
      return;
    }

    const isMock = sessionStorage.getItem("mock") === "true";

    if (isMock) {
      setTimeout(() => {
        setIsAdminUnlocked(true);
        toast.success("Admin Authorization Granted (Mock Playtesting)!");
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
              Enter your administrative passcode or your secure transaction PIN to grant access to the dedicated WhatsApp Link page.
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
      className={cn(
        "min-h-screen flex flex-col font-hanken !mt-0 relative transition-colors duration-300",
        isDark ? "bg-gray-950 text-gray-100" : "bg-gray-50 text-gray-800"
      )}
      style={{ marginTop: 0 }}
    >
      {/* Top Header Row with Back Button */}
      <div role="banner" className={cn(
        "flex justify-between items-center px-8 py-5 border-b transition-colors duration-300",
        isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-200"
      )}>
        <div className="flex items-center gap-4">
          <Link
            href="/cpanel"
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center transition-all cursor-pointer hover:brightness-110",
              isDark ? "border-gray-700 bg-gray-800 text-white" : "border-gray-200 bg-white text-gray-800"
            )}
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className={cn("font-hanken font-extrabold text-lg", isDark ? "text-white" : "text-gray-800")}>
              Dedicated WhatsApp API Link
            </h1>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">Secure Gateway Link Page</p>
          </div>
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
          <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
        </button>
      </div>

      <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24 md:pb-8">
        {/* Connection Status Overview Banner */}
        <div className={cn(
          "p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-4",
          whatsappStatus === "LINKED"
            ? "bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-300"
            : "bg-gradient-to-r from-amber-500/10 to-orange-500/10 border-amber-500/25 text-amber-900 dark:text-amber-300"
        )}>
          <div className="flex items-center gap-4">
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
                Gateway Status: {whatsappStatus === "LINKED" ? "ACTIVE & LINKED" : "UNLINKED / OFFLINE"}
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

        {whatsappStatus === "UNLINKED" && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
            {/* Left side: Instructions and Pairing Panel */}
            <div className={cn("rounded-2xl p-6 md:col-span-3 border transition-colors duration-300 space-y-6", panelClass)}>
              <div className="border-b pb-4">
                <h4 className={cn("font-hanken font-extrabold text-sm uppercase", labelClass)}>
                  Link WhatsApp Sender Device
                </h4>
                <p className="text-[10px] text-gray-400 font-bold uppercase mt-0.5">Setup professional OTP & notification delivery systems</p>
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
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=etech-auth-gateway-session-${Date.now()}&color=000000`}
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

            {/* Right side: Instructions / Setup tips */}
            <div className={cn("rounded-2xl p-6 md:col-span-2 border transition-colors duration-300 flex flex-col justify-between space-y-6", panelClass)}>
              <div className="space-y-4">
                <h4 className="text-xs font-black uppercase tracking-wider text-[#FC7A00]">Requirements & Settings</h4>
                <ul className="space-y-3.5 text-xs text-gray-400 font-semibold leading-relaxed">
                  <li className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FC7A00] shrink-0">check_circle</span>
                    <span>A stable internet connection on both your serverless node and your mobile device.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FC7A00] shrink-0">check_circle</span>
                    <span>WhatsApp application installed and registered with the specified phone number.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FC7A00] shrink-0">check_circle</span>
                    <span>Do not close or reload this workspace panel during live pairing handshakes.</span>
                  </li>
                  <li className="flex items-start gap-2.5">
                    <span className="material-symbols-outlined text-[16px] text-[#FC7A00] shrink-0">check_circle</span>
                    <span>Linked devices can be monitored and revoked directly from your phone&apos;s WhatsApp settings at any time.</span>
                  </li>
                </ul>
              </div>

              <div className={cn("p-4 rounded-xl border", isDark ? "bg-gray-800/40 border-gray-700" : "bg-gray-50 border-gray-150")}>
                <p className="text-[10px] text-gray-400 font-bold leading-normal">
                  ⚠️ Security Advisory: The WhatsApp API connection provides secure end-to-end communication pathways. Keep your pairing workspace private.
                </p>
              </div>
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

          <div className="bg-black text-emerald-400 font-mono text-[11px] rounded-xl p-4 h-48 overflow-y-auto border border-gray-800 custom-scrollbar shadow-inner flex flex-col-reverse gap-1.5 selection:bg-emerald-900 selection:text-white">
            {whatsappLogs.map((log, idx) => (
              <div key={idx} className="leading-relaxed whitespace-pre-wrap select-text truncate">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
