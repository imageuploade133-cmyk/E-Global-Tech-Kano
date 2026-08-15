"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import {
  StoreItem,
  StoreSlide,
  CartItem,
  getCachedStore,
  setCachedStore,
  getCachedProductDetail,
  getSavedCart,
  saveCart,
} from "@/lib/store-cache";

export default function StorePage() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [items, setItems] = useState<StoreItem[]>([]);
  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Full screen product modal state
  const [activeProduct, setActiveProduct] = useState<StoreItem | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);

  // Cart state & Cart drawer
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Load Cart from localStorage on mount
  useEffect(() => {
    setCart(getSavedCart());
  }, []);

  // Sync Cart changes to localStorage
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    saveCart(newCart);
  };

  // Fetch Storefront Data with Low Read Cache Strategy
  useEffect(() => {
    async function fetchStore() {
      // Check cache first to avoid unnecessary Firestore reads
      const cached = getCachedStore();
      if (cached) {
        setItems(cached.items);
        setSlides(cached.slides);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      try {
        const res = await fetch("/api/store");
        const data = await res.json();
        if (data.success) {
          const fetchedItems: StoreItem[] = data.items || [];
          const fetchedSlides: StoreSlide[] = data.slides || [];
          setItems(fetchedItems);
          setSlides(fetchedSlides);
          setCachedStore(fetchedItems, fetchedSlides);
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

  // Open Full Screen Product Modal with zero re-reads if cached
  const handleOpenProductModal = (item: StoreItem) => {
    // Read from client cache first
    const cachedItem = getCachedProductDetail(item.id) || item;
    setActiveProduct(cachedItem);
    setProductQuantity(1);
  };

  // Cart operations
  const handleAddToCart = (product: StoreItem, qty: number = 1) => {
    if (!product.inStock) {
      toast.error("Sorry, this item is currently out of stock!");
      return;
    }

    const existingIndex = cart.findIndex((c) => c.product.id === product.id);
    let updatedCart: CartItem[];

    if (existingIndex > -1) {
      updatedCart = [...cart];
      updatedCart[existingIndex].quantity += qty;
    } else {
      updatedCart = [...cart, { product, quantity: qty }];
    }

    updateCart(updatedCart);
    toast.success(`Added ${qty}x ${product.title} to cart!`);
  };

  const handleUpdateCartQuantity = (productId: string, delta: number) => {
    const updatedCart = cart
      .map((item) => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    updateCart(updatedCart);
  };

  const handleRemoveFromCart = (productId: string) => {
    const updatedCart = cart.filter((c) => c.product.id !== productId);
    updateCart(updatedCart);
    toast.info("Item removed from cart.");
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

  const categories = ["ALL", "Hardware", "Memberships", "E-Tech Gear", "Subscriptions"];

  // Search & Category Filtered Products
  const filteredItems = items.filter((item) => {
    const matchesCategory = activeCategory === "ALL" || item.category.toLowerCase() === activeCategory.toLowerCase();
    const query = searchQuery.toLowerCase().trim();
    const matchesQuery =
      !query ||
      item.title.toLowerCase().includes(query) ||
      item.description.toLowerCase().includes(query) ||
      item.category.toLowerCase().includes(query);

    return matchesCategory && matchesQuery;
  });

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Header Bar with Store Title & Cart Badge */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#FC7A00]/10 border border-[#FC7A00]/20 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">
                  storefront
                </span>
              </div>
              <div>
                <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black leading-tight">
                  E-Tech Store
                </h1>
                <p className="font-hanken text-[11px] text-gray-500 font-medium">
                  Premium boutique products & hardware
                </p>
              </div>
            </div>

            {/* Cart Header Button */}
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="relative w-10 h-10 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-800 hover:text-black hover:border-gray-300 active:scale-95 transition-all shadow-xs cursor-pointer"
              title="Shopping Cart"
            >
              <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
              {totalCartItems > 0 && (
                <span className="absolute -top-1 -right-1 bg-[#FC7A00] text-white text-[9px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-white animate-bounce">
                  {totalCartItems}
                </span>
              )}
            </button>
          </div>

          {/* Dynamic Store Slideshow Banners */}
          {slides.length > 0 && (
            <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-5 border border-gray-150 shadow-xs bg-black">
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

          {/* Robust Search Input */}
          <div className="relative w-full mb-4">
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search store hardware, memberships, gear..."
              className="w-full bg-white border border-gray-200 focus:border-[#FC7A00] rounded-2xl pl-11 pr-10 py-3 text-xs font-semibold text-black placeholder-gray-400 outline-none shadow-3xs transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {/* Category Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 select-none">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer ${
                  activeCategory === cat
                    ? "bg-[#FC7A00] text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Storefront Products Showcase */}
          {isLoading ? (
            /* Skeleton Shimmer Loading Grid */
            <div className="grid grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border border-gray-100 p-3.5 space-y-3 shadow-3xs animate-pulse"
                >
                  <div className="w-full h-28 rounded-xl bg-gray-100 skeleton-shimmer" />
                  <div className="space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-3/4 skeleton-shimmer" />
                    <div className="h-2.5 bg-gray-100 rounded w-full skeleton-shimmer" />
                  </div>
                  <div className="pt-2 border-t border-gray-100 flex items-center justify-between">
                    <div className="h-4 bg-gray-200 rounded w-12 skeleton-shimmer" />
                    <div className="h-7 bg-gray-200 rounded-xl w-16 skeleton-shimmer" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-xs flex flex-col items-center text-center justify-center min-h-[260px]"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center mb-4">
                <span className="material-symbols-outlined text-[#FC7A00] text-[32px]">
                  storefront
                </span>
              </div>
              <h2 className="font-bodoni text-[16px] font-bold text-black mb-1">
                No Matching Products
              </h2>
              <p className="font-hanken text-[11.5px] text-gray-500 leading-relaxed max-w-[240px]">
                {searchQuery
                  ? `No products matched "${searchQuery}". Try searching another keyword.`
                  : "No storefront products match your selected category at the moment."}
              </p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {filteredItems.map((item) => (
                <motion.div
                  key={item.id}
                  whileTap={{ scale: 0.98 }}
                  className="bg-white rounded-2xl border border-gray-150 p-3.5 flex flex-col justify-between space-y-3 shadow-xs hover:border-[#FC7A00] transition-all cursor-pointer group relative"
                  onClick={() => handleOpenProductModal(item)}
                >
                  <div className="space-y-2.5">
                    {/* Product Image Thumbnail */}
                    <div className="w-full h-28 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative flex items-center justify-center">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.title}
                          fill
                          className="object-cover group-hover:scale-105 transition-transform duration-300"
                          unoptimized
                        />
                      ) : (
                        <span className="material-symbols-outlined text-[36px] text-gray-300">storefront</span>
                      )}
                      <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-black/75 text-white backdrop-blur-xs">
                        {item.category}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-hanken font-extrabold text-xs uppercase text-black line-clamp-1 leading-tight group-hover:text-[#FC7A00] transition-colors">
                        {item.title}
                      </h3>
                      <p className="font-hanken text-[10px] text-gray-400 font-medium line-clamp-2 mt-0.5 leading-relaxed">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-gray-100 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black text-xs text-[#FC7A00]">
                        ₦{item.price.toLocaleString()}
                      </span>
                      <span className={`text-[8px] font-black uppercase ${item.inStock ? "text-emerald-600" : "text-red-500"}`}>
                        {item.inStock ? "In Stock" : "Out of Stock"}
                      </span>
                    </div>

                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenProductModal(item);
                        }}
                        className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xl text-[9.5px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
                      >
                        Details
                      </button>

                      <button
                        type="button"
                        disabled={!item.inStock}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleAddToCart(item, 1);
                        }}
                        className="p-2 bg-[#FC7A00] hover:bg-[#E06600] disabled:bg-gray-300 text-white rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                        title="Add to Cart"
                      >
                        <span className="material-symbols-outlined text-[15px] font-bold">add_shopping_cart</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </main>

        {/* Floating Cart Button (Visible on Mobile) */}
        {totalCartItems > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 right-4 z-[90] px-4 py-3 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-full shadow-lg border border-white/20 flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer"
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
              <span className="absolute -top-1 -right-2.5 bg-black text-white text-[9px] font-black px-1.5 py-0.2 rounded-full border border-white">
                {totalCartItems}
              </span>
            </div>
            <span className="font-hanken font-black text-xs uppercase tracking-wider">
              ₦{cartSubtotal.toLocaleString()}
            </span>
          </motion.button>
        )}

        {/* Full Screen Product Detail Modal (Loaded on Demand from Cache) */}
        <AnimatePresence>
          {activeProduct && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-white z-[100000] flex flex-col text-black overflow-y-auto"
            >
              {/* Full Screen Header Bar */}
              <div className="sticky top-0 bg-white/95 backdrop-blur-md border-b border-gray-150 px-5 py-4 flex items-center justify-between z-10">
                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-700 hover:text-black active:scale-90 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
                </button>
                <h2 className="font-hanken font-bold text-sm uppercase tracking-wide text-gray-900 truncate max-w-[200px]">
                  Product Overview
                </h2>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="relative w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                  {totalCartItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FC7A00] text-white text-[8px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white">
                      {totalCartItems}
                    </span>
                  )}
                </button>
              </div>

              {/* Full Screen Modal Content */}
              <div className="p-5 max-w-md mx-auto w-full space-y-6 pb-32">
                {/* Large Product Showcase Image */}
                <div className="w-full h-64 rounded-3xl bg-gray-50 border border-gray-150 overflow-hidden relative flex items-center justify-center p-4">
                  {activeProduct.imageUrl ? (
                    <Image
                      src={activeProduct.imageUrl}
                      alt={activeProduct.title}
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[64px] text-gray-300">storefront</span>
                  )}
                  <span className="absolute top-3 left-3 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-black/80 text-white backdrop-blur-xs">
                    {activeProduct.category}
                  </span>
                  <span className={`absolute top-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase ${activeProduct.inStock ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>
                    {activeProduct.inStock ? "In Stock" : "Out of Stock"}
                  </span>
                </div>

                {/* Product Meta */}
                <div className="space-y-2">
                  <h1 className="font-bodoni font-bold text-xl text-black leading-tight uppercase">
                    {activeProduct.title}
                  </h1>
                  <p className="font-mono text-2xl font-black text-[#FC7A00]">
                    ₦{activeProduct.price.toLocaleString()}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-2 p-4 bg-gray-50 border border-gray-150 rounded-2xl">
                  <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-gray-500">
                    Description & Specifications
                  </h3>
                  <p className="font-hanken text-xs text-gray-700 leading-relaxed font-medium">
                    {activeProduct.description}
                  </p>
                </div>

                {/* Quantity Control Selector */}
                <div className="space-y-2">
                  <span className="font-hanken text-xs font-bold uppercase tracking-wider text-gray-500">
                    Select Quantity
                  </span>
                  <div className="flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setProductQuantity((q) => Math.max(1, q - 1))}
                      className="w-11 h-11 rounded-xl border border-gray-300 bg-gray-100 font-bold text-lg flex items-center justify-center active:scale-90 cursor-pointer"
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-lg w-8 text-center">{productQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setProductQuantity((q) => q + 1)}
                      className="w-11 h-11 rounded-xl border border-gray-300 bg-gray-100 font-bold text-lg flex items-center justify-center active:scale-90 cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-4 border-t border-gray-150 space-y-3">
                  <button
                    type="button"
                    disabled={!activeProduct.inStock}
                    onClick={() => {
                      handleAddToCart(activeProduct, productQuantity);
                    }}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                    <span>Add to Cart • ₦{(activeProduct.price * productQuantity).toLocaleString()}</span>
                  </button>

                  <button
                    type="button"
                    disabled={!activeProduct.inStock}
                    onClick={() => {
                      handleAddToCart(activeProduct, productQuantity);
                      setActiveProduct(null);
                      setIsCartOpen(true);
                    }}
                    className="w-full py-3.5 bg-black hover:bg-gray-900 disabled:bg-gray-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">bolt</span>
                    <span>Buy Now & Checkout</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Slide-out Cart Drawer Modal */}
        <AnimatePresence>
          {isCartOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCartOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-xs z-[99998]"
              />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[99999] p-6 pb-8 text-black max-h-[85vh] flex flex-col"
              >
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4 mx-auto flex-shrink-0" />

                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[22px] text-[#FC7A00]">shopping_bag</span>
                    <h3 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                      Your Shopping Cart
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                {/* Cart Items List */}
                <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 custom-scrollbar">
                  {cart.length === 0 ? (
                    <div className="py-12 flex flex-col items-center text-center space-y-2">
                      <span className="material-symbols-outlined text-[48px] text-gray-300">remove_shopping_cart</span>
                      <p className="font-hanken font-bold text-xs text-gray-400 uppercase tracking-widest">
                        Your cart is empty
                      </p>
                      <p className="font-hanken text-[11px] text-gray-400">Add products from the store to continue.</p>
                    </div>
                  ) : (
                    cart.map(({ product, quantity }) => (
                      <div
                        key={product.id}
                        className="p-3.5 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-xl border border-gray-200 bg-white overflow-hidden relative flex-shrink-0">
                            {product.imageUrl ? (
                              <Image src={product.imageUrl} alt={product.title} fill className="object-cover" unoptimized />
                            ) : (
                              <span className="material-symbols-outlined text-[24px] text-gray-400 p-2">storefront</span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-extrabold text-xs uppercase text-black truncate">{product.title}</h4>
                            <p className="font-mono font-bold text-xs text-[#FC7A00] mt-0.5">
                              ₦{product.price.toLocaleString()}
                            </p>
                          </div>
                        </div>

                        {/* Item Quantity Controls */}
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQuantity(product.id, -1)}
                            className="w-7 h-7 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer"
                          >
                            -
                          </button>
                          <span className="font-mono font-black text-xs w-4 text-center">{quantity}</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateCartQuantity(product.id, 1)}
                            className="w-7 h-7 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveFromCart(product.id)}
                            className="p-1 text-gray-400 hover:text-red-500 transition-colors ml-1"
                            title="Remove item"
                          >
                            <span className="material-symbols-outlined text-[16px]">delete</span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Cart Summary & Order Action */}
                {cart.length > 0 && (
                  <div className="pt-4 border-t border-gray-150 mt-4 space-y-3 flex-shrink-0">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <span className="text-gray-500 uppercase tracking-wider">Subtotal ({totalCartItems} items)</span>
                      <span className="font-mono text-base font-black text-black">₦{cartSubtotal.toLocaleString()}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        toast.success("Redirecting order to VIP Support desk...");
                        setIsCartOpen(false);
                        window.location.href = "/support";
                      }}
                      className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <span className="material-symbols-outlined text-[18px]">support_agent</span>
                      <span>Checkout via VIP Desk</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => updateCart([])}
                      className="w-full text-center text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider cursor-pointer transition-colors"
                    >
                      Clear Shopping Cart
                    </button>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
