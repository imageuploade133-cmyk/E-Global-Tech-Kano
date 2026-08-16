"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { StoreHeader } from "@/components/layout/StoreHeader";
import { useAppConfig } from "@/lib/ConfigContext";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import {
  StoreItem,
  StoreSlide,
  StoreCategory,
  StoreSettings,
  CartItem,
  getCachedStore,
  setCachedStore,
  getCachedProductDetail,
  getSavedCart,
  saveCart,
} from "@/lib/store-cache";

export default function StorePage() {
  const { userData, user } = useAuth();
  const { config } = useAppConfig();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [items, setItems] = useState<StoreItem[]>([]);
  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ borderColor: "#FC7A00", hideBorders: false });
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Full screen product modal state
  const [activeProduct, setActiveProduct] = useState<StoreItem | null>(null);
  const [productQuantity, setProductQuantity] = useState(1);

  // Full screen Cart modal state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout & Delivery Profile state
  const [isCheckoutStep, setIsCheckoutStep] = useState(false);
  const [customerDeliveryName, setCustomerDeliveryName] = useState<string>(String(userName || ""));
  const [customerDeliveryPhone, setCustomerDeliveryPhone] = useState<string>(String(userData?.phoneNumber || ""));
  const [customerDeliveryAddress, setCustomerDeliveryAddress] = useState<string>("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Customer Order History Modal state
  const [isMyOrdersOpen, setIsMyOrdersOpen] = useState(false);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [isLoadingMyOrders, setIsLoadingMyOrders] = useState(false);

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
        setCategories(cached.categories || []);
        setSettings(cached.settings || {});
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
          const fetchedCategories: StoreCategory[] = data.categories || [];
          const fetchedSettings: StoreSettings = data.settings || {};
          setItems(fetchedItems);
          setSlides(fetchedSlides);
          setCategories(fetchedCategories);
          setSettings(fetchedSettings);
          setCachedStore(fetchedItems, fetchedSlides, fetchedCategories, fetchedSettings);
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

  const fetchMyOrders = async () => {
    setIsLoadingMyOrders(true);
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }
      const headers: Record<string, string> = idToken ? { Authorization: `Bearer ${idToken}` } : {};

      const res = await fetch("/api/store/orders", { headers });
      const data = await res.json();
      if (data.success && Array.isArray(data.orders)) {
        setMyOrders(data.orders);
      }
    } catch (err) {
      console.warn("Failed to fetch customer order history:", err);
    } finally {
      setIsLoadingMyOrders(false);
    }
  };

  const handleConfirmCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerDeliveryName.trim() || !customerDeliveryPhone.trim() || !customerDeliveryAddress.trim()) {
      toast.error("Please fill in all delivery information fields.");
      return;
    }

    if (cart.length === 0) {
      toast.error("Your shopping cart is empty.");
      return;
    }

    setIsPlacingOrder(true);
    toast.loading("Processing order payment...", { id: "place-order" });

    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      };

      const payload = {
        items: cart.map((c) => ({
          id: c.product.id,
          title: c.product.title,
          price: c.product.price,
          quantity: c.quantity,
          imageUrl: c.product.imageUrl,
          category: c.product.category,
        })),
        customerName: customerDeliveryName,
        customerPhone: customerDeliveryPhone,
        deliveryAddress: customerDeliveryAddress,
        paymentMethod: "WALLET_NGN",
      };

      const res = await fetch("/api/store/orders", {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Order placed successfully!", { id: "place-order" });
        setConfirmedOrder(data.order);
        updateCart([]);
        setIsCheckoutStep(false);
        setIsCartOpen(false);
      } else {
        toast.error(data.error || "Failed to place store order.", { id: "place-order" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error placing store order.", { id: "place-order" });
    } finally {
      setIsPlacingOrder(false);
    }
  };

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

  function hexToRgba(hex: string, opacityPercent: number = 100): string {
    if (opacityPercent <= 0) return "transparent";
    let c = (hex || "#FC7A00").replace("#", "");
    if (c.length === 3) {
      c = c.split("").map((x) => x + x).join("");
    }
    const num = parseInt(c, 16);
    if (isNaN(num)) return `rgba(252, 122, 0, ${opacityPercent / 100})`;
    const r = (num >> 16) & 255;
    const g = (num >> 8) & 255;
    const b = num & 255;
    return `rgba(${r}, ${g}, ${b}, ${opacityPercent / 100})`;
  }

  const customBorderColor = hexToRgba(settings.borderColor || "#FC7A00", settings.borderOpacity ?? 100);
  const hideBorders = Boolean(settings.hideBorders);

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <StoreHeader
          logoUrl={config.logoUrl}
          totalCartItems={totalCartItems}
          onOpenCart={() => setIsCartOpen(true)}
          onOpenOrders={() => {
            fetchMyOrders();
            setIsMyOrdersOpen(true);
          }}
        />

        <main className="max-w-md mx-auto mt-16 min-[375px]:mt-20 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">

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

          {/* Visual Category Filter Chips with Custom Logos */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-4 select-none">
            {categories.filter((c) => !c.isHidden).map((cat) => {
              const isActive = activeCategory.toLowerCase() === cat.name.toLowerCase();
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.name)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border ${
                    isActive
                      ? "bg-[#FC7A00] text-white border-[#FC7A00] shadow-xs"
                      : "bg-white text-gray-700 border-gray-200 hover:border-[#FC7A00]/50"
                  }`}
                >
                  {cat.imageUrl ? (
                    <div className="w-5 h-5 rounded-md bg-gray-100 p-0.5 flex items-center justify-center overflow-hidden flex-shrink-0">
                      <img
                        src={cat.imageUrl}
                        alt={cat.name}
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = "none";
                        }}
                      />
                    </div>
                  ) : (
                    <span className={`material-symbols-outlined text-[18px] ${isActive ? "text-white" : "text-[#FC7A00]"}`}>
                      {cat.iconName || "category"}
                    </span>
                  )}
                  <span>{cat.name}</span>
                </button>
              );
            })}
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
                  style={
                    hideBorders
                      ? { border: "none" }
                      : { borderColor: customBorderColor, borderWidth: "1px", borderStyle: "solid" }
                  }
                  className="bg-white rounded-2xl p-3.5 flex flex-col justify-between space-y-3 shadow-xs transition-all cursor-pointer group relative"
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
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100001] flex flex-col text-black overflow-hidden"
            >
              {/* Ultra Polished App Header Bar */}
              <div className="sticky top-0 bg-white border-b border-gray-150 px-5 py-4 flex items-center justify-between z-10 shadow-3xs">
                <button
                  type="button"
                  onClick={() => setActiveProduct(null)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-800 hover:text-black active:scale-90 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
                </button>
                <div className="text-center">
                  <h2 className="font-hanken font-extrabold text-sm uppercase tracking-wide text-black truncate max-w-[200px]">
                    {activeProduct.title}
                  </h2>
                  <p className="font-hanken text-[9.5px] text-gray-400 font-bold uppercase tracking-widest">
                    {activeProduct.category}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(true)}
                  className="relative w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-800 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">shopping_cart</span>
                  {totalCartItems > 0 && (
                    <span className="absolute -top-1 -right-1 bg-[#FC7A00] text-white text-[8.5px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border border-white">
                      {totalCartItems}
                    </span>
                  )}
                </button>
              </div>

              {/* Full Screen Scrollable Showcase Body */}
              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-6 custom-scrollbar pb-32">
                {/* Hero Showcase Product Image Backdrop */}
                <div className="w-full h-72 rounded-[28px] bg-gradient-to-b from-gray-50 to-gray-100/60 border border-gray-200 overflow-hidden relative flex items-center justify-center p-6 shadow-xs">
                  {activeProduct.imageUrl ? (
                    <Image
                      src={activeProduct.imageUrl}
                      alt={activeProduct.title}
                      fill
                      className="object-contain p-3"
                      unoptimized
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[72px] text-gray-300">storefront</span>
                  )}

                  <div className="absolute top-4 left-4 flex gap-2">
                    <span className="px-3 py-1 rounded-full text-[9.5px] font-black uppercase bg-black/80 text-white backdrop-blur-xs">
                      {activeProduct.category}
                    </span>
                  </div>

                  <span className={`absolute top-4 right-4 px-3 py-1 rounded-full text-[9.5px] font-black uppercase ${
                    activeProduct.inStock ? "bg-emerald-500 text-white shadow-xs" : "bg-red-500 text-white shadow-xs"
                  }`}>
                    {activeProduct.inStock ? "In Stock" : "Out of Stock"}
                  </span>
                </div>

                {/* Product Title & Price Badge */}
                <div className="space-y-2 border-b border-gray-150 pb-4">
                  <h1 className="font-bodoni font-bold text-2xl text-black leading-tight uppercase">
                    {activeProduct.title}
                  </h1>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-2xl font-black text-[#FC7A00]">
                      ₦{activeProduct.price.toLocaleString()}
                    </span>
                    <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                      Verified Genuine
                    </span>
                  </div>
                </div>

                {/* Description Box */}
                <div className="space-y-2.5 p-4 bg-gray-50 border border-gray-150 rounded-2xl">
                  <div className="flex items-center gap-1.5 text-gray-500">
                    <span className="material-symbols-outlined text-[18px]">info</span>
                    <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider">
                      Product Description
                    </h3>
                  </div>
                  <p className="font-hanken text-xs text-gray-700 leading-relaxed font-medium">
                    {activeProduct.description || "Premium hardware product engineered with high reliability and full warranty support."}
                  </p>
                </div>

                {/* Quantity Controls */}
                <div className="space-y-2">
                  <span className="font-hanken text-xs font-bold uppercase tracking-wider text-gray-500 block">
                    Select Quantity
                  </span>
                  <div className="flex items-center gap-4 bg-gray-50 border border-gray-200 p-2 rounded-2xl w-fit">
                    <button
                      type="button"
                      onClick={() => setProductQuantity((q) => Math.max(1, q - 1))}
                      className="w-10 h-10 rounded-xl border border-gray-300 bg-white font-bold text-lg flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
                    >
                      -
                    </button>
                    <span className="font-mono font-black text-lg w-8 text-center">{productQuantity}</span>
                    <button
                      type="button"
                      onClick={() => setProductQuantity((q) => q + 1)}
                      className="w-10 h-10 rounded-xl border border-gray-300 bg-white font-bold text-lg flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              {/* Fixed Bottom Action Bar */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-150 flex gap-2.5 shadow-lg z-20">
                <button
                  type="button"
                  disabled={!activeProduct.inStock}
                  onClick={() => {
                    handleAddToCart(activeProduct, productQuantity);
                  }}
                  className="flex-1 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-900 border border-gray-300 rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5"
                >
                  <span className="material-symbols-outlined text-[18px]">add_shopping_cart</span>
                  <span>Add to Cart</span>
                </button>

                <button
                  type="button"
                  disabled={!activeProduct.inStock}
                  onClick={() => {
                    handleAddToCart(activeProduct, productQuantity);
                    setActiveProduct(null);
                    setIsCartOpen(true);
                  }}
                  className="flex-1 py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <span className="material-symbols-outlined text-[18px]">bolt</span>
                  <span>Buy Now • ₦{(activeProduct.price * productQuantity).toLocaleString()}</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full Screen Shopping Cart Modal (App-like UX overlay sitting above all modals) */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100002] flex flex-col text-black overflow-hidden"
            >
              {/* App-like Top Sticky Header Bar */}
              <div className="sticky top-0 bg-white border-b border-gray-150 px-5 py-4 flex items-center justify-between z-10 shadow-3xs">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-800 hover:text-black active:scale-90 transition-all cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
                </button>
                <div className="text-center">
                  <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    Shopping Cart
                  </h2>
                  <p className="font-hanken text-[9.5px] text-gray-400 font-bold uppercase tracking-widest">
                    {totalCartItems} {totalCartItems === 1 ? "Item" : "Items"} Selected
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

              {/* Scrollable Cart Items List */}
              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-3.5 custom-scrollbar pb-36">
                {cart.length === 0 ? (
                  <div className="py-20 flex flex-col items-center text-center space-y-3">
                    <div className="w-20 h-20 rounded-full bg-gray-50 border border-gray-200 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[48px] text-gray-300">remove_shopping_cart</span>
                    </div>
                    <h3 className="font-bodoni font-bold text-lg text-black">Your Cart is Empty</h3>
                    <p className="font-hanken text-xs text-gray-400 max-w-xs leading-relaxed">
                      Explore storefront hardware and gear to add items to your cart.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="mt-2 px-6 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-xs"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="p-4 bg-gray-50 border border-gray-150 rounded-2xl flex items-center justify-between gap-3 shadow-3xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-xl border border-gray-200 bg-white overflow-hidden relative flex-shrink-0">
                          {product.imageUrl ? (
                            <Image src={product.imageUrl} alt={product.title} fill className="object-cover" unoptimized />
                          ) : (
                            <span className="material-symbols-outlined text-[28px] text-gray-400 p-2">storefront</span>
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
                          className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
                        >
                          -
                        </button>
                        <span className="font-mono font-black text-xs w-4 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveFromCart(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 transition-colors ml-1 cursor-pointer"
                          title="Remove item"
                        >
                          <span className="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Fixed Bottom Checkout Action Bar */}
              {cart.length > 0 && !isCheckoutStep && (
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-t border-gray-150 space-y-3 shadow-lg z-20 max-w-md mx-auto">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-500 uppercase tracking-wider">Subtotal ({totalCartItems} items)</span>
                    <span className="font-mono text-lg font-black text-black">₦{cartSubtotal.toLocaleString()}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCheckoutStep(true)}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <span className="material-symbols-outlined text-[18px]">local_shipping</span>
                    <span>Proceed to Delivery & Payment</span>
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

              {/* Delivery Profile & Payment Step */}
              {isCheckoutStep && (
                <div className="absolute inset-0 bg-white z-30 p-5 overflow-y-auto flex flex-col justify-between max-w-md mx-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-150">
                      <button
                        type="button"
                        onClick={() => setIsCheckoutStep(false)}
                        className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-black"
                      >
                        <span className="material-symbols-outlined text-[18px]">arrow_back</span>
                        Back to Items
                      </button>
                      <span className="text-xs font-black uppercase text-[#FC7A00]">Delivery Profile</span>
                    </div>

                    <form id="checkout-form" onSubmit={handleConfirmCheckout} className="space-y-3.5">
                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                          Full Recipient Name *
                        </label>
                        <input
                          type="text"
                          required
                          value={customerDeliveryName}
                          onChange={(e) => setCustomerDeliveryName(e.target.value)}
                          placeholder="e.g. Captain Jules"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:border-[#FC7A00]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                          Phone Number for Delivery Updates *
                        </label>
                        <input
                          type="tel"
                          required
                          value={customerDeliveryPhone}
                          onChange={(e) => setCustomerDeliveryPhone(e.target.value)}
                          placeholder="e.g. 08012345678"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:border-[#FC7A00]"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-black uppercase text-gray-400 block mb-1">
                          Full Delivery Address *
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={customerDeliveryAddress}
                          onChange={(e) => setCustomerDeliveryAddress(e.target.value)}
                          placeholder="e.g. Suite 4B, E-Tech Hub Plaza, Victoria Island, Lagos"
                          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-bold outline-none focus:border-[#FC7A00] resize-none"
                        />
                      </div>

                      <div className="p-3.5 rounded-2xl bg-orange-50/60 border border-orange-200/80 space-y-1">
                        <div className="flex items-center justify-between text-xs font-bold text-gray-800">
                          <span>Payment Method:</span>
                          <span className="text-emerald-600 font-black">Main NGN Wallet</span>
                        </div>
                        <div className="flex items-center justify-between text-xs font-black">
                          <span className="text-gray-600">Total Order Charge:</span>
                          <span className="text-[#FC7A00] text-sm">₦{cartSubtotal.toLocaleString()}</span>
                        </div>
                      </div>
                    </form>
                  </div>

                  <div className="pt-4 border-t border-gray-150 space-y-2">
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={isPlacingOrder}
                      className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
                    >
                      {isPlacingOrder ? (
                        <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <span className="material-symbols-outlined text-[18px]">verified</span>
                      )}
                      <span>Confirm Order & Pay ₦{cartSubtotal.toLocaleString()}</span>
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Customer Order History Modal */}
        <AnimatePresence>
          {isMyOrdersOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100003] flex flex-col text-black overflow-hidden"
            >
              <div className="sticky top-0 bg-white border-b border-gray-150 px-5 py-4 flex items-center justify-between z-10 shadow-3xs">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">receipt_long</span>
                  <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    My Order History
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMyOrdersOpen(false)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-3.5 custom-scrollbar pb-24">
                {isLoadingMyOrders ? (
                  <div className="py-16 text-center text-xs font-bold uppercase tracking-wider text-gray-400">
                    Loading Order History...
                  </div>
                ) : myOrders.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <span className="material-symbols-outlined text-[48px] text-gray-300">shopping_bag</span>
                    <p className="font-bold text-xs text-gray-500">You have not placed any store orders yet.</p>
                  </div>
                ) : (
                  myOrders.map((ord) => (
                    <div key={ord.id} className="p-4 bg-gray-50 border border-gray-150 rounded-2xl space-y-2.5 shadow-3xs">
                      <div className="flex items-center justify-between border-b border-gray-200/60 pb-2">
                        <div>
                          <span className="font-mono font-black text-xs text-[#FC7A00]">{ord.id}</span>
                          <span className="text-[10px] text-gray-400 block">{new Date(ord.createdAt).toLocaleString()}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border bg-orange-100 text-orange-800 border-orange-300">
                          {ord.status}
                        </span>
                      </div>

                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between font-bold text-gray-700">
                          <span>Items ({ord.items?.length || 0}):</span>
                          <span>₦{ord.totalAmount?.toLocaleString()}</span>
                        </div>
                        <p className="text-[10.5px] text-gray-500 line-clamp-2">
                          {ord.items?.map((i: any) => `${i.title} (x${i.quantity})`).join(", ")}
                        </p>
                      </div>

                      {ord.adminNotes && (
                        <div className="p-2 rounded-xl bg-orange-50 border border-orange-200/60 text-[10px] text-orange-800 font-medium">
                          <strong>Admin Note:</strong> {ord.adminNotes}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmed Order Modal Dialog */}
        {confirmedOrder && (
          <div className="fixed inset-0 z-[100004] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-white text-black space-y-4 shadow-2xl text-center">
              <div className="w-16 h-16 rounded-full bg-emerald-100 border border-emerald-300 flex items-center justify-center mx-auto text-emerald-600">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>

              <div>
                <h3 className="font-black text-base uppercase tracking-tight text-black">Order Placed Successfully!</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Order ID: <strong className="font-mono text-[#FC7A00]">{confirmedOrder.id}</strong>
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 border border-gray-150 text-left text-xs space-y-1">
                <div className="flex justify-between font-bold">
                  <span className="text-gray-500">Amount Charged:</span>
                  <span className="text-emerald-600 font-black">₦{confirmedOrder.totalAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Recipient:</span>
                  <span className="font-bold">{confirmedOrder.customerName}</span>
                </div>
                <div>
                  <span className="text-gray-500 block text-[10px]">Address:</span>
                  <span className="font-medium text-[11px] line-clamp-2">{confirmedOrder.deliveryAddress}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setConfirmedOrder(null)}
                className="w-full py-3 bg-[#FC7A00] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90"
              >
                Close & View Store
              </button>
            </div>
          </div>
        )}

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
