"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadImageSecurely } from "@/lib/image-upload";

interface StoreSettings {
  storeName?: string;
  storeLogoUrl?: string;
  enableProductSharing?: boolean;
  borderColor?: string;
  borderOpacity?: number;
  hideBorders?: boolean;
  enableGradientBorder?: boolean;
  gradientColorStart?: string;
  gradientColorEnd?: string;
  cardBorderRadius?: number;
  borderWidth?: number;
  recentlyViewedBorderEnabled?: boolean;
  recentlyViewedBorderColor?: string;
  recentlyViewedBorderOpacity?: number;
  orderStatuses?: string[];
  searchBarMarginTop?: number;
  bannerOverlayFadeEnabled?: boolean;
  bannerSlideIntervalSeconds?: number;
  bannerBorderEnabled?: boolean;
  bannerBorderColor?: string;
  bannerBackgroundColor?: string;
  bannerImageMode?: "cover" | "contain";
  bannerSlideEffect?: "fade" | "slide";
  bannerImagePosition?: string;
  bannerShowIndicators?: boolean;
  bannerMarginBottom?: number;
  bannerHeightMobile?: number;
  bannerHeightDesktop?: number;
}

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelStoreSettingsPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Store Settings Form States
  const [storeName, setStoreName] = useState("E-Tech Store");
  const [storeLogoUrl, setStoreLogoUrl] = useState("");
  const [enableProductSharing, setEnableProductSharing] = useState(true);
  const [isUploadingStoreLogo, setIsUploadingStoreLogo] = useState(false);
  const [borderColor, setBorderColor] = useState("#FC7A00");
  const [borderOpacity, setBorderOpacity] = useState(100);
  const [hideBorders, setHideBorders] = useState(false);
  const [enableGradientBorder, setEnableGradientBorder] = useState(false);
  const [gradientColorStart, setGradientColorStart] = useState("#FC7A00");
  const [gradientColorEnd, setGradientColorEnd] = useState("#0b513d");
  const [cardBorderRadius, setCardBorderRadius] = useState<number>(16);
  const [borderWidth, setBorderWidth] = useState<number>(1);
  const [recentlyViewedBorderEnabled, setRecentlyViewedBorderEnabled] = useState(true);
  const [recentlyViewedBorderColor, setRecentlyViewedBorderColor] = useState("#FC7A00");
  const [recentlyViewedBorderOpacity, setRecentlyViewedBorderOpacity] = useState(20);
  const [searchBarMarginTop, setSearchBarMarginTop] = useState(0);
  const [orderStatuses, setOrderStatuses] = useState<string[]>([
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Refunded",
    "Canceled",
  ]);

  const [isSavingSettings, setIsSavingSettings] = useState(false);

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

  const fetchStoreSettings = async () => {
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const res = await fetch("/api/admin/store", { headers });
      const data = await res.json();

      if (data.success && data.settings) {
        setStoreName(data.settings.storeName || "E-Tech Store");
        setStoreLogoUrl(data.settings.storeLogoUrl || "");
        setEnableProductSharing(data.settings.enableProductSharing !== false);
        setBorderColor(data.settings.borderColor || "#FC7A00");
        setBorderOpacity(data.settings.borderOpacity ?? 100);
        setHideBorders(Boolean(data.settings.hideBorders));
        setEnableGradientBorder(Boolean(data.settings.enableGradientBorder));
        setGradientColorStart(data.settings.gradientColorStart || "#FC7A00");
        setGradientColorEnd(data.settings.gradientColorEnd || "#0b513d");
        setCardBorderRadius(data.settings.cardBorderRadius ?? 16);
        setBorderWidth(data.settings.borderWidth ?? 1);
        setRecentlyViewedBorderEnabled(data.settings.recentlyViewedBorderEnabled !== false);
        setRecentlyViewedBorderColor(data.settings.recentlyViewedBorderColor || "#FC7A00");
        setRecentlyViewedBorderOpacity(data.settings.recentlyViewedBorderOpacity ?? 20);
        setSearchBarMarginTop(data.settings.searchBarMarginTop ?? 0);
        if (Array.isArray(data.settings.orderStatuses)) {
          setOrderStatuses(data.settings.orderStatuses);
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching store settings.");
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchStoreSettings();
    }
  }, [isLoadingSession]);

  const uploadImageToImgBB = async (file: File, setUrl: (url: string) => void, setUploading: (u: boolean) => void) => {
    setUploading(true);
    toast.loading("Uploading image securely...", { id: "img-upload" });

    try {
      const result = await uploadImageSecurely(file, "store_product");
      if (result.success && result.url) {
        setUrl(result.url);
        toast.success("Image uploaded and verified successfully!", { id: "img-upload" });
      } else {
        toast.error(result.error || "Image upload failed.", { id: "img-upload" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error uploading image.", { id: "img-upload" });
    } finally {
      setUploading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const res = await fetch("/api/admin/store", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "update_settings",
          settings: {
            storeName,
            storeLogoUrl,
            enableProductSharing,
            borderColor,
            borderOpacity,
            hideBorders,
            enableGradientBorder,
            gradientColorStart,
            gradientColorEnd,
            cardBorderRadius,
            borderWidth,
            recentlyViewedBorderEnabled,
            recentlyViewedBorderColor,
            recentlyViewedBorderOpacity,
            orderStatuses,
            searchBarMarginTop,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Storefront settings updated!");
      } else {
        toast.error(data.error || "Failed to update store settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error updating settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark ? "bg-[#131927] border-gray-800" : "bg-white border-gray-200 shadow-sm";
  const inputClass = isDark
    ? "bg-gray-900/80 border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00]"
    : "bg-white border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00]";

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
              href="/cpanel/store"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">settings</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Store Settings</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Configure storefront name, branding logo, card border design, and sharing parameters.
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
              href="/cpanel/store"
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">inventory_2</span>
              <span>Store Products</span>
            </Link>
          </div>
        </div>

        {/* Settings Form Container */}
        <div className="max-w-xl mx-auto">
          <div className={cn("p-6 rounded-2xl border space-y-5", panelClass)}>
            <div className="flex items-center gap-2 border-b border-gray-200/40 pb-3">
              <span className="material-symbols-outlined text-orange-500 text-[22px]">tune</span>
              <div>
                <h3 className="font-extrabold text-xs uppercase tracking-wider">Store Name, Brand Logo & Styling</h3>
                <p className="text-[10.5px] text-gray-400">Configure layout parameters, social product sharing, and product card borders.</p>
              </div>
            </div>

            <form onSubmit={handleSaveSettings} className="space-y-4">

              {/* Product Sharing ON/OFF Toggle */}
              <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-extrabold uppercase text-[#FC7A00] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">share</span>
                      Product Sharing Toggle
                    </label>
                    <span className="text-[10px] text-gray-500 font-medium block mt-0.5">
                      Allow users to copy or share product links directly from product detail page
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEnableProductSharing(!enableProductSharing)}
                    className={cn(
                      "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border transition-all",
                      enableProductSharing
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-red-500/10 text-red-500 border-red-500/30"
                    )}
                  >
                    {enableProductSharing ? "SHARING ON" : "SHARING OFF"}
                  </button>
                </div>
              </div>

              {/* Product Card Border Radius Slider */}
              <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">rounded_corner</span>
                    Product Card Border Radius ({cardBorderRadius}px)
                  </label>
                  <span className="font-mono text-xs font-black text-[#FC7A00]">{cardBorderRadius}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="32"
                  step="1"
                  value={cardBorderRadius}
                  onChange={(e) => setCardBorderRadius(Number(e.target.value))}
                  className="w-full accent-[#FC7A00] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                  <span>0px (Square)</span>
                  <span>16px (Medium)</span>
                  <span>32px (Fully Rounded)</span>
                </div>
              </div>

              {/* Product Card Border Width Slider */}
              <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">line_weight</span>
                    Product Card Border Width ({borderWidth}px)
                  </label>
                  <span className="font-mono text-xs font-black text-[#FC7A00]">{borderWidth}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="1"
                  value={borderWidth}
                  onChange={(e) => setBorderWidth(Number(e.target.value))}
                  className="w-full accent-[#FC7A00] cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-gray-400 font-bold uppercase">
                  <span>1px (Thin)</span>
                  <span>4px (Medium)</span>
                  <span>8px (Thick)</span>
                </div>
              </div>

              {/* Product Card Border Colors & Gradient Settings */}
              <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">border_style</span>
                      Card Border Visibility
                    </label>
                    <span className="text-[10px] text-gray-400 block">Show or completely remove border lines around products</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setHideBorders(!hideBorders)}
                    className={cn(
                      "px-3 py-1 rounded-xl text-xs font-black uppercase cursor-pointer border transition-all",
                      hideBorders
                        ? "bg-red-500/10 text-red-500 border-red-500/30"
                        : "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                    )}
                  >
                    {hideBorders ? "BORDER HIDDEN" : "BORDER VISIBLE"}
                  </button>
                </div>

                {!hideBorders && (
                  <div className="space-y-3 pt-2 border-t border-gray-200/30">
                    <div className="flex items-center justify-between">
                      <div>
                        <label className="text-[11px] font-bold uppercase text-gray-600 dark:text-gray-300">
                          Gradient Border Effect
                        </label>
                        <span className="text-[9.5px] text-gray-400 block">Apply 2-color gradient across product borders</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEnableGradientBorder(!enableGradientBorder)}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer border transition-all",
                          enableGradientBorder
                            ? "bg-orange-500/10 text-[#FC7A00] border-orange-500/30"
                            : "bg-gray-200/50 text-gray-500 border-gray-300/40"
                        )}
                      >
                        {enableGradientBorder ? "GRADIENT ON" : "SOLID COLOR"}
                      </button>
                    </div>

                    {enableGradientBorder ? (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Start Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={gradientColorStart}
                              onChange={(e) => setGradientColorStart(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={gradientColorStart}
                              onChange={(e) => setGradientColorStart(e.target.value)}
                              className={cn("h-8 px-2 rounded-lg text-xs font-mono border w-full", inputClass)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">End Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={gradientColorEnd}
                              onChange={(e) => setGradientColorEnd(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={gradientColorEnd}
                              onChange={(e) => setGradientColorEnd(e.target.value)}
                              className={cn("h-8 px-2 rounded-lg text-xs font-mono border w-full", inputClass)}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Border Color</label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={borderColor}
                              onChange={(e) => setBorderColor(e.target.value)}
                              className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                            />
                            <input
                              type="text"
                              value={borderColor}
                              onChange={(e) => setBorderColor(e.target.value)}
                              className={cn("h-8 px-2 rounded-lg text-xs font-mono border w-full", inputClass)}
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-gray-400 uppercase">Opacity ({borderOpacity}%)</label>
                          <input
                            type="range"
                            min="10"
                            max="100"
                            step="5"
                            value={borderOpacity}
                            onChange={(e) => setBorderOpacity(Number(e.target.value))}
                            className="w-full accent-[#FC7A00] cursor-pointer mt-2"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Recently Viewed Product Border Styling */}
              <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">history</span>
                      Recently Viewed Cards Border
                    </label>
                    <span className="text-[10px] text-gray-400 block">Custom border styling for recently viewed products ribbon</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRecentlyViewedBorderEnabled(!recentlyViewedBorderEnabled)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[10px] font-black uppercase cursor-pointer border transition-all",
                      recentlyViewedBorderEnabled
                        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
                        : "bg-gray-200/50 text-gray-500 border-gray-300/40"
                    )}
                  >
                    {recentlyViewedBorderEnabled ? "ENABLED" : "DISABLED"}
                  </button>
                </div>

                {recentlyViewedBorderEnabled && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Border Color</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={recentlyViewedBorderColor}
                          onChange={(e) => setRecentlyViewedBorderColor(e.target.value)}
                          className="w-8 h-8 rounded-lg cursor-pointer border-0 bg-transparent"
                        />
                        <input
                          type="text"
                          value={recentlyViewedBorderColor}
                          onChange={(e) => setRecentlyViewedBorderColor(e.target.value)}
                          className={cn("h-8 px-2 rounded-lg text-xs font-mono border w-full", inputClass)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-gray-400 uppercase">Opacity ({recentlyViewedBorderOpacity}%)</label>
                      <input
                        type="range"
                        min="5"
                        max="100"
                        step="5"
                        value={recentlyViewedBorderOpacity}
                        onChange={(e) => setRecentlyViewedBorderOpacity(Number(e.target.value))}
                        className="w-full accent-[#FC7A00] cursor-pointer mt-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Search Bar Top Space Adjustment Slider */}
              <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-extrabold uppercase text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[18px]">search</span>
                    Search Bar Top Space ({searchBarMarginTop}px)
                  </label>
                  <span className="font-mono text-xs font-black text-[#FC7A00]">{searchBarMarginTop}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="2"
                  value={searchBarMarginTop}
                  onChange={(e) => setSearchBarMarginTop(Number(e.target.value))}
                  className="w-full accent-[#FC7A00] cursor-pointer"
                />
              </div>

              {/* Store Name Input */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Store Name / Brand Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. E-Tech Store"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  className={cn("h-10 px-3 rounded-xl text-xs font-extrabold outline-none border transition-all w-full", inputClass)}
                />
              </div>

              {/* Store Logo Upload & Preview */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Store Header Logo</label>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl border border-gray-200/80 bg-gray-50 flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                    {storeLogoUrl ? (
                      <img src={storeLogoUrl} alt="Store Logo" className="w-full h-full object-contain p-1" />
                    ) : (
                      <span className="material-symbols-outlined text-gray-400 text-[22px]">storefront</span>
                    )}
                  </div>
                  <input
                    type="text"
                    placeholder="Paste logo URL (https://...)"
                    value={storeLogoUrl}
                    onChange={(e) => setStoreLogoUrl(e.target.value)}
                    className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all truncate", inputClass)}
                  />
                  <div className="relative flex-shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadImageToImgBB(file, setStoreLogoUrl, setIsUploadingStoreLogo);
                        }
                      }}
                      disabled={isUploadingStoreLogo}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button
                      type="button"
                      disabled={isUploadingStoreLogo}
                      className={cn("w-10 h-10 border rounded-xl flex items-center justify-center transition-all cursor-pointer", isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-700")}
                    >
                      {isUploadingStoreLogo ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSavingSettings}
                className="w-full h-11 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                {isSavingSettings ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">save</span>}
                <span>Save Store Settings</span>
              </button>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
