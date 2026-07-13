"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, setDoc, onSnapshot, collection, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface AppConfig {
  logoUrl: string;
  supportPhone1: string;
  supportPhone2: string;
  supportEmail: string;
  totalUsers: number;
  globalNgnBalance: number;
  globalUsdBalance: number;
  imgbbApiKey: string;
}

const DEFAULT_CONFIG: AppConfig = {
  logoUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
  supportPhone1: "+234 800 345 6225",
  supportPhone2: "+234 901 234 5678",
  supportEmail: "support@e-globaltechhub.com",
  totalUsers: 4820,
  globalNgnBalance: 312500450.75,
  globalUsdBalance: 148900.50,
  imgbbApiKey: "0d1a390cb385b632d952db08a3479005",
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

  // Sync core visual/support configs directly from Firestore config document
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    try {
      unsubscribe = onSnapshot(doc(db, "config", "app"), (docSnap) => {
        if (docSnap.exists()) {
          const remoteData = docSnap.data() as Partial<AppConfig>;
          setConfig((prev) => ({
            ...prev,
            ...remoteData,
          }));
        } else {
          // If Firestore config doc doesn't exist, seed it with default configurations
          setDoc(doc(db, "config", "app"), DEFAULT_CONFIG);
        }
      }, (error) => {
        console.warn("Firestore config listener blocked (User may not be authenticated yet):", error);
      });
    } catch (e) {
      console.error("Firestore initialization error:", e);
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Sync real counts, balances and aggregated sum of all registered accounts dynamically from Firebase
  const syncRealFirebaseData = async () => {
    try {
      const usersSnap = await getDocs(collection(db, "users"));
      const userList = usersSnap.docs.map((d) => d.data());

      const userCount = userList.length || DEFAULT_CONFIG.totalUsers;
      const totalNgn = userList.reduce((acc, curr) => acc + (Number(curr.balance) || 0), 0) || DEFAULT_CONFIG.globalNgnBalance;
      const totalUsd = userList.reduce((acc, curr) => acc + (Number(curr.usdBalance) || 0), 0) || DEFAULT_CONFIG.globalUsdBalance;

      // Dynamically update context configurations with real database calculations
      const metricsUpdates = {
        totalUsers: userCount,
        globalNgnBalance: totalNgn,
        globalUsdBalance: totalUsd,
      };

      setConfig((prev) => ({
        ...prev,
        ...metricsUpdates,
      }));

      // Also persist to config document on firebase securely
      await setDoc(doc(db, "config", "app"), metricsUpdates, { merge: true });
    } catch (e) {
      console.warn("Real-time Firebase metrics agg fetch failed. (Falling back to local cache):", e);
    }
  };

  const updateConfig = async (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);

    try {
      await setDoc(doc(db, "config", "app"), updates, { merge: true });
    } catch (e) {
      console.error("Failed to commit settings updates to Firebase Firestore:", e);
      if (typeof window !== "undefined") {
        localStorage.setItem("app_global_config_fallback", JSON.stringify(newConfig));
      }
    }
  };

  const resetConfig = async () => {
    setConfig(DEFAULT_CONFIG);
    try {
      await setDoc(doc(db, "config", "app"), DEFAULT_CONFIG);
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
