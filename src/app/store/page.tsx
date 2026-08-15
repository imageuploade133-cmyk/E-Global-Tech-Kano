"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";

interface StoreItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  inStock: boolean;
}

interface StoreSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
  link: string;
}

export default function StorePage() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [items, setItems] = useState<StoreItem[]>([]);
  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Order modal state
  const [selectedItem, setSelectedItem] = useState<StoreItem | null>(null);

  // Fetch Storefront Data
  useEffect(() => {
    async function fetchStore() {
      setIsLoading(true);
      try {
        const res = await fetch("/api/store");
        const data = await res.json();
        if (data.success) {
          setItems(data.items || []);
          setSlides(data.slides || []);
        }
      } catch (err) {
        console.error("Failed to load store data:", err);
      } finally {
        setIsLoading(false);
      }
    }
    fetchStore();
  }, []);

  // Slide autoplay interval
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  const categories = ["ALL", "Hardware", "Memberships", "E-Tech Gear", "Subscriptions"];

  const filteredItems = items.filter((item) => {
    if (activeCategory === "ALL") return true;
    return item.category.toLowerCase() === activeCategory.toLowerCase();
  });

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Header Section */}
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                storefront
              </span>
            </div>
            <div>
              <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black">
                E-Tech Store
              </h1>
              <p className="font-hanken text-[11px] text-gray-500 font-medium">
                Premium boutique products & hardware
              </p>
            </div>
          </div>

          {/* Dynamic Store Slideshow Banners */}
          {slides.length > 0 && (
            <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-6 border border-gray-150 shadow-sm bg-black">
              <AnimatePresence mode="wait">
                <motion.div
                  key={slides[activeSlideIndex]?.id || activeSlideIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  className="absolute inset-0 w-full h-full"
                >
                  <img
                    src={slides[activeSlideIndex].imageUrl}
                    alt={slides[activeSlideIndex].title || "Store Slide"}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent p-4 flex flex-col justify-end text-left text-white">
                    {slides[activeSlideIndex].title && (
                      <h3 className="font-hanken font-extrabold text-sm uppercase tracking-tight text-[#FC7A00]">
                        {slides[activeSlideIndex].title}
                      </h3>
                    )}
                    {slides[activeSlideIndex].subtitle && (
                      <p className="font-hanken text-[11px] font-medium text-gray-200 mt-0.5 line-clamp-1">
                        {slides[activeSlideIndex].subtitle}
                      </p>
                    )}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Indicator dots */}
              {slides.length > 1 && (
                <div className="absolute bottom-2 right-3 flex gap-1 z-10">
                  {slides.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActiveSlideIndex(idx)}
                      className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                        activeSlideIndex === idx ? "bg-[#FC7A00] w-4" : "bg-white/50"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Category Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-3 mb-4">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[#FC7A00] text-white shadow-sm"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Storefront Products Showcase */}
          {isLoading ? (
            <div className="bg-white rounded-[24px] border border-gray-100 p-8 flex flex-col items-center text-center justify-center min-h-[220px]">
              <span className="material-symbols-outlined text-[32px] text-[#FC7A00] animate-spin mb-2">progress_activity</span>
              <p className="font-hanken text-xs font-bold uppercase tracking-wider text-gray-400">Loading Products...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-xs flex flex-col items-center text-center justify-center min-h-[260px]"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-primary text-[32px]">
                  storefront
                </span>
              </div>
              <h2 className="font-bodoni text-[16px] font-bold text-black mb-1">
                No Products Available
              </h2>
              <p className="font-hanken text-[11.5px] text-gray-500 leading-relaxed max-w-[240px]">
                No storefront products match your selected category at the moment.
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredItems.map((item) => (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border border-gray-150 p-3.5 flex flex-col justify-between space-y-3 shadow-xs hover:border-[#FC7A00] transition-all"
                >
                  <div className="space-y-2.5">
                    <div className="w-full h-28 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative flex items-center justify-center">
                      {item.imageUrl ? (
                        <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[36px] text-gray-300">storefront</span>
                      )}
                      <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-black/70 text-white backdrop-blur-xs">
                        {item.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-hanken font-extrabold text-xs uppercase text-black line-clamp-1 leading-tight">{item.title}</h3>
                      <p className="font-hanken text-[10px] text-gray-400 font-medium line-clamp-2 mt-0.5 leading-relaxed">{item.description}</p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs text-[#FC7A00]">₦{item.price.toLocaleString()}</span>
                      <span className={`text-[8px] font-black uppercase ${item.inStock ? "text-emerald-600" : "text-red-500"}`}>
                        {item.inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    <button
                      type="button"
                      disabled={!item.inStock}
                      onClick={() => setSelectedItem(item)}
                      className="w-full py-2 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1"
                    >
                      <span className="material-symbols-outlined text-[13px]">shopping_bag</span>
                      <span>Order Now</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>

        {/* Order Modal */}
        <AnimatePresence>
          {selectedItem && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setSelectedItem(null)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[99998]"
              />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 text-black"
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4 mx-auto" />

                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <h3 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    Confirm Store Order
                  </h3>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="space-y-4 text-left">
                  <div className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex items-center gap-3">
                    <div className="w-14 h-14 rounded-xl border border-gray-200 bg-white overflow-hidden flex-shrink-0">
                      {selectedItem.imageUrl ? (
                        <img src={selectedItem.imageUrl} alt={selectedItem.title} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-[28px] text-gray-400 p-3">storefront</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-extrabold text-xs uppercase text-black">{selectedItem.title}</h4>
                      <p className="font-mono font-black text-sm text-[#FC7A00] mt-0.5">₦{selectedItem.price.toLocaleString()}</p>
                    </div>
                  </div>

                  <p className="text-xs text-gray-500 font-semibold leading-relaxed">
                    To place an order for this item, please contact our support desk or VIP chat hotline.
                  </p>

                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Redirecting to support desk...");
                      setSelectedItem(null);
                      window.location.href = "/support";
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">support_agent</span>
                    <span>Contact Support to Order</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
