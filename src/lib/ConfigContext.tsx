"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db, auth } from "@/lib/firebase";

export interface AppConfig {
  logoUrl: string;
  receiptLogoUrl?: string;
  receiptName?: string;
  statementLogoUrl?: string;
  statementSignatureUrl?: string;
  statementStampUrl?: string;
  supportPhone1: string;
  supportPhone2: string;
  supportEmail: string;
  totalUsers: number;
  globalNgnBalance: number;
  globalUsdBalance: number;
  imgbbApiKey: string;
  appVersion?: string;
  totalFixedDeposit?: number;
  todayDeposit?: number;
  todayTransfer?: number;
  totalAirtimePurchase?: number;
  totalBonus?: number;
  newDeviceDetectorEnabled?: boolean;
  maxKycUploadSizeMb?: number;
  totalTransferProfit?: number;
  totalDataProfit?: number;
  bannerOverlayFadeEnabled?: boolean;
  bannerSlideIntervalSeconds?: number;
  bannerBorderEnabled?: boolean;
  bannerBorderColor?: string;
  bannerBackgroundColor?: string;
  bannerImageMode?: "cover" | "contain";
  bannerSlideEffect?: "fade" | "slide";
  bannerImagePosition?: string;
  bannerHeightMobile?: number;
  bannerHeightDesktop?: number;
  bannerTransferPosition?: "top" | "bottom";
  bannerShowIndicators?: boolean;
  bannerMarginBottom?: number;
  whatsappPollingEnabled?: boolean;
  whatsappPollingIntervalMinutes?: number;
  minTransferAmount?: number;
  globalMinTransferAmount?: number;
}

const DEFAULT_CONFIG: AppConfig = {
  logoUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
  receiptLogoUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
  receiptName: "E-TECH GLOBAL HUB",
  supportPhone1: "+234 800 345 6225",
  supportPhone2: "+234 901 234 5678",
  supportEmail: "support@e-globaltechhub.com",
  totalUsers: 0,
  globalNgnBalance: 0,
  globalUsdBalance: 0,
  imgbbApiKey: "0d1a390cb385b632d952db08a3479005",
  appVersion: "1.0.0",
  totalFixedDeposit: 0,
  todayDeposit: 0,
  todayTransfer: 0,
  totalAirtimePurchase: 0,
  totalBonus: 0,
  newDeviceDetectorEnabled: true,
  maxKycUploadSizeMb: 10,
  totalTransferProfit: 0,
  totalDataProfit: 0,
  bannerOverlayFadeEnabled: true,
  bannerSlideIntervalSeconds: 5,
  bannerBorderEnabled: true,
  bannerBorderColor: "#e5e7eb",
  bannerBackgroundColor: "#111827",
  bannerImageMode: "cover",
  bannerSlideEffect: "fade",
  bannerImagePosition: "center",
  bannerHeightMobile: 150,
  bannerHeightDesktop: 220,
  bannerTransferPosition: "top",
  bannerShowIndicators: true,
  bannerMarginBottom: 24,
  whatsappPollingEnabled: true,
  whatsappPollingIntervalMinutes: 1,
};

interface ConfigContextProps {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => Promise<void>;
  resetConfig: () => Promise<void>;
  syncRealFirebaseData: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextProps | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  // Helper to fetch public visual configuration via serverless API
  const fetchPublicConfigFallback = async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      if (res.ok && data.success && data.config) {
        setConfig((prev) => ({
          ...prev,
          ...data.config,
        }));
      }
    } catch (err) {
      console.warn("Failed to fetch public config fallback:", err);
    }
  };

  // Sync core visual/support configs directly from Firestore config document
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupListener = () => {
      try {
        unsubscribe = onSnapshot(doc(db, "config", "app"), (docSnap) => {
          if (docSnap.exists()) {
            const remoteData = docSnap.data() as Partial<AppConfig>;
            setConfig((prev) => ({
              ...prev,
              ...remoteData,
            }));
          }
        }, (error) => {
          // Quietly handle permission failures for guest or unauthenticated users and fetch via serverless API
          if (error.code === "permission-denied") {
            fetchPublicConfigFallback();
          } else {
            console.warn("Config listener error:", error);
          }
        });
      } catch (e) {
        console.error("Firestore initialization error:", e);
      }
    };

    // Attempt to listen when Firebase Auth is loaded
    const unsubscribeAuth = auth.onAuthStateChanged((user: unknown) => {
      if (user) {
        if (unsubscribe) unsubscribe();
        setupListener();
      } else {
        // Load config from serverless API if unauthenticated
        if (unsubscribe) {
          unsubscribe();
          unsubscribe = null;
        }
        fetchPublicConfigFallback();
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync real counts, balances and aggregated sum of all registered accounts dynamically from Firebase
  const syncRealFirebaseData = async () => {
    try {
      // Rather than running direct client-side collection scans which can fail with permission exceptions,
      // let's fetch from the metrics endpoint or handle securely
      const res = await fetch("/api/admin/config");
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.config) {
          setConfig((prev) => ({
            ...prev,
            ...data.config,
          }));
          return;
        }
      }
    } catch (e) {
      console.warn("Real-time Firebase metrics agg fetch failed. (Falling back to local cache):", e);
    }
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    try {
      // Securely update config through the serverless admin config API
      const res = await fetch("/api/admin/config", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to save configuration server-side.");
      }

      // Update state with updated server-authoritative data
      if (data.config) {
        setConfig((prev) => ({
          ...prev,
          ...data.config,
        }));
      }
    } catch (e) {
      console.error("Failed to commit settings updates to Firebase Firestore:", e);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("app_global_config_fallback", JSON.stringify(newConfig));
      }
      throw e;
    }
  };

  const resetConfig = async () => {
    setConfig(DEFAULT_CONFIG);
    try {
      await updateConfig(DEFAULT_CONFIG);
    } catch (e) {
      console.error("Failed to reset config doc:", e);
    }
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig, syncRealFirebaseData }}>
      {children}
    </ConfigContext.Provider>
  );
};

export const useAppConfig = () => {
  const context = useContext(ConfigContext);
  if (!context) {
    throw new Error("useAppConfig must be used within a ConfigProvider");
  }
  return context;
};
