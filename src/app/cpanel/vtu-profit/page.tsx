"use client";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";



import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ProfitMargins {
  dataProfitMargin: number;
  airtimeProfitMargin: number;
  cableProfitMargin: number;
  waecProfitMargin: number;
  electricityProfitMargin: number;
  transferProfitMargin: number;
  bulkTransferProfitMargin: number;
}

const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function VtuProfitSetupPage() {
  const { user, userData } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();

  // Theme support
  const [theme, setTheme] = useState<"light" | "dark">("light");



  const isDark = theme === "dark";
  const panelClass = isDark ? "bg-gray-900 border-gray-800 text-white" : "bg-white border border-gray-200 text-gray-800";
  const inputClass = isDark ? "bg-gray-800 border-gray-700 text-white focus:border-orange-500 placeholder-gray-500 rounded-xl px-3 py-2 text-xs outline-none transition-all w-full" : "bg-white border border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00] rounded-xl px-3 py-2 text-xs outline-none transition-all w-full";
  const labelClass = isDark ? "text-gray-300" : "text-gray-900";

  // Admin lock validation
  const [isAdminUnlocked, setIsAdminUnlocked] = useState(false);
  const [adminPin, setAdminPin] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [isVerifyingPin, setIsVerifyingPin] = useState(false);

  // Check cookie-based admin session on mount
  useEffect(() => {
    const checkCPanelSession = async () => {
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (res.ok && data.success && data.user) {
          setIsAdminUnlocked(true);
          setAdminEmail(data.user.email);
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

  const [margins, setMargins] = useState<ProfitMargins>({
    dataProfitMargin: 0,
    airtimeProfitMargin: 0,
    cableProfitMargin: 0,
    waecProfitMargin: 0,
    electricityProfitMargin: 0,
    transferProfitMargin: 0,
    bulkTransferProfitMargin: 0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchMargins = async () => {
    setIsLoading(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/admin/vtu-profit", {
        headers: {
          "Authorization": `Bearer ${idToken}`,
        },
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
      } else {
        toast.error(data.error || "Failed to load profit margins.");
      }
    } catch (err) {
      console.error("Error loading profit configurations:", err);
      toast.error("Failed to load your profit margins.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAdminUnlocked) {
      fetchMargins();
    }
  }, [isAdminUnlocked, user]);

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

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    toast.loading("Applying and securing global markup configurations...");

    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-admin-token";
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
      setIsSaving(false);
    }
  };

  const updateField = (key: keyof ProfitMargins, value: string) => {
    const num = Math.max(0, parseFloat(value) || 0);
    setMargins((prev) => ({
      ...prev,
      [key]: num,
    }));
  };

  const productCatalog = [
    {
      key: "dataProfitMargin" as const,
      title: "Mobile Data Markup",
      desc: "Markup added directly onto MTN, GLO, Airtel, and 9Mobile data plans.",
      placeholder: "e.g. 50 (₦)",
      icon: "tap_and_play"
    },
    {
      key: "airtimeProfitMargin" as const,
      title: "Airtime Markup",
      desc: "Markup added securely onto standard mobile airtime top-ups.",
      placeholder: "e.g. 20 (₦)",
      icon: "phone_android"
    },
    {
      key: "cableProfitMargin" as const,
      title: "Cable TV Markup",
      desc: "Fixed profit added onto DStv, GOtv, and StarTimes subscription packages.",
      placeholder: "e.g. 100 (₦)",
      icon: "connected_tv"
    },
    {
      key: "electricityProfitMargin" as const,
      title: "Electricity Markup",
      desc: "Markup fee applied on utility bill payments (Ikeja, Eko, etc.).",
      placeholder: "e.g. 150 (₦)",
      icon: "electric_bolt"
    },
    {
      key: "waecProfitMargin" as const,
      title: "WAEC Pin Markup",
      desc: "Profit margin added to WAEC / educational examination e-pins.",
      placeholder: "e.g. 200 (₦)",
      icon: "school"
    },
    {
      key: "transferProfitMargin" as const,
      title: "Single Transfer Markup",
      desc: "Markup fee added securely onto outward single bank transfers.",
      placeholder: "e.g. 50 (₦)",
      icon: "payments"
    },
    {
      key: "bulkTransferProfitMargin" as const,
      title: "Bulk Transfer Markup",
      desc: "Markup fee applied per recipient inside outward bulk transfers.",
      placeholder: "e.g. 30 (₦)",
      icon: "account_balance_wallet"
    }
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
              Enter your administrative passcode or your secure transaction PIN to manage administrative Commission Markups.
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
              Global Commission Markups
            </h1>
            <p className="text-xs text-gray-400 font-semibold uppercase mt-0.5 tracking-wider font-hanken">Secure Administrative Markup Console</p>
          </div>
        </div>

        <div className="relative w-8 h-8 p-0.5 bg-black/5 rounded">
          <img
            src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
            alt="E-Tech Logo"
            className="object-contain w-full h-full"
          />
        </div>
      </div>

      <div className="p-4 md:p-8 overflow-y-auto flex-1 max-w-5xl w-full mx-auto space-y-6 pb-24 md:pb-8">
        {isLoading ? (
          <div className="py-24 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
            <div className="w-8 h-8 rounded-full border-3 border-gray-200 border-t-[#FC7A00] animate-spin" />
            <span>Synchronizing administrative margin policies...</span>
          </div>
        ) : (
          <form onSubmit={handleSave} className="max-w-2xl mx-auto space-y-6">
            <div className={cn(
              "p-4 rounded-2xl border text-left",
              isDark ? "bg-emerald-950/20 border-emerald-900/30 text-emerald-400" : "bg-emerald-50 border-emerald-200 text-emerald-900"
            )}>
              <h3 className="font-bold text-xs uppercase mb-1">100% Secure Server-Side Markup Verification</h3>
              <p className="text-[11px] leading-normal font-semibold opacity-85">
                Your profit configurations are stored securely in Firestore config collection and executed atomically on Google Cloud serverless transaction engines during purchases. General users or client applications can never alter or bypass these configured markups.
              </p>
            </div>

            <div className="space-y-4">
              {productCatalog.map((p) => (
                <div
                  key={p.key}
                  className={cn(
                    "border rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:border-[#FC7A00]/30 transition-all",
                    isDark ? "bg-gray-900 border-gray-800" : "bg-white border-gray-150"
                  )}
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0",
                      isDark ? "bg-gray-800 border border-gray-700 text-gray-400" : "bg-gray-50 border border-gray-100 text-gray-600"
                    )}>
                      <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                    </div>
                    <div>
                      <h4 className="font-bold text-xs uppercase">{p.title}</h4>
                      <p className="text-[10px] text-gray-500 font-semibold leading-relaxed mt-0.5">{p.desc}</p>
                    </div>
                  </div>

                  <div className="w-28 flex-shrink-0 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-xs text-gray-400">₦</span>
                    <input
                      type="number"
                      value={margins[p.key] || ""}
                      onChange={(e) => updateField(p.key, e.target.value)}
                      placeholder={p.placeholder}
                      className={cn(
                        "w-full rounded-xl pl-6 pr-3 py-2.5 text-xs outline-none font-bold font-mono text-right",
                        isDark ? "bg-gray-800 border border-gray-700 text-white focus:border-orange-500" : "bg-gray-50 border border-gray-200 text-black focus:border-[#FC7A00]"
                      )}
                    />
                  </div>
                </div>
              ))}
            </div>

            <button
              type="submit"
              disabled={isSaving}
              className="w-full py-4 bg-[#FC7A00] text-white hover:brightness-105 active:scale-[0.98] rounded-2xl text-xs font-black uppercase tracking-widest shadow-sm cursor-pointer disabled:opacity-40 transition-all flex items-center justify-center gap-1.5"
            >
              {isSaving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Applying global markups...</span>
                </>
              ) : (
                "Apply Global Markup Configurations"
              )}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}