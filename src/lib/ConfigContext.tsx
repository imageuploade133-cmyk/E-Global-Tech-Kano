"use client";

import React, { createContext, useContext, useEffect, useState } from "react";

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
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
}

const ConfigContext = createContext<ConfigContextProps | undefined>(undefined);

export const ConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("app_global_config");
      if (saved) {
        try {
          setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(saved) });
        } catch {
          // fallback to default
        }
      }
    }
  }, []);

  const updateConfig = (updates: Partial<AppConfig>) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    if (typeof window !== "undefined") {
      localStorage.setItem("app_global_config", JSON.stringify(newConfig));
    }
  };

  const resetConfig = () => {
    setConfig(DEFAULT_CONFIG);
    if (typeof window !== "undefined") {
      localStorage.removeItem("app_global_config");
    }
  };

  return (
    <ConfigContext.Provider value={{ config, updateConfig, resetConfig }}>
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
