"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";
import { uploadImageSecurely } from "@/lib/image-upload";

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelEstateSlidesPage() {
  const { isDark, toggleTheme } = useCpanelTheme();
  const [slides, setSlides] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Slide Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSlide, setEditingSlide] = useState<any | null>(null);
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [badgeText, setBadgeText] = useState("Featured Property");
  const [order, setOrder] = useState("0");
  const [isHidden, setIsHidden] = useState(false);

  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchSlides = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/slides");
      const data = await res.json();
      if (data.success && Array.isArray(data.slides)) {
        setSlides(data.slides);
      } else {
        toast.error("Failed to load estate slides.");
      }
    } catch {
      toast.error("Network error loading slides.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSlides();
  }, []);

  const handleOpenAddModal = () => {
    setEditingSlide(null);
    setTitle("");
    setSubtitle("");
    setImageUrl("");
    setTargetUrl("");
    setBadgeText("Featured Property");
    setOrder(String(slides.length));
    setIsHidden(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (s: any) => {
    setEditingSlide(s);
    setTitle(s.title || "");
    setSubtitle(s.subtitle || "");
    setImageUrl(s.imageUrl || "");
    setTargetUrl(s.targetUrl || "");
    setBadgeText(s.badgeText || "Featured Property");
    setOrder(String(s.order || 0));
    setIsHidden(!!s.isHidden);
    setIsModalOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingImage(true);
    try {
      const res = await uploadImageSecurely(file, "estate_slide_banner");
      if (res.success && res.url) {
        setImageUrl(res.url);
        toast.success("Slide banner image uploaded!");
      } else {
        toast.error(res.error || "Failed to upload slide image.");
      }
    } catch {
      toast.error("Error uploading slide banner image.");
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleSaveSlide = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl.trim()) {
      toast.error("Slide banner image is required.");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/estate/admin/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slideId: editingSlide?.id,
          title,
          subtitle,
          imageUrl,
          targetUrl,
          badgeText,
          order: Number(order) || 0,
          isHidden,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Slide saved successfully!");
        setIsModalOpen(false);
        fetchSlides();
      } else {
        toast.error(data.error || "Failed to save slide.");
      }
    } catch {
      toast.error("Network error saving slide.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleVisibility = async (slideId: string) => {
    try {
      const res = await fetch("/api/estate/admin/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle_visibility", slideId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchSlides();
      }
    } catch {
      toast.error("Failed to toggle slide visibility.");
    }
  };

  const handleDeleteSlide = async (slideId: string) => {
    if (!confirm("Are you sure you want to permanently delete this estate slide?")) return;
    try {
      const res = await fetch("/api/estate/admin/slides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete", slideId }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchSlides();
      }
    } catch {
      toast.error("Failed to delete slide.");
    }
  };

  const filteredSlides = slides.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (s.title && s.title.toLowerCase().includes(q)) ||
      (s.subtitle && s.subtitle.toLowerCase().includes(q)) ||
      (s.badgeText && s.badgeText.toLowerCase().includes(q))
    );
  });

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300 space-y-6", bgClass)}>
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Sticky Top Header Bar */}
          <div className={cn("sticky top-0 z-30 p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md shadow-xs", panelClass)}>
            <div className="flex items-center gap-3">
              <Link
                href="/cpanel"
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">view_carousel</span>
                  <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Estate Slides & Banners</h1>
                </div>
                <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                  Manage promo slideshow banners rendered at the top of the E-Global Estate home page.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleOpenAddModal}
                className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border-0"
              >
                <span className="material-symbols-outlined text-[18px]">add_photo_alternate</span>
                <span>Add New Slide</span>
              </button>
            </div>
          </div>

          {/* Directory Grid */}
          {isLoading ? (
            <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
              <ButtonSpinner />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Estate Slides...</p>
            </div>
          ) : filteredSlides.length === 0 ? (
            <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
              <span className="material-symbols-outlined text-[48px] text-gray-400">view_carousel</span>
              <p className="text-xs font-black uppercase text-gray-400">No Slides Found</p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                Create new slideshow banners to showcase top property deals or announcements on E-Global Estate.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {filteredSlides.map((slide) => (
                <div key={slide.id} className={cn("rounded-3xl border p-4 space-y-3 flex flex-col justify-between shadow-xs relative overflow-hidden", panelClass)}>
                  <div className="space-y-2">
                    <div className="w-full h-40 rounded-2xl overflow-hidden relative bg-black/10 border border-gray-200 dark:border-gray-800">
                      <img src={slide.imageUrl} alt={slide.title || "Slide"} className="w-full h-full object-cover" />
                      <span className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/80 text-white backdrop-blur-xs">
                        {slide.badgeText || "Featured"}
                      </span>
                      {slide.isHidden && (
                        <span className="absolute top-2.5 right-2.5 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-red-600 text-white shadow-xs">
                          Hidden
                        </span>
                      )}
                    </div>

                    <div>
                      <h4 className="font-extrabold text-sm text-[#FC7A00] truncate">{slide.title || "Untitled Slide Banner"}</h4>
                      <p className="text-[11px] text-gray-400 font-medium line-clamp-1">{slide.subtitle || "No subtitle tag"}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-2">
                    <span className="font-mono text-[10px] font-extrabold text-gray-400 uppercase">Order: #{slide.order || 0}</span>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleVisibility(slide.id)}
                        className={cn("px-2.5 py-1 rounded-xl text-[10px] font-black uppercase border-0 cursor-pointer", slide.isHidden ? "bg-emerald-600 text-white" : "bg-amber-600 text-white")}
                      >
                        {slide.isHidden ? "Show" : "Hide"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(slide)}
                        className="px-2.5 py-1 bg-gray-200 dark:bg-gray-800 hover:bg-gray-300 text-gray-800 dark:text-gray-200 font-black text-[10px] uppercase rounded-xl cursor-pointer border-0"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSlide(slide.id)}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[10px] uppercase rounded-xl cursor-pointer border-0"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add / Edit Slide Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={cn("w-full max-w-lg p-6 space-y-4 rounded-3xl border shadow-2xl text-left max-h-[85vh] overflow-y-auto no-scrollbar", panelClass)}>
                <div className="flex items-center justify-between border-b pb-3 border-gray-200 dark:border-gray-800">
                  <h3 className="font-extrabold text-sm uppercase text-[#FC7A00]">
                    {editingSlide ? "Edit Estate Slide Banner" : "Add Estate Slide Banner"}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center border-0 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSaveSlide} className="space-y-4 text-xs font-semibold">
                  <div>
                    <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-1">Slide Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Luxury Lekki Phase 1 Apartments"
                      className={cn("w-full p-3.5 rounded-2xl outline-none font-bold border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                    />
                  </div>

                  <div>
                    <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-1">Subtitle Tagline</label>
                    <input
                      type="text"
                      value={subtitle}
                      onChange={(e) => setSubtitle(e.target.value)}
                      placeholder="e.g. Special weekend discounts on short-let rentals"
                      className={cn("w-full p-3.5 rounded-2xl outline-none font-medium border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-1">Badge Text Tag</label>
                      <input
                        type="text"
                        value={badgeText}
                        onChange={(e) => setBadgeText(e.target.value)}
                        placeholder="e.g. Verified Listing"
                        className={cn("w-full p-3.5 rounded-2xl outline-none font-bold border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                      />
                    </div>

                    <div>
                      <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-1">Order Index</label>
                      <input
                        type="number"
                        value={order}
                        onChange={(e) => setOrder(e.target.value)}
                        className={cn("w-full p-3.5 rounded-2xl outline-none font-bold border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10.5px] font-black uppercase text-gray-400 block mb-1">Target Click URL (Optional)</label>
                    <input
                      type="url"
                      value={targetUrl}
                      onChange={(e) => setTargetUrl(e.target.value)}
                      placeholder="e.g. https://domain.com/listing-123"
                      className={cn("w-full p-3.5 rounded-2xl outline-none font-medium border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-[10.5px] font-black uppercase text-gray-400 block">Banner Image *</label>
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isUploadingImage}
                        className="px-3 py-1 bg-[#FC7A00] text-white text-[10px] font-black uppercase rounded-lg border-0 cursor-pointer disabled:opacity-50"
                      >
                        {isUploadingImage ? "Uploading..." : "Upload Banner"}
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                    </div>

                    {imageUrl ? (
                      <div className="w-full h-36 rounded-2xl overflow-hidden relative border border-gray-200 bg-black/10">
                        <img src={imageUrl} alt="Banner Preview" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <input
                        type="url"
                        required
                        value={imageUrl}
                        onChange={(e) => setImageUrl(e.target.value)}
                        placeholder="https://..."
                        className={cn("w-full p-3.5 rounded-2xl outline-none font-mono text-xs border", isDark ? "bg-gray-950 border-gray-800 text-white" : "bg-gray-50 border-gray-200 text-black")}
                      />
                    )}
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="checkbox"
                      id="slide-hidden"
                      checked={isHidden}
                      onChange={(e) => setIsHidden(e.target.checked)}
                      className="w-4 h-4 rounded text-[#FC7A00] focus:ring-[#FC7A00]"
                    />
                    <label htmlFor="slide-hidden" className="text-xs font-bold cursor-pointer">
                      Hide this slide from marketplace home page
                    </label>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsModalOpen(false)}
                      className="w-1/3 py-3 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase rounded-2xl border-0 cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving || isUploadingImage}
                      className="w-2/3 py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white font-black text-xs uppercase rounded-2xl border-0 cursor-pointer shadow-md disabled:opacity-50 flex items-center justify-center gap-1.5"
                    >
                      {isSaving ? <ButtonSpinner /> : "Save Slide Banner"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

        </div>
      </div>
    </CpanelRouteGuard>
  );
}
