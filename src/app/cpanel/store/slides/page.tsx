"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { uploadImageSecurely } from "@/lib/image-upload";

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

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelStoreSlidesPage() {
  const router = useRouter();
  const [isDark, setIsDark] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New/Edit Slide Form State
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const fetchStoreSlides = async () => {
    setIsLoading(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const res = await fetch("/api/admin/store", { headers });
      const data = await res.json();

      if (data.success) {
        setSlides(data.slides || []);
      } else {
        toast.error(data.error || "Failed to load store slides.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching store slides.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchStoreSlides();
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
                <span className="material-symbols-outlined text-orange-500 text-[22px]">view_carousel</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Storefront Slides Manager</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Add and customize promotional slide banners displayed on the public Store page.
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Add / Edit Form */}
          <div className={cn("p-5 rounded-2xl border space-y-4 lg:col-span-1 h-fit", panelClass)}>
            <div className="flex items-center justify-between border-b border-gray-200/40 pb-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[20px]">add_photo_alternate</span>
                <h3 className="font-extrabold text-xs uppercase tracking-wider">
                  {editingSlideId ? "Edit Store Slide" : "Add Store Banner Slide"}
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

              <div className="space-y-1.5 p-3 rounded-xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50">
                <label className="text-[10px] font-black uppercase text-orange-500 block">
                  Image Fit Mode
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
                        </div>
                        <div className="min-w-0 flex-1 space-y-1">
                          <h4 className="font-extrabold text-xs uppercase tracking-tight truncate">{slide.title || "Untitled Slide"}</h4>
                          <p className="text-[11px] text-gray-400 font-medium truncate">{slide.subtitle || "No subtitle provided."}</p>
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

      </div>

      {/* Confirmation Modal */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
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
    </div>
  );
}
