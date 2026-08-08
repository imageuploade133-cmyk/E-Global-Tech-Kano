"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import { motion } from "framer-motion";
import Link from "next/link";
import Image from "next/image";
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

export default function VtuProfitSetupPage() {
  const { user, userData } = useAuth();
  const router = useRouter();

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

  // Fetch current configured profit margins from database
  useEffect(() => {
    const fetchMargins = async () => {
      try {
        const isMock = sessionStorage.getItem("mock") === "true";
        let idToken = "mock-token";
        if (!isMock && user) {
          idToken = await user.getIdToken();
        }

        const res = await fetch("/api/profile/vtu-profit", {
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
        }
      } catch (err) {
        console.error("Error loading profit configurations:", err);
        toast.error("Failed to load your profit margins.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchMargins();
  }, [user]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    toast.loading("Applying and securing profit configurations...");

    try {
      const isMock = sessionStorage.getItem("mock") === "true";
      let idToken = "mock-token";
      if (!isMock && user) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/profile/vtu-profit", {
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
        toast.success("Markup profit configurations applied successfully!");
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
      desc: "Added directly onto MTN, GLO, Airtel, and 9Mobile data plans.",
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

  return (
    <div className="min-h-screen bg-white text-black font-hanken p-5 pb-32">
      {/* Header Row */}
      <header className="flex justify-between items-center py-4 mb-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <Link
            href="/profile"
            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-black active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </Link>
          <div>
            <h1 className="font-hanken font-extrabold text-base tracking-tight uppercase">Markup Profit Settings</h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Configure Sub-agent Commissions</p>
          </div>
        </div>

        <div className="relative w-8 h-8 p-0.5 bg-black/5 rounded">
          <Image
            src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
            alt="E-Tech Logo"
            fill
            className="object-contain"
            priority
          />
        </div>
      </header>

      {isLoading ? (
        <div className="py-24 text-center text-gray-400 text-xs font-bold uppercase tracking-widest animate-pulse flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-3 border-gray-200 border-t-[#FC7A00] animate-spin" />
          <span>Synchronizing margin policies...</span>
        </div>
      ) : (
        <form onSubmit={handleSave} className="max-w-2xl mx-auto space-y-6">
          <div className="bg-gradient-to-r from-[#FC7A00]/10 to-[#FF9022]/10 border border-[#FC7A00]/25 rounded-2xl p-4 text-left">
            <h3 className="font-bold text-xs uppercase text-[#FC7A00] mb-1">100% Secure Server-Side Markup Verification</h3>
            <p className="text-[11px] text-gray-600 leading-normal font-semibold">
              Your profit configurations are stored securely in Firestore and executed atomically on Google Cloud serverless transaction engines. Sub-agents or client integrations can never alter or bypass these configured markups.
            </p>
          </div>

          <div className="space-y-4">
            {productCatalog.map((p) => (
              <div
                key={p.key}
                className="bg-white border border-gray-150 rounded-2xl p-4 flex items-center justify-between gap-4 shadow-sm hover:border-[#FC7A00]/30 transition-all"
              >
                <div className="flex items-start gap-3 flex-1">
                  <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0">
                    <span className="material-symbols-outlined text-[20px]">{p.icon}</span>
                  </div>
                  <div>
                    <h4 className="font-bold text-xs text-black uppercase">{p.title}</h4>
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
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-6 pr-3 py-2.5 text-xs outline-none text-black font-bold font-mono focus:border-[#FC7A00] transition-all text-right"
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
                <span>Applying markups...</span>
              </>
            ) : (
              "Apply Margin Configurations"
            )}
          </button>
        </form>
      )}
    </div>
  );
}
