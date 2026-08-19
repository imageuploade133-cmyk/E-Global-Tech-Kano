"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadImageSecurely } from "@/lib/image-upload";

interface StoreItem {
  id: string;
  title: string;
  description: string;
  price: number;
  costPrice?: number | null;
  discountPrice?: number | null;
  category: string;
  imageUrl: string;
  images?: string[];
  coverImageUrl?: string;
  videoUrl?: string;
  autoSlide?: boolean;
  inStock: boolean;
  stockQuantity?: number | null;
  unlimitedStock?: boolean;
  createdAt: string;
}

interface StoreSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  description?: string;
  link: string;
  customWidth?: number | null;
  customHeight?: number | null;
  mobileHeight?: number | null;
  desktopHeight?: number | null;
  marginBottom?: number | null;
  isCrop?: boolean;
  isHidden?: boolean;
  createdAt?: string;
}

interface StoreSettings {
  storeName?: string;
  storeLogoUrl?: string;
  borderColor?: string;
  borderOpacity?: number;
  hideBorders?: boolean;
  enableGradientBorder?: boolean;
  gradientColorStart?: string;
  gradientColorEnd?: string;
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

export default function CpanelStorePage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [activeTab, setActiveTab] = useState<"items" | "slides" | "settings">("items");
  const [imgbbApiKey, setImgbbApiKey] = useState("");

  // Data states
  const [items, setItems] = useState<StoreItem[]>([]);
  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ borderColor: "#FC7A00", hideBorders: false });
  const [isLoading, setIsLoading] = useState(true);

  // Item Form & Edit Modal state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemTitle, setItemTitle] = useState("");
  const [itemDescription, setItemDescription] = useState("");
  const [itemCostPrice, setItemCostPrice] = useState("");
  const [itemPrice, setItemPrice] = useState("");
  const [itemDiscountPrice, setItemDiscountPrice] = useState("");
  const [itemCategory, setItemCategory] = useState("Hardware");
  const [itemImages, setItemImages] = useState<string[]>([]);
  const [itemCoverUrl, setItemCoverUrl] = useState("");
  const [itemVideoUrl, setItemVideoUrl] = useState("");
  const [itemAutoSlide, setItemAutoSlide] = useState(true);
  const [itemInStock, setItemInStock] = useState(true);
  const [itemStockQuantity, setItemStockQuantity] = useState<string>("");
  const [itemUnlimitedStock, setItemUnlimitedStock] = useState(true);
  const [newImageInput, setNewImageInput] = useState("");
  const [isUploadingItemImage, setIsUploadingItemImage] = useState(false);
  const [isSavingItem, setIsSavingItem] = useState(false);

  // New Slide Form & Edit state
  const [editingSlideId, setEditingSlideId] = useState<string | null>(null);
  const [slideImageUrl, setSlideImageUrl] = useState("");
  const [slideTitle, setSlideTitle] = useState("");
  const [slideSubtitle, setSlideSubtitle] = useState("");
  const [slideLink, setSlideLink] = useState("");
  const [slideCustomWidth, setSlideCustomWidth] = useState<string>("");
  const [slideIsCrop, setSlideIsCrop] = useState(true);
  const [slideIsHidden, setSlideIsHidden] = useState(false);
  const [slideMarginBottom, setSlideMarginBottom] = useState(20);
  const [slideMobileHeight, setSlideMobileHeight] = useState(176);
  const [slideDesktopHeight, setSlideDesktopHeight] = useState(220);
  const [isUploadingSlideImage, setIsUploadingSlideImage] = useState(false);
  const [isSavingSlide, setIsSavingSlide] = useState(false);

  // Slide Display Settings Form
  const [searchBarMarginTop, setSearchBarMarginTop] = useState(0);
  const [bannerOverlayFadeEnabled, setBannerOverlayFadeEnabled] = useState(true);
  const [bannerSlideIntervalSeconds, setBannerSlideIntervalSeconds] = useState(5);
  const [bannerBorderEnabled, setBannerBorderEnabled] = useState(false);
  const [bannerBorderColor, setBannerBorderColor] = useState("#FC7A00");
  const [bannerBackgroundColor, setBannerBackgroundColor] = useState("#111827");
  const [bannerImageMode, setBannerImageMode] = useState<"cover" | "contain">("cover");
  const [bannerSlideEffect, setBannerSlideEffect] = useState<"fade" | "slide">("fade");
  const [bannerImagePosition, setBannerImagePosition] = useState("center");
  const [bannerShowIndicators, setBannerShowIndicators] = useState(true);
  const [bannerMarginBottom, setBannerMarginBottom] = useState(20);
  const [bannerHeightMobile, setBannerHeightMobile] = useState(176);
  const [bannerHeightDesktop, setBannerHeightDesktop] = useState(220);

  // Store Settings Form
  const [storeName, setStoreName] = useState("E-Tech Store");
  const [storeLogoUrl, setStoreLogoUrl] = useState("");
  const [isUploadingStoreLogo, setIsUploadingStoreLogo] = useState(false);
  const [borderColor, setBorderColor] = useState("#FC7A00");
  const [borderOpacity, setBorderOpacity] = useState(100);
  const [hideBorders, setHideBorders] = useState(false);
  const [enableGradientBorder, setEnableGradientBorder] = useState(false);
  const [gradientColorStart, setGradientColorStart] = useState("#FC7A00");
  const [gradientColorEnd, setGradientColorEnd] = useState("#0b513d");
  const [recentlyViewedBorderEnabled, setRecentlyViewedBorderEnabled] = useState(true);
  const [recentlyViewedBorderColor, setRecentlyViewedBorderColor] = useState("#FC7A00");
  const [recentlyViewedBorderOpacity, setRecentlyViewedBorderOpacity] = useState(20);
  const [orderStatuses, setOrderStatuses] = useState<string[]>([
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Refunded",
    "Canceled",
  ]);
  const [newStatusInput, setNewStatusInput] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // Deleting item/slide ID
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Custom Confirmation Modal State
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionLabel: string;
    actionStyle: "danger" | "warning" | "success" | "info";
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    actionLabel: "",
    actionStyle: "danger",
    onConfirm: () => {},
  });

  const triggerConfirm = (
    title: string,
    message: string,
    actionLabel: string,
    actionStyle: "danger" | "warning" | "success" | "info",
    onConfirm: () => void
  ) => {
    setConfirmModal({ isOpen: true, title, message, actionLabel, actionStyle, onConfirm });
  };

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

  // Fetch Admin App Config for ImgBB Key
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/admin/config");
        const data = await res.json();
        if (data.config?.imgbbApiKey) {
          setImgbbApiKey(data.config.imgbbApiKey);
        }
      } catch (err) {
        console.warn("Failed to fetch admin config:", err);
      }
    }
    fetchConfig();
  }, []);

  // Fetch Store Data & Dynamic Categories
  const fetchStoreData = async () => {
    setIsLoading(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const [storeRes, catRes] = await Promise.all([
        fetch("/api/admin/store", { headers }),
        fetch("/api/admin/store/categories", { headers })
      ]);

      const data = await storeRes.json();
      const catData = await catRes.json();

      if (data.success) {
        setItems(data.items || []);
        setSlides(data.slides || []);
        if (data.settings) {
          setSettings(data.settings);
          setStoreName(data.settings.storeName || "E-Tech Store");
          setStoreLogoUrl(data.settings.storeLogoUrl || "");
          setBorderColor(data.settings.borderColor || "#FC7A00");
          setBorderOpacity(data.settings.borderOpacity ?? 100);
          setHideBorders(Boolean(data.settings.hideBorders));
          setEnableGradientBorder(Boolean(data.settings.enableGradientBorder));
          setGradientColorStart(data.settings.gradientColorStart || "#FC7A00");
          setGradientColorEnd(data.settings.gradientColorEnd || "#0b513d");
          setRecentlyViewedBorderEnabled(data.settings.recentlyViewedBorderEnabled !== false);
          setRecentlyViewedBorderColor(data.settings.recentlyViewedBorderColor || "#FC7A00");
          setRecentlyViewedBorderOpacity(data.settings.recentlyViewedBorderOpacity ?? 20);
          if (Array.isArray(data.settings.orderStatuses)) {
            setOrderStatuses(data.settings.orderStatuses);
          }
          setSearchBarMarginTop(data.settings.searchBarMarginTop ?? 0);
          setBannerOverlayFadeEnabled(data.settings.bannerOverlayFadeEnabled !== false);
          setBannerSlideIntervalSeconds(data.settings.bannerSlideIntervalSeconds || 5);
          setBannerBorderEnabled(Boolean(data.settings.bannerBorderEnabled));
          setBannerBorderColor(data.settings.bannerBorderColor || "#FC7A00");
          setBannerBackgroundColor(data.settings.bannerBackgroundColor || "#111827");
          setBannerImageMode(data.settings.bannerImageMode || "cover");
          setBannerSlideEffect(data.settings.bannerSlideEffect || "fade");
          setBannerImagePosition(data.settings.bannerImagePosition || "center");
          setBannerShowIndicators(data.settings.bannerShowIndicators !== false);
          setBannerMarginBottom(data.settings.bannerMarginBottom ?? 20);
          setBannerHeightMobile(data.settings.bannerHeightMobile || 176);
          setBannerHeightDesktop(data.settings.bannerHeightDesktop || 220);
        }
      } else {
        toast.error(data.error || "Failed to load store data.");
      }

      if (catData.success && Array.isArray(catData.categories)) {
        setCategories(catData.categories);
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching store data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchStoreData();
    }
  }, [isLoadingSession]);

  // Upload file to ImgBB helper
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

  // Save Store Settings
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
            borderColor,
            borderOpacity,
            hideBorders,
            enableGradientBorder,
            gradientColorStart,
            gradientColorEnd,
            recentlyViewedBorderEnabled,
            recentlyViewedBorderColor,
            recentlyViewedBorderOpacity,
            orderStatuses,
            searchBarMarginTop,
            bannerOverlayFadeEnabled,
            bannerSlideIntervalSeconds,
            bannerBorderEnabled,
            bannerBorderColor,
            bannerBackgroundColor,
            bannerImageMode,
            bannerSlideEffect,
            bannerImagePosition,
            bannerShowIndicators,
            bannerMarginBottom,
            bannerHeightMobile,
            bannerHeightDesktop,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Storefront border settings updated!");
        if (data.settings) setSettings(data.settings);
      } else {
        toast.error(data.error || "Failed to update store settings.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error updating settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const resetItemForm = () => {
    setEditingItemId(null);
    setItemTitle("");
    setItemDescription("");
    setItemCostPrice("");
    setItemPrice("");
    setItemDiscountPrice("");
    setItemCategory("Hardware");
    setItemImages([]);
    setItemCoverUrl("");
    setItemVideoUrl("");
    setItemAutoSlide(true);
    setItemInStock(true);
    setItemStockQuantity("");
    setItemUnlimitedStock(true);
    setNewImageInput("");
  };

  const handleStartEditItem = (item: StoreItem) => {
    setEditingItemId(item.id);
    setItemTitle(item.title || "");
    setItemDescription(item.description || "");
    setItemCostPrice(item.costPrice !== null && item.costPrice !== undefined ? item.costPrice.toString() : "");
    setItemPrice(item.price ? item.price.toString() : "");
    setItemDiscountPrice(item.discountPrice !== null && item.discountPrice !== undefined ? item.discountPrice.toString() : "");
    setItemCategory(item.category || "Hardware");
    const existingImgs = Array.isArray(item.images) && item.images.length > 0 ? item.images : (item.imageUrl ? [item.imageUrl] : []);
    setItemImages(existingImgs);
    setItemCoverUrl(item.coverImageUrl || item.imageUrl || existingImgs[0] || "");
    setItemVideoUrl(item.videoUrl || "");
    setItemAutoSlide(item.autoSlide !== false);
    setItemInStock(item.inStock !== false);
    setItemStockQuantity(item.stockQuantity !== null && item.stockQuantity !== undefined ? item.stockQuantity.toString() : "");
    setItemUnlimitedStock(item.unlimitedStock !== false && (item.stockQuantity === null || item.stockQuantity === undefined));
    setNewImageInput("");
    setIsProductModalOpen(true);
  };

  const handleOpenAddModal = () => {
    resetItemForm();
    setIsProductModalOpen(true);
  };

  const handleAddImageToProduct = (urlToAdd: string) => {
    const trimmed = urlToAdd.trim();
    if (!trimmed) return;
    if (itemImages.includes(trimmed)) {
      toast.info("Image URL already added.");
      return;
    }
    const updated = [...itemImages, trimmed];
    setItemImages(updated);
    if (!itemCoverUrl) setItemCoverUrl(trimmed);
    setNewImageInput("");
    toast.success("Image added to product list!");
  };

  const handleRemoveImageFromProduct = (index: number) => {
    const removedUrl = itemImages[index];
    const updated = itemImages.filter((_, i) => i !== index);
    setItemImages(updated);
    if (itemCoverUrl === removedUrl) {
      setItemCoverUrl(updated[0] || "");
    }
  };

  // Add or Edit Item Submit
  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemTitle.trim()) {
      toast.error("Item title is required.");
      return;
    }

    setIsSavingItem(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const action = editingItemId ? "edit_item" : "add_item";
      const primaryCover = itemCoverUrl || itemImages[0] || "";

      const res = await fetch("/api/admin/store", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action,
          item: {
            id: editingItemId || undefined,
            title: itemTitle,
            description: itemDescription,
            costPrice: itemCostPrice !== "" ? parseFloat(itemCostPrice) : null,
            price: parseFloat(itemPrice) || 0,
            discountPrice: itemDiscountPrice !== "" ? parseFloat(itemDiscountPrice) : null,
            category: itemCategory,
            imageUrl: primaryCover,
            images: itemImages.length > 0 ? itemImages : (primaryCover ? [primaryCover] : []),
            coverImageUrl: primaryCover,
            videoUrl: itemVideoUrl,
            autoSlide: itemAutoSlide,
            inStock: itemInStock,
            stockQuantity: itemUnlimitedStock ? null : (itemStockQuantity !== "" ? parseInt(itemStockQuantity) : null),
            unlimitedStock: itemUnlimitedStock,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingItemId ? "Store item updated successfully!" : "Store item added successfully!");
        setItems(data.items || []);
        resetItemForm();
      } else {
        toast.error(data.error || "Failed to save store item.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving store item.");
    } finally {
      setIsSavingItem(false);
    }
  };

  // Delete Item with Confirmation Modal
  const handleDeleteItem = async (itemId: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    const itemTitle = targetItem ? targetItem.title.toUpperCase() : "THIS PRODUCT";

    triggerConfirm(
      "Delete Store Product?",
      `Are you sure you want to permanently delete product "${itemTitle}" from your store?`,
      "Delete Product",
      "danger",
      async () => {
        setDeletingId(itemId);
        try {
          const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
          const headers: Record<string, string> = isMock
            ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
            : { "Content-Type": "application/json" };

          const res = await fetch("/api/admin/store", {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "delete_item",
              itemId,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            toast.success("Store item deleted.");
            setItems(data.items || []);
          } else {
            toast.error(data.error || "Failed to delete item.");
          }
        } catch (err: any) {
          toast.error(err.message || "Network error deleting item.");
        } finally {
          setDeletingId(null);
        }
      }
    );
  };

  const resetSlideForm = () => {
    setEditingSlideId(null);
    setSlideImageUrl("");
    setSlideTitle("");
    setSlideSubtitle("");
    setSlideLink("");
    setSlideCustomWidth("");
    setSlideIsCrop(true);
    setSlideIsHidden(false);
    setSlideMarginBottom(20);
    setSlideMobileHeight(176);
    setSlideDesktopHeight(220);
  };

  const handleStartEditSlide = (s: StoreSlide) => {
    setEditingSlideId(s.id);
    setSlideImageUrl(s.imageUrl || "");
    setSlideTitle(s.title || "");
    setSlideSubtitle(s.subtitle || s.description || "");
    setSlideLink(s.link || "");
    setSlideCustomWidth(s.customWidth !== null && s.customWidth !== undefined ? String(s.customWidth) : "");
    setSlideIsCrop(s.isCrop !== false);
    setSlideIsHidden(Boolean(s.isHidden));
    setSlideMarginBottom(s.marginBottom !== undefined && s.marginBottom !== null ? s.marginBottom : 20);
    setSlideMobileHeight(s.mobileHeight !== undefined && s.mobileHeight !== null ? s.mobileHeight : 176);
    setSlideDesktopHeight(s.desktopHeight !== undefined && s.desktopHeight !== null ? s.desktopHeight : 220);
  };

  // Add/Edit Slide Submit
  const handleAddSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slideImageUrl.trim()) {
      toast.error("Slide image URL is required.");
      return;
    }

    setIsSavingSlide(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock
        ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
        : { "Content-Type": "application/json" };

      const action = editingSlideId ? "edit_slide" : "add_slide";

      const res = await fetch("/api/admin/store", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action,
          slide: {
            id: editingSlideId || undefined,
            imageUrl: slideImageUrl,
            title: slideTitle,
            subtitle: slideSubtitle,
            description: slideSubtitle,
            link: slideLink,
            customWidth: slideCustomWidth !== "" ? Number(slideCustomWidth) : null,
            isCrop: slideIsCrop,
            isHidden: slideIsHidden,
            marginBottom: Number(slideMarginBottom) || 0,
            mobileHeight: Number(slideMobileHeight) || 176,
            desktopHeight: Number(slideDesktopHeight) || 220,
          },
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(editingSlideId ? "Store slide updated!" : "Store slide added!");
        setSlides(data.slides || []);
        resetSlideForm();
      } else {
        toast.error(data.error || "Failed to save slide image.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving slide image.");
    } finally {
      setIsSavingSlide(false);
    }
  };

  // Delete Slide with Confirmation Modal
  const handleDeleteSlide = async (slideId: string) => {
    triggerConfirm(
      "Delete Store Slide?",
      "Are you sure you want to permanently delete this storefront slideshow banner?",
      "Delete Slide",
      "danger",
      async () => {
        setDeletingId(slideId);
        try {
          const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
          const headers: Record<string, string> = isMock
            ? { "Content-Type": "application/json", Authorization: "Bearer mock-admin-token" }
            : { "Content-Type": "application/json" };

          const res = await fetch("/api/admin/store", {
            method: "POST",
            headers,
            body: JSON.stringify({
              action: "delete_slide",
              slideId,
            }),
          });

          const data = await res.json();
          if (res.ok && data.success) {
            toast.success("Store slide image deleted.");
            setSlides(data.slides || []);
          } else {
            toast.error(data.error || "Failed to delete slide image.");
          }
        } catch (err: any) {
          toast.error(err.message || "Network error deleting slide image.");
        } finally {
          setDeletingId(null);
        }
      }
    );
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

        {/* Top Header */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">storefront</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Storefront Manager</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Add products, gear, memberships, customize store slide banners, and configure border styles.
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
              href="/cpanel"
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Control Panel</span>
            </Link>
          </div>
        </div>

        {/* Navigation Tabs (Products vs Slides vs Settings) */}
        <div className="flex items-center gap-3 border-b border-gray-200/40 pb-2 overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setActiveTab("items")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "items"
                ? "bg-[#FC7A00] text-white shadow-sm"
                : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">inventory_2</span>
            <span>Store Products ({items.length})</span>
          </button>

          <Link
            href="/cpanel/store/orders"
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap bg-gradient-to-r from-orange-500 to-[#FC7A00] text-white shadow-sm hover:opacity-95"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">shopping_bag</span>
            <span>Dispatch Orders</span>
          </Link>

          <Link
            href="/cpanel/store/stock"
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap border border-orange-500/30 text-orange-600 dark:text-orange-400 bg-orange-500/10 hover:bg-orange-500/20"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">trending_up</span>
            <span>Stock Income</span>
          </Link>

          <Link
            href="/cpanel/store/categories"
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">category</span>
            <span>Manage Categories ({categories.length})</span>
          </Link>

          <button
            type="button"
            onClick={() => setActiveTab("slides")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "slides"
                ? "bg-[#FC7A00] text-white shadow-sm"
                : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">view_carousel</span>
            <span>Store Slides ({slides.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("settings")}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-2 whitespace-nowrap",
              activeTab === "settings"
                ? "bg-[#FC7A00] text-white shadow-sm"
                : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            )}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            <span>Store Settings</span>
          </button>
        </div>

        {/* TAB 1: Store Items Grid with Action Bar */}
        {activeTab === "items" && (
          <div className="space-y-4">
            <div className={cn("p-4 rounded-2xl border flex items-center justify-between gap-4", panelClass)}>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">inventory_2</span>
                <h3 className="font-extrabold text-sm uppercase">Products Directory ({items.length})</h3>
              </div>

              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 py-2.5 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Product</span>
              </button>
            </div>

            {/* Items Grid */}
            <div className="w-full">
              {isLoading ? (
                <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
                  <ButtonSpinner />
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Storefront Products...</p>
                </div>
              ) : items.length === 0 ? (
                <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
                  <span className="material-symbols-outlined text-[48px] text-gray-400">inventory_2</span>
                  <p className="text-xs font-black uppercase text-gray-400">No Store Products Added</p>
                  <p className="text-[11px] text-gray-500 max-w-md mx-auto">Use the form on the left to create and display items for end-users on the Store page.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {items.map((item) => {
                    const isDeleting = deletingId === item.id;
                    return (
                      <div key={item.id} className={cn("p-4 rounded-2xl border flex flex-col justify-between space-y-3 transition-all", panelClass)}>
                        <div className="space-y-3">
                          <div className="w-full h-36 rounded-xl border border-gray-200/50 bg-white overflow-hidden relative flex items-center justify-center">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                            ) : (
                              <span className="material-symbols-outlined text-[48px] text-gray-300">storefront</span>
                            )}
                            <span className="absolute top-2 right-2 px-2 py-0.5 rounded-lg text-[9px] font-black uppercase bg-black/70 text-white backdrop-blur-xs">
                              {item.category}
                            </span>
                          </div>

                          <div>
                            <div className="flex items-center justify-between gap-2">
                              <h4 className="font-extrabold text-xs uppercase tracking-tight truncate">{item.title}</h4>
                              <div className="text-right">
                                {item.discountPrice ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-mono text-[10px] text-gray-400 line-through">₦{item.price.toLocaleString()}</span>
                                    <span className="font-mono font-black text-sm text-emerald-600">₦{item.discountPrice.toLocaleString()}</span>
                                  </div>
                                ) : (
                                  <span className="font-mono font-black text-sm text-[#FC7A00]">₦{item.price.toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                            <p className="text-[10.5px] text-gray-400 font-medium line-clamp-2 mt-1 leading-relaxed">{item.description || "No description provided."}</p>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-200/40">
                          <span className={cn(
                            "px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border",
                            item.inStock ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" : "bg-red-500/10 text-red-500 border-red-500/20"
                          )}>
                            {item.inStock ? "IN STOCK" : "OUT OF STOCK"}
                          </span>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEditItem(item)}
                              className="text-[10px] font-bold text-[#FC7A00] hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">edit</span>
                              <span>Edit</span>
                            </button>

                            <button
                              type="button"
                              disabled={isDeleting}
                              onClick={() => handleDeleteItem(item.id)}
                              className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                            >
                              {isDeleting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[14px]">delete</span>}
                              <span>Delete</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 2: Store Slides Form & List */}
        {activeTab === "slides" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Add / Edit Slide Form */}
            <div className={cn("p-5 rounded-2xl border space-y-4 lg:col-span-1 h-fit", panelClass)}>
              <div className="flex items-center justify-between border-b border-gray-200/40 pb-3">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-orange-500 text-[20px]">add_photo_alternate</span>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">
                    {editingSlideId ? "Edit Store Banner Slide" : "Add Store Banner Slide"}
                  </h3>
                </div>
                {editingSlideId && (
                  <button
                    type="button"
                    onClick={resetSlideForm}
                    className="text-[10px] font-bold text-gray-400 hover:text-black dark:hover:text-white uppercase cursor-pointer"
                  >
                    Cancel Edit
                  </button>
                )}
              </div>

              <form onSubmit={handleAddSlide} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Slide Image URL or File</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Paste image URL (https://...)"
                      value={slideImageUrl}
                      onChange={(e) => setSlideImageUrl(e.target.value)}
                      className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all truncate", inputClass)}
                    />
                    <div className="relative flex-shrink-0">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadImageToImgBB(file, setSlideImageUrl, setIsUploadingSlideImage);
                        }}
                        disabled={isUploadingSlideImage}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                      />
                      <button
                        type="button"
                        disabled={isUploadingSlideImage}
                        className={cn("w-10 h-10 border rounded-xl flex items-center justify-center transition-all cursor-pointer", isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-700")}
                      >
                        {isUploadingSlideImage ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Crop vs Contain Fitting Control */}
                <div className="space-y-1.5 p-3 rounded-xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50">
                  <label className="text-[10px] font-black uppercase text-orange-500 block">
                    Image Fit & Size (Don&apos;t Cut Off)
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSlideIsCrop(true)}
                      className={cn(
                        "py-2 px-2.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                        slideIsCrop
                          ? "bg-[#FC7A00] text-white border-[#FC7A00]"
                          : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:text-black dark:hover:text-white"
                      )}
                    >
                      Cropped (Cover)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSlideIsCrop(false)}
                      className={cn(
                        "py-2 px-2.5 rounded-lg text-[10.5px] font-black uppercase tracking-wider border transition-all cursor-pointer",
                        !slideIsCrop
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700 hover:text-black dark:hover:text-white"
                      )}
                    >
                      Keep Size (Contain)
                    </button>
                  </div>
                  <p className="text-[9.5px] text-gray-400 font-medium leading-tight pt-0.5">
                    {slideIsCrop
                      ? "Cover mode crops outer edges to fill container without blank gaps."
                      : "Keep Size retains entire image without cutting off any details."}
                  </p>
                </div>

                {/* Bottom Space / Margin Selector */}
                <div className="space-y-1.5 p-3 rounded-xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">
                      Bottom Space / Margin
                    </label>
                    <span className="text-[11px] font-mono font-bold text-[#FC7A00]">
                      {slideMarginBottom}px
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="2"
                    value={slideMarginBottom}
                    onChange={(e) => setSlideMarginBottom(Number(e.target.value))}
                    className="w-full accent-[#FC7A00] cursor-pointer"
                  />
                  <div className="flex items-center justify-between text-[9px] text-gray-400 font-bold uppercase">
                    <span>0px (No Gap)</span>
                    <span>50px</span>
                    <span>100px</span>
                  </div>
                </div>

                {/* Heights Customization */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Mobile Height (px)</label>
                    <input
                      type="number"
                      min={100}
                      max={500}
                      value={slideMobileHeight}
                      onChange={(e) => setSlideMobileHeight(Number(e.target.value))}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Desktop Height (px)</label>
                    <input
                      type="number"
                      min={100}
                      max={800}
                      value={slideDesktopHeight}
                      onChange={(e) => setSlideDesktopHeight(Number(e.target.value))}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Slide Title</label>
                  <input
                    type="text"
                    placeholder="e.g. Exclusive E-Tech Gear!"
                    value={slideTitle}
                    onChange={(e) => setSlideTitle(e.target.value)}
                    className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Subtitle / Caption</label>
                  <input
                    type="text"
                    placeholder="e.g. Get 20% discount on all POS hardware."
                    value={slideSubtitle}
                    onChange={(e) => setSlideSubtitle(e.target.value)}
                    className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400 block">Target Action Link (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. /store, /support, or https://..."
                    value={slideLink}
                    onChange={(e) => setSlideLink(e.target.value)}
                    className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSavingSlide || isUploadingSlideImage}
                  className="w-full h-11 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingSlide ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">{editingSlideId ? "save" : "add_photo_alternate"}</span>}
                  <span>{editingSlideId ? "Save Slide Changes" : "Add Slide Banner"}</span>
                </button>
              </form>
            </div>

            {/* Slides List */}
            <div className="lg:col-span-2 space-y-4">
              {isLoading ? (
                <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
                  <ButtonSpinner />
                  <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Store Slides...</p>
                </div>
              ) : slides.length === 0 ? (
                <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
                  <span className="material-symbols-outlined text-[48px] text-gray-400">view_carousel</span>
                  <p className="text-xs font-black uppercase text-gray-400">No Store Slides Added</p>
                  <p className="text-[11px] text-gray-500 max-w-md mx-auto">Upload slideshow banner images to showcase store promotions to end-users.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {slides.map((slide) => {
                    const isDeleting = deletingId === slide.id;
                    return (
                      <div key={slide.id} className={cn("p-4 rounded-2xl border flex flex-col md:flex-row gap-4 items-center justify-between transition-all", panelClass)}>
                        <div className="flex items-center gap-4 flex-1 min-w-0">
                          <div className="w-28 h-16 rounded-xl border border-gray-200/50 bg-white overflow-hidden flex-shrink-0 relative">
                            <img
                              src={slide.imageUrl}
                              alt={slide.title || "Slide"}
                              className={cn("w-full h-full", slide.isCrop !== false ? "object-cover" : "object-contain bg-gray-900")}
                            />
                            <span className={cn(
                              "absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase text-white backdrop-blur-xs",
                              slide.isCrop !== false ? "bg-black/70" : "bg-emerald-600/90"
                            )}>
                              {slide.isCrop !== false ? "Cropped" : "Keep Size"}
                            </span>
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <h4 className="font-extrabold text-xs uppercase tracking-tight truncate">{slide.title || "Untitled Slide"}</h4>
                            <p className="text-[11px] text-gray-400 font-medium truncate">{slide.subtitle || "No subtitle provided."}</p>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold text-gray-500">
                              <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700">
                                Gap: {slide.marginBottom !== undefined ? slide.marginBottom : 20}px
                              </span>
                              <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 border border-gray-200/50 dark:border-gray-700">
                                Height: {slide.mobileHeight || 176}px / {slide.desktopHeight || 220}px
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleStartEditSlide(slide)}
                            className="px-3 h-9 border border-orange-500/30 text-[#FC7A00] bg-orange-500/10 hover:bg-orange-500/20 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[15px]">edit</span>
                            <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            disabled={isDeleting}
                            onClick={() => handleDeleteSlide(slide.id)}
                            className="px-3 h-9 bg-red-600/10 hover:bg-red-600/20 text-red-500 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer flex items-center gap-1.5"
                          >
                            {isDeleting ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[16px]">delete</span>}
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 3: Storefront Settings */}
        {activeTab === "settings" && (
          <div className="max-w-xl mx-auto">
            <div className={cn("p-6 rounded-2xl border space-y-5", panelClass)}>
              <div className="flex items-center gap-2 border-b border-gray-200/40 pb-3">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">tune</span>
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wider">Store Name, Brand Logo & Display Configurations</h3>
                  <p className="text-[10.5px] text-gray-400">Customize search bar top space, slide display settings, storefront name, header logo, and product styling.</p>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="space-y-4">

                {/* Search Bar Top Space Adjustment Slider */}
                <div className="p-4 rounded-2xl border border-orange-500/20 bg-orange-500/5 space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-extrabold uppercase text-[#FC7A00] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[18px]">search</span>
                      Search Bar Top Space / Margin ({searchBarMarginTop}px)
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
                  <div className="flex justify-between text-[9px] font-bold text-gray-400 uppercase">
                    <span>0px (Flush)</span>
                    <span>50px</span>
                    <span>100px (Extra Space)</span>
                  </div>
                  <p className="text-[10px] text-gray-400 font-medium leading-tight pt-1">
                    Adjust space above the search input on the Store page.
                  </p>
                </div>

                {/* Slide Display Configurations */}
                <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-3.5">
                  <span className="text-xs font-extrabold uppercase text-gray-800 dark:text-gray-200 block border-b border-gray-200/40 pb-2">
                    Store Slideshow Display Settings
                  </span>

                  {/* Remove Overlay Fade */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">Overlay Fade Gradient</span>
                    <button
                      type="button"
                      onClick={() => setBannerOverlayFadeEnabled(!bannerOverlayFadeEnabled)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                        bannerOverlayFadeEnabled
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                          : "bg-gray-200 dark:bg-gray-800 border-gray-300 text-gray-600"
                      )}
                    >
                      {bannerOverlayFadeEnabled ? "Fade Active" : "Fade Removed"}
                    </button>
                  </div>

                  {/* Slideshow Interval */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Slideshow Autoplay Interval (Seconds)</label>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      value={bannerSlideIntervalSeconds}
                      onChange={(e) => setBannerSlideIntervalSeconds(Number(e.target.value))}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>

                  {/* Transition Effect */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Slide Transition Effect</label>
                    <select
                      value={bannerSlideEffect}
                      onChange={(e) => setBannerSlideEffect(e.target.value as "fade" | "slide")}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border cursor-pointer w-full", inputClass)}
                    >
                      <option value="fade">Seamless Cross-Fade</option>
                      <option value="slide">Smooth Slide-In (Right-to-Left)</option>
                    </select>
                  </div>

                  {/* Image Size Mode (Cover vs Contain) */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Global Image Size Mode</label>
                    <select
                      value={bannerImageMode}
                      onChange={(e) => setBannerImageMode(e.target.value as "cover" | "contain")}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border cursor-pointer w-full", inputClass)}
                    >
                      <option value="cover">Crop to Fit Container (Cover)</option>
                      <option value="contain">Keep Full Image Aspect Ratio (Contain - Don&apos;t Cut Off)</option>
                    </select>
                  </div>

                  {/* Crop Position Alignment */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Crop Alignment Position</label>
                    <select
                      value={bannerImagePosition}
                      onChange={(e) => setBannerImagePosition(e.target.value)}
                      className={cn("h-9 px-3 rounded-xl text-xs font-semibold outline-none border cursor-pointer w-full", inputClass)}
                    >
                      <option value="center">Center</option>
                      <option value="top">Top</option>
                      <option value="bottom">Bottom</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  {/* Slide Indicator Dots Toggle */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">Slide Indicator Dots</span>
                    <button
                      type="button"
                      onClick={() => setBannerShowIndicators(!bannerShowIndicators)}
                      className={cn(
                        "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                        bannerShowIndicators
                          ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                          : "bg-gray-200 dark:bg-gray-800 border-gray-300 text-gray-600"
                      )}
                    >
                      {bannerShowIndicators ? "Dots Visible" : "Dots Hidden"}
                    </button>
                  </div>

                  {/* Banner Background Color & Border Controls */}
                  <div className="space-y-2 pt-2 border-t border-gray-200/40">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Banner Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={bannerBackgroundColor}
                        onChange={(e) => setBannerBackgroundColor(e.target.value)}
                        className="w-10 h-9 rounded-lg border border-gray-300 p-0.5 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={bannerBackgroundColor}
                        onChange={(e) => setBannerBackgroundColor(e.target.value)}
                        placeholder="#111827"
                        className={cn("h-9 px-2 rounded-lg text-xs font-mono font-bold uppercase outline-none border transition-all w-full", inputClass)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase text-gray-600 dark:text-gray-300">Banner Border</span>
                      <button
                        type="button"
                        onClick={() => setBannerBorderEnabled(!bannerBorderEnabled)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                          bannerBorderEnabled
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-gray-200 dark:bg-gray-800 border-gray-300 text-gray-600"
                        )}
                      >
                        {bannerBorderEnabled ? "Border Active" : "Border Disabled"}
                      </button>
                    </div>

                    {bannerBorderEnabled && (
                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="color"
                          value={bannerBorderColor}
                          onChange={(e) => setBannerBorderColor(e.target.value)}
                          className="w-10 h-9 rounded-lg border border-gray-300 p-0.5 cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          value={bannerBorderColor}
                          onChange={(e) => setBannerBorderColor(e.target.value)}
                          placeholder="#FC7A00"
                          className={cn("h-9 px-2 rounded-lg text-xs font-mono font-bold uppercase outline-none border transition-all w-full", inputClass)}
                        />
                      </div>
                    )}
                  </div>
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

                {/* Product Border Color & Gradient Settings */}
                <div className="p-4 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold uppercase text-gray-800 dark:text-gray-200 block">Product Card Border Style</span>
                      <span className="text-[10px] text-gray-400 font-medium">Configure single color or multi-color gradient border</span>
                    </div>
                  </div>

                  {/* Enable Gradient Border Toggle */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200/50 bg-white dark:bg-gray-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={enableGradientBorder}
                      onChange={(e) => setEnableGradientBorder(e.target.checked)}
                      className="w-4 h-4 text-[#FC7A00] rounded"
                    />
                    <div>
                      <span className="text-xs font-bold uppercase text-gray-800 dark:text-gray-200 block">Enable Gradient Border</span>
                      <span className="text-[9.5px] text-gray-400 font-medium">Renders product card borders with a multi-color gradient</span>
                    </div>
                  </label>

                  {enableGradientBorder ? (
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 block">Gradient Start Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={gradientColorStart}
                            onChange={(e) => setGradientColorStart(e.target.value)}
                            className="w-10 h-9 rounded-lg border border-gray-300 p-0.5 cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={gradientColorStart}
                            onChange={(e) => setGradientColorStart(e.target.value)}
                            className={cn("h-9 px-2 rounded-lg text-xs font-mono font-bold uppercase outline-none border transition-all w-full", inputClass)}
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-gray-400 block">Gradient End Color</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={gradientColorEnd}
                            onChange={(e) => setGradientColorEnd(e.target.value)}
                            className="w-10 h-9 rounded-lg border border-gray-300 p-0.5 cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={gradientColorEnd}
                            onChange={(e) => setGradientColorEnd(e.target.value)}
                            className={cn("h-9 px-2 rounded-lg text-xs font-mono font-bold uppercase outline-none border transition-all w-full", inputClass)}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-1">
                      <label className="text-[10px] font-black uppercase text-gray-400 block">Solid Border Color & Opacity</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          value={borderColor}
                          onChange={(e) => setBorderColor(e.target.value)}
                          className="w-12 h-10 rounded-xl border border-gray-300 p-1 cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          value={borderColor}
                          onChange={(e) => setBorderColor(e.target.value)}
                          placeholder="#FC7A00"
                          className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-mono font-bold uppercase outline-none border transition-all", inputClass)}
                        />
                      </div>

                      {/* Border Opacity Slider */}
                      <div className="space-y-1.5 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                        <div className="flex justify-between items-center text-[10.5px] font-bold">
                          <span className="text-gray-500 dark:text-gray-400 uppercase">Product Border Opacity</span>
                          <span className="font-mono text-[#FC7A00] font-black">{borderOpacity}%</span>
                        </div>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="5"
                          value={borderOpacity}
                          onChange={(e) => setBorderOpacity(Number(e.target.value))}
                          className="w-full accent-[#FC7A00] cursor-pointer"
                        />
                        <div className="flex justify-between text-[8.5px] font-bold text-gray-400 uppercase">
                          <span>0% (Transparent)</span>
                          <span>50%</span>
                          <span>100% (Solid)</span>
                        </div>
                      </div>

                      {/* Preset Colors */}
                      <div className="flex items-center gap-2 pt-1">
                        {["#FC7A00", "#000000", "#10B981", "#3B82F6", "#EC4899", "#8B5CF6", "#E5E7EB"].map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setBorderColor(c)}
                            className="w-6 h-6 rounded-full border-2 border-white shadow-xs cursor-pointer transition-transform hover:scale-110"
                            style={{ backgroundColor: c }}
                            title={c}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recently Viewed Product Cards Border Control */}
                  <div className="pt-3 border-t border-gray-200/40 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-extrabold uppercase text-gray-800 dark:text-gray-200 block">Recently Viewed Cards Border</span>
                        <span className="text-[9.5px] text-gray-400 font-medium">Border styling for horizontal recently viewed product cards</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRecentlyViewedBorderEnabled(!recentlyViewedBorderEnabled)}
                        className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase border transition-all cursor-pointer",
                          recentlyViewedBorderEnabled
                            ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                            : "bg-gray-200 dark:bg-gray-800 border-gray-300 text-gray-600"
                        )}
                      >
                        {recentlyViewedBorderEnabled ? "Border Active" : "No Border"}
                      </button>
                    </div>

                    {recentlyViewedBorderEnabled && (
                      <div className="space-y-2.5 pt-1">
                        <div className="flex items-center gap-2">
                          <input
                            type="color"
                            value={recentlyViewedBorderColor}
                            onChange={(e) => setRecentlyViewedBorderColor(e.target.value)}
                            className="w-10 h-9 rounded-lg border border-gray-300 p-0.5 cursor-pointer bg-white"
                          />
                          <input
                            type="text"
                            value={recentlyViewedBorderColor}
                            onChange={(e) => setRecentlyViewedBorderColor(e.target.value)}
                            placeholder="#FC7A00"
                            className={cn("h-9 px-2 rounded-lg text-xs font-mono font-bold uppercase outline-none border transition-all w-full", inputClass)}
                          />
                        </div>

                        <div className="space-y-1.5 p-2.5 rounded-xl bg-gray-100 dark:bg-gray-800">
                          <div className="flex justify-between items-center text-[10.5px] font-bold">
                            <span className="text-gray-500 dark:text-gray-400 uppercase">Recently Viewed Border Opacity</span>
                            <span className="font-mono text-[#FC7A00] font-black">{recentlyViewedBorderOpacity}%</span>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={recentlyViewedBorderOpacity}
                            onChange={(e) => setRecentlyViewedBorderOpacity(Number(e.target.value))}
                            className="w-full accent-[#FC7A00] cursor-pointer"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Hide Product Borders Toggle */}
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200/50 bg-white dark:bg-gray-800 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={hideBorders}
                      onChange={(e) => setHideBorders(e.target.checked)}
                      className="w-4 h-4 text-[#FC7A00] rounded"
                    />
                    <div>
                      <span className="text-xs font-extrabold uppercase text-gray-800 dark:text-gray-200 block">Hide Card Borders Completely</span>
                      <span className="text-[9.5px] text-gray-400 font-medium">When checked, product cards render without any border line.</span>
                    </div>
                  </label>
                </div>

                {/* Order Processing Statuses Manager */}
                <div className="space-y-3 pt-4 border-t border-gray-200/40">
                  <div>
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Custom Order Processing Statuses</label>
                    <p className="text-[10.5px] text-gray-400">Add custom status tags for your order fulfillment workflow.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {orderStatuses.map((st) => (
                      <span key={st} className="px-3 py-1 rounded-xl bg-orange-50 dark:bg-gray-800 text-[#FC7A00] dark:text-orange-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-orange-200/60 dark:border-gray-700">
                        {st}
                        {st !== "Pending" && st !== "Delivered" && (
                          <button
                            type="button"
                            onClick={() => setOrderStatuses(orderStatuses.filter((s) => s !== st))}
                            className="text-gray-400 hover:text-red-500 font-bold"
                          >
                            ×
                          </button>
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newStatusInput}
                      onChange={(e) => setNewStatusInput(e.target.value)}
                      placeholder="Add custom status (e.g. In Transit, Verification...)"
                      className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-semibold outline-none border", inputClass)}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const trimmed = newStatusInput.trim();
                        if (trimmed && !orderStatuses.includes(trimmed)) {
                          setOrderStatuses([...orderStatuses, trimmed]);
                          setNewStatusInput("");
                        }
                      }}
                      className="px-4 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-[#FC7A00] hover:text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
                    >
                      Add
                    </button>
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
        )}

      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className={cn("w-[92vw] sm:w-full max-w-sm p-6 rounded-3xl border text-center shadow-2xl space-y-4", panelClass)}>
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto border",
              confirmModal.actionStyle === "danger" && "bg-red-50 text-red-500 border-red-200 dark:bg-red-950/40 dark:border-red-900/50"
            )}>
              <span className="material-symbols-outlined text-[24px]">gpp_maybe</span>
            </div>

            <div>
              <h4 className="font-extrabold text-sm uppercase text-gray-900 dark:text-white">{confirmModal.title}</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 font-medium leading-relaxed">{confirmModal.message}</p>
            </div>

            <div className="grid grid-cols-2 gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
                className="py-2.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 rounded-xl text-xs font-black uppercase cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmModal((prev) => ({ ...prev, isOpen: false }));
                  confirmModal.onConfirm();
                }}
                className="py-2.5 bg-red-600 text-white rounded-xl text-xs font-black uppercase cursor-pointer hover:bg-red-700"
              >
                {confirmModal.actionLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Standalone Product Add/Edit Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm overflow-y-auto">
          <div className={cn("w-[94vw] sm:w-full max-w-xl p-4 sm:p-6 rounded-3xl border shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col justify-between", panelClass)}>
            <div className="flex items-center justify-between border-b border-gray-200/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">
                  {editingItemId ? "edit_note" : "add_box"}
                </span>
                <h3 className="font-extrabold text-sm uppercase tracking-wider">
                  {editingItemId ? "Edit Product" : "Add Store Product"}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsProductModalOpen(false);
                  resetItemForm();
                }}
                className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-left">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. E-Tech POS Terminal V2"
                  value={itemTitle}
                  onChange={(e) => setItemTitle(e.target.value)}
                  className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                />
              </div>

              {/* Category & Pricing Fields */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Category</label>
                    <Link href="/cpanel/store/categories" className="text-[9.5px] font-bold text-[#FC7A00] hover:underline">
                      + Manage Categories
                    </Link>
                  </div>
                  <select
                    value={itemCategory}
                    onChange={(e) => setItemCategory(e.target.value)}
                    className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border cursor-pointer w-full", inputClass)}
                  >
                    {categories.length > 0 ? (
                      categories.filter((c) => c.name !== "ALL").map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="Electronics">Electronics</option>
                        <option value="Fashion">Fashion</option>
                        <option value="Airtime & Utilities">Airtime & Utilities</option>
                        <option value="Gift Cards">Gift Cards</option>
                        <option value="Gadgets & Phones">Gadgets & Phones</option>
                        <option value="General">General</option>
                      </>
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Cost Price (₦)</label>
                    <input
                      type="number"
                      placeholder="Wholesale cost"
                      value={itemCostPrice}
                      onChange={(e) => setItemCostPrice(e.target.value)}
                      className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-[#FC7A00] block">Selling Price (₦) *</label>
                    <input
                      type="number"
                      required
                      placeholder="Standard price"
                      value={itemPrice}
                      onChange={(e) => setItemPrice(e.target.value)}
                      className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-emerald-500 block">Discount Price (₦)</label>
                    <input
                      type="number"
                      placeholder="Sale price"
                      value={itemDiscountPrice}
                      onChange={(e) => setItemDiscountPrice(e.target.value)}
                      className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>
                </div>
              </div>

              {/* Stock Quantity & Unlimited Stock Controls */}
              <div className="p-3.5 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold uppercase text-[#FC7A00]">Inventory & Stock Control</span>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={itemUnlimitedStock}
                      onChange={(e) => {
                        setItemUnlimitedStock(e.target.checked);
                        if (e.target.checked) setItemStockQuantity("");
                      }}
                      className="w-4 h-4 text-[#FC7A00] rounded"
                    />
                    <span className="text-[11px] font-bold text-gray-600 dark:text-gray-300">Unlimited Stock (No Quantity Cap)</span>
                  </label>
                </div>

                {!itemUnlimitedStock && (
                  <div className="space-y-1">
                    <label className="text-[10px] font-black uppercase text-gray-400 block">Available Units / Stock Count</label>
                    <input
                      type="number"
                      min={0}
                      required={!itemUnlimitedStock}
                      placeholder="e.g. 50"
                      value={itemStockQuantity}
                      onChange={(e) => setItemStockQuantity(e.target.value)}
                      className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                    />
                  </div>
                )}
              </div>

              {/* Multiple Images Upload Manager */}
              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase text-gray-400 block">
                  Product Images ({itemImages.length})
                </label>

                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Paste image URL (https://...)"
                    value={newImageInput}
                    onChange={(e) => setNewImageInput(e.target.value)}
                    className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all truncate", inputClass)}
                  />
                  <button
                    type="button"
                    onClick={() => handleAddImageToProduct(newImageInput)}
                    className="px-3 h-10 bg-gray-100 dark:bg-gray-800 hover:bg-[#FC7A00] hover:text-white rounded-xl text-xs font-bold uppercase transition-all cursor-pointer"
                  >
                    + Add
                  </button>
                  <div className="relative flex-shrink-0">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          uploadImageToImgBB(file, (uploadedUrl) => {
                            handleAddImageToProduct(uploadedUrl);
                          }, setIsUploadingItemImage);
                        }
                      }}
                      disabled={isUploadingItemImage}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                    />
                    <button
                      type="button"
                      disabled={isUploadingItemImage}
                      className={cn("w-10 h-10 border rounded-xl flex items-center justify-center transition-all cursor-pointer", isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-700")}
                    >
                      {isUploadingItemImage ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                    </button>
                  </div>
                </div>

                {/* Thumbnail gallery list with Cover Image selector */}
                {itemImages.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 pt-1">
                    {itemImages.map((imgUrl, idx) => {
                      const isCover = itemCoverUrl === imgUrl || (!itemCoverUrl && idx === 0);
                      return (
                        <div
                          key={idx}
                          className={cn(
                            "relative h-16 rounded-xl border overflow-hidden group bg-white flex items-center justify-center",
                            isCover ? "border-[#FC7A00] ring-2 ring-[#FC7A00]/40" : "border-gray-200"
                          )}
                        >
                          <img src={imgUrl} alt={`Thumbnail ${idx}`} className="w-full h-full object-cover" />
                          {isCover && (
                            <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded text-[7.5px] font-black uppercase bg-[#FC7A00] text-white">
                              COVER
                            </span>
                          )}
                          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                            {!isCover && (
                              <button
                                type="button"
                                onClick={() => setItemCoverUrl(imgUrl)}
                                className="p-1 bg-[#FC7A00] text-white rounded text-[8px] font-bold uppercase cursor-pointer"
                                title="Set Cover Image"
                              >
                                Cover
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleRemoveImageFromProduct(idx)}
                              className="p-1 bg-red-600 text-white rounded text-[8px] font-bold cursor-pointer"
                              title="Remove Image"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Product Video URL Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Product Video URL (YouTube or Direct MP4)</label>
                <input
                  type="text"
                  placeholder="e.g. https://www.youtube.com/watch?v=... or .mp4"
                  value={itemVideoUrl}
                  onChange={(e) => setItemVideoUrl(e.target.value)}
                  className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all w-full", inputClass)}
                />
              </div>

              {/* Auto Slide ON/OFF Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-200/50 bg-gray-50/50">
                <div>
                  <span className="text-xs font-extrabold uppercase block">Auto Slide Gallery</span>
                  <span className="text-[9.5px] text-gray-400">Auto advance product image slides for users</span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={itemAutoSlide}
                    onChange={(e) => setItemAutoSlide(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#FC7A00]" />
                </label>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 block">Description</label>
                <textarea
                  placeholder="Enter short details about this item..."
                  value={itemDescription}
                  onChange={(e) => setItemDescription(e.target.value)}
                  className={cn("w-full h-20 p-3 rounded-xl text-xs font-semibold outline-none border transition-all resize-none", inputClass)}
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={itemInStock}
                  onChange={(e) => setItemInStock(e.target.checked)}
                  className="w-4 h-4 text-[#FC7A00] rounded"
                />
                <span className="text-xs font-bold uppercase text-gray-400">In Stock for Ordering</span>
              </label>

              <div className="flex justify-end gap-3 pt-3 border-t border-gray-200/40">
                <button
                  type="button"
                  onClick={() => {
                    setIsProductModalOpen(false);
                    resetItemForm();
                  }}
                  className="px-4 h-10 bg-gray-200 dark:bg-gray-800 text-xs font-bold uppercase rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingItem || isUploadingItemImage}
                  className="px-6 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white text-xs font-bold uppercase rounded-xl flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingItem ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">{editingItemId ? "save" : "add"}</span>}
                  <span>{editingItemId ? "Save Product Changes" : "Add Product"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
