"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
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
  clearStoreCache,
  getSavedCart,
  saveCart,
  getSavedWishlist,
  isInWishlist,
  toggleWishlist,
} from "@/lib/store-cache";

// Convert hex color + opacity fraction (0 to 1) to rgba string strictly for product borders
const hexToRgba = (hex: string = "#FC7A00", opacity: number = 1): string => {
  let c = hex.trim().replace("#", "");
  if (c.length === 3) {
    c = c.split("").map((x) => x + x).join("");
  }
  if (c.length !== 6) return `rgba(252, 122, 0, ${opacity})`;
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

export default function StorePage() {
  const router = useRouter();
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;

  const [items, setItems] = useState<StoreItem[]>([]);
  const [slides, setSlides] = useState<StoreSlide[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({ borderColor: "#FC7A00", hideBorders: false });
  const [isLoading, setIsLoading] = useState(true);

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);

  // Full screen search modal state with paginated 20-item lazy load
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchModalQuery, setSearchModalQuery] = useState("");
  const [searchModalCategory, setSearchModalCategory] = useState("ALL");
  const [visibleSearchLimit, setVisibleSearchLimit] = useState(20);

  // Recently Viewed products state (saves up to 50 items locally)
  const [recentlyViewed, setRecentlyViewed] = useState<StoreItem[]>([]);
  const [isAllRecentlyViewedOpen, setIsAllRecentlyViewedOpen] = useState(false);
  const [visibleRecentlyViewedLimit, setVisibleRecentlyViewedLimit] = useState(10);

  // Wishlist state & Wishlist Modal
  const [wishlist, setWishlist] = useState<StoreItem[]>([]);
  const [isWishlistModalOpen, setIsWishlistModalOpen] = useState(false);

  // Dedicated "Products You May Like" Modal state
  const [isAllRecommendedOpen, setIsAllRecommendedOpen] = useState(false);
  const [recommendedCategory, setRecommendedCategory] = useState<string>("ALL");

  // Load recently viewed & wishlist on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const rawRv = localStorage.getItem("e_tech_recently_viewed");
        if (rawRv) {
          const parsedRv = JSON.parse(rawRv);
          if (Array.isArray(parsedRv)) setRecentlyViewed(parsedRv);
        }
      } catch {
        // Ignore parse errors
      }
    }
    setWishlist(getSavedWishlist());
  }, []);

  const handleToggleWishlistProduct = (e: React.MouseEvent, product: StoreItem) => {
    e.stopPropagation();
    const newState = toggleWishlist(product);
    setWishlist(getSavedWishlist());
    if (newState) {
      toast.success(`Saved ${product.title} to Wishlist!`);
    } else {
      toast.info(`Removed ${product.title} from Wishlist.`);
    }
  };

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

  // Prevent background body scrolling while any store drawer/modal is open
  useEffect(() => {
    if (
      isCartOpen ||
      isMyOrdersOpen ||
      confirmedOrder ||
      isSearchModalOpen ||
      isAllRecentlyViewedOpen ||
      isAllRecommendedOpen ||
      isWishlistModalOpen
    ) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [
    isCartOpen,
    isMyOrdersOpen,
    confirmedOrder,
    isSearchModalOpen,
    isAllRecentlyViewedOpen,
    isAllRecommendedOpen,
    isWishlistModalOpen,
  ]);

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
  const fetchStoreData = async (forceRefresh: boolean = false) => {
    if (!forceRefresh) {
      const cached = getCachedStore();
      if (cached) {
        setItems(cached.items);
        setSlides(cached.slides);
        setCategories(cached.categories || []);
        setSettings(cached.settings || {});
        setIsLoading(false);
        return;
      }
    }

    setIsLoading(true);
    try {
      const res = await fetch(forceRefresh ? "/api/store?fresh=true" : "/api/store");
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
  };

  useEffect(() => {
    fetchStoreData(false);
  }, []);

  // Clean local storage / cache handler
  const handleClearStoreCache = () => {
    clearStoreCache();
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem("e_tech_recently_viewed");
      } catch {
        // Ignore
      }
    }
    setRecentlyViewed([]);
    toast.success("Clearing store cache and reloading fresh data...");
    fetchStoreData(true);
  };

  // Slide autoplay interval
  useEffect(() => {
    if (slides.length <= 1) return;
    const timer = setInterval(() => {
      setActiveSlideIndex((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  // Open Real Product Detail Page
  const handleOpenProductPage = (item: StoreItem) => {
    router.push(`/store/product/${item.id}`);
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

  const hideBorders = Boolean(settings.hideBorders);

  return (
    <RouteGuard>
      <div id="store-page-root" className="min-h-dvh bg-background text-on-background pb-32">
        {/* Sticky App Top Bar - Borderless */}
        <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md py-2.5 px-margin-mobile border-0 shadow-none">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {settings.storeLogoUrl && (
                <div className="w-9 h-9 rounded-xl bg-transparent border-0 flex items-center justify-center p-0 overflow-hidden flex-shrink-0">
                  <img
                    src={settings.storeLogoUrl}
                    alt="Store Logo"
                    className="w-full h-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = "none";
                    }}
                  />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="font-hanken text-[18px] min-[375px]:text-[20px] font-black tracking-tight text-black leading-tight truncate">
                  {settings.storeName || "E-Tech Store"}
                </h1>
                <p className="font-hanken text-[9.5px] text-gray-400 font-black uppercase tracking-widest mt-0.5 truncate">
                  Hardware & Premium Gear
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Refresh Cache Button */}
              <button
                type="button"
                onClick={handleClearStoreCache}
                className="w-9 h-9 min-[375px]:w-10 min-[375px]:h-10 rounded-2xl border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 hover:text-black active:scale-95 transition-all cursor-pointer shadow-none"
                title="Clear Cache & Refresh Store Data"
              >
                <span className="material-symbols-outlined text-[19px] min-[375px]:text-[21px]">
                  cached
                </span>
              </button>

              {/* Wishlist Button */}
              <button
                type="button"
                onClick={() => {
                  setWishlist(getSavedWishlist());
                  setIsWishlistModalOpen(true);
                }}
                className="relative w-9 h-9 min-[375px]:w-10 min-[375px]:h-10 rounded-2xl border-0 bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-none"
                title="Wishlist / Favorites"
              >
                <span className="material-symbols-outlined text-[19px] min-[375px]:text-[21px]">
                  favorite
                </span>
                {wishlist.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[8px] font-black w-4 h-4 rounded-full flex items-center justify-center border-0 shadow-none">
                    {wishlist.length}
                  </span>
                )}
              </button>

              {/* Order History Icon Button */}
              <button
                type="button"
                onClick={() => {
                  fetchMyOrders();
                  setIsMyOrdersOpen(true);
                }}
                className="w-9 h-9 min-[375px]:w-10 min-[375px]:h-10 rounded-2xl border-0 bg-orange-50 hover:bg-orange-100 text-[#FC7A00] flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-none"
                title="Order History"
              >
                <span className="material-symbols-outlined text-[20px] min-[375px]:text-[22px]" style={{ fontVariationSettings: '"wght" 600' }}>
                  receipt_long
                </span>
              </button>

              {/* Premium Dark Cart Icon Button */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative w-9 h-9 min-[375px]:w-10 min-[375px]:h-10 rounded-2xl border-0 bg-gray-900 hover:bg-black text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-sm"
                title="Shopping Cart"
              >
                <span className="material-symbols-outlined text-[20px] min-[375px]:text-[22px] text-orange-400">
                  shopping_bag
                </span>
                {totalCartItems > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-[#FC7A00] text-white text-[8.5px] font-black w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </div>

        <main className="max-w-md mx-auto pt-3 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">

          {/* Dynamic Store Slideshow Banners */}
          {slides.length > 0 && (
            <div className="relative w-full h-44 rounded-2xl overflow-hidden mb-5 border-0 shadow-xs bg-black">
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

          {/* Robust Search Input - Opens Full Screen Search Drawer */}
          <div
            className="relative w-full mb-4 transition-all duration-300 cursor-pointer"
            style={{
              marginTop: `${settings.searchBarMarginTop || 0}px`,
            }}
            onClick={() => {
              setSearchModalQuery(searchQuery);
              setSearchModalCategory(activeCategory);
              setVisibleSearchLimit(20);
              setIsSearchModalOpen(true);
            }}
          >
            <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
              search
            </span>
            <input
              type="text"
              readOnly
              value={searchQuery}
              placeholder="Search store hardware, memberships, gear..."
              className="w-full bg-gray-100/90 hover:bg-gray-150 rounded-2xl pl-11 pr-10 py-3 text-xs font-semibold text-black placeholder-gray-400 outline-none border-0 shadow-none transition-all cursor-pointer"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSearchQuery("");
                }}
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
                  className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer flex items-center gap-2 border-0 ${
                    isActive
                      ? "bg-[#FC7A00] text-white shadow-xs"
                      : "bg-white text-gray-700 hover:bg-gray-100"
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

          {/* Recently Viewed Products Horizontal Scroll Section */}
          {recentlyViewed.length > 0 && (
            <div className="mb-5 space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">history</span>
                  <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black">
                    Recently Viewed ({recentlyViewed.length})
                  </h3>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setVisibleRecentlyViewedLimit(10);
                      setIsAllRecentlyViewedOpen(true);
                    }}
                    className="text-[9.5px] font-black text-[#FC7A00] hover:underline uppercase tracking-wider cursor-pointer"
                  >
                    View All
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRecentlyViewed([]);
                      if (typeof window !== "undefined") localStorage.removeItem("e_tech_recently_viewed");
                    }}
                    className="text-[9.5px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              </div>

              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 select-none">
                {recentlyViewed.slice(0, 10).map((rv) => {
                  const rvBorderColor = settings.recentlyViewedBorderEnabled
                    ? hexToRgba(settings.recentlyViewedBorderColor || "#FC7A00", settings.recentlyViewedBorderOpacity ?? 1)
                    : "#E5E7EB";

                  return (
                    <div
                      key={rv.id}
                      onClick={() => handleOpenProductPage(rv)}
                      style={{ borderColor: rvBorderColor }}
                      className="w-36 flex-shrink-0 bg-white border-0 rounded-2xl p-2.5 space-y-2 cursor-pointer transition-all shadow-3xs hover:shadow-xs"
                    >
                      <div className="w-full h-24 rounded-xl bg-gray-50 border-0 relative overflow-hidden flex items-center justify-center p-1">
                        {rv.imageUrl ? (
                          <img src={rv.imageUrl} alt={rv.title} className="w-full h-full object-contain p-1" />
                        ) : (
                          <span className="material-symbols-outlined text-[24px] text-gray-300">storefront</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-hanken font-bold text-[11px] text-black uppercase line-clamp-1 leading-tight">
                          {rv.title}
                        </h4>
                        <p className="font-mono font-black text-xs text-[#FC7A00] mt-0.5">
                          ₦{rv.price.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Storefront Products Grid with Modern UI/UX Icons */}
          {isLoading ? (
            /* Skeleton Shimmer Loading Grid */
            <div className="grid grid-cols-2 gap-3.5">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="bg-white rounded-2xl border-0 p-3.5 space-y-3 shadow-3xs animate-pulse"
                >
                  <div className="w-full h-28 rounded-xl bg-gray-100 skeleton-shimmer" />
                  <div className="space-y-2">
                    <div className="h-3.5 bg-gray-200 rounded w-3/4 skeleton-shimmer" />
                    <div className="h-2.5 bg-gray-100 rounded w-full skeleton-shimmer" />
                  </div>
                  <div className="pt-2 border-0 flex items-center justify-between">
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
              className="bg-white rounded-[24px] border-0 p-8 shadow-xs flex flex-col items-center text-center justify-center min-h-[260px]"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] flex items-center justify-center mb-4">
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
              {filteredItems.map((item) => {
                const productBorderColor = settings.hideBorders
                  ? "transparent"
                  : settings.enableGradientBorder
                  ? settings.gradientColorStart || "#FC7A00"
                  : hexToRgba(settings.borderColor || "#FC7A00", settings.borderOpacity ?? 1);

                const itemInWishlist = wishlist.some((w) => w.id === item.id);

                return (
                  <motion.div
                    key={item.id}
                    whileTap={{ scale: 0.98 }}
                    style={{
                      borderColor: productBorderColor,
                      ...(settings.enableGradientBorder && !settings.hideBorders
                        ? {
                            borderImage: `linear-gradient(135deg, ${settings.gradientColorStart || "#FC7A00"}, ${settings.gradientColorEnd || "#E06600"}) 1`,
                          }
                        : {}),
                    }}
                    className={`bg-white rounded-2xl p-3 flex flex-col justify-between space-y-3 shadow-xs transition-all cursor-pointer group relative ${
                      hideBorders ? "border-0" : "border"
                    }`}
                    onClick={() => handleOpenProductPage(item)}
                  >
                    <div className="space-y-2">
                      {/* Product Image Thumbnail */}
                      <div className="w-full h-28 min-[375px]:h-32 rounded-xl bg-gray-50 border-0 overflow-hidden relative flex items-center justify-center p-1">
                        {item.imageUrl ? (
                          <Image
                            src={item.imageUrl}
                            alt={item.title}
                            fill
                            className="object-contain p-2 group-hover:scale-105 transition-transform duration-300"
                            unoptimized
                          />
                        ) : (
                          <span className="material-symbols-outlined text-[36px] text-gray-300">storefront</span>
                        )}

                        {/* Heart Wishlist Quick Button */}
                        <button
                          type="button"
                          onClick={(e) => handleToggleWishlistProduct(e, item)}
                          className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-gray-600 hover:text-red-500 shadow-xs z-10 transition-transform active:scale-90"
                          title={itemInWishlist ? "Remove from Wishlist" : "Save to Wishlist"}
                        >
                          <span
                            className={`material-symbols-outlined text-[15px] ${itemInWishlist ? "text-red-500" : ""}`}
                            style={{ fontVariationSettings: itemInWishlist ? '"FILL" 1' : '"FILL" 0' }}
                          >
                            favorite
                          </span>
                        </button>

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
                        <span className="font-mono font-black text-xs min-[375px]:text-sm text-[#FC7A00]">
                          ₦{item.price.toLocaleString()}
                        </span>
                        <span className={`text-[8px] font-black uppercase ${item.inStock ? "text-emerald-600" : "text-red-500"}`}>
                          {item.inStock ? "In Stock" : "Out of Stock"}
                        </span>
                      </div>

                      <div className="flex gap-1.5">
                        {/* Add to Cart Quick Icon Button */}
                        <button
                          type="button"
                          disabled={!item.inStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item, 1);
                          }}
                          className="p-2.5 bg-gray-100 hover:bg-gray-200 disabled:opacity-50 text-gray-900 rounded-xl cursor-pointer active:scale-95 transition-all flex items-center justify-center border-0 shadow-none"
                          title="Add to Cart"
                        >
                          <span className="material-symbols-outlined text-[16px] text-orange-600">add_shopping_cart</span>
                        </button>

                        {/* Buy Now Direct Button */}
                        <button
                          type="button"
                          disabled={!item.inStock}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddToCart(item, 1);
                            setIsCartOpen(true);
                          }}
                          className="flex-1 py-2 bg-gradient-to-r from-[#FC7A00] to-[#E06600] hover:from-[#E06600] hover:to-[#FC7A00] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 shadow-2xs border-0"
                        >
                          <span className="material-symbols-outlined text-[14px]">bolt</span>
                          <span>Buy Now</span>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </main>

        {/* Floating Cart Badge Button (Mobile) */}
        {totalCartItems > 0 && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="fixed bottom-24 right-4 z-[90] px-4 py-3 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-full shadow-lg border-0 flex items-center gap-2.5 active:scale-95 transition-all cursor-pointer"
          >
            <div className="relative">
              <span className="material-symbols-outlined text-[22px]">shopping_bag</span>
              <span className="absolute -top-1 -right-2.5 bg-black text-white text-[9px] font-black px-1.5 py-0.2 rounded-full border-0">
                {totalCartItems}
              </span>
            </div>
            <span className="font-hanken font-black text-xs uppercase tracking-wider">
              ₦{cartSubtotal.toLocaleString()}
            </span>
          </motion.button>
        )}

        {/* Wishlist Full Screen Modal - Borderless */}
        <AnimatePresence>
          {isWishlistModalOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100008] flex flex-col text-black overflow-hidden overscroll-contain"
            >
              <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between z-10 border-0 shadow-none">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-red-500 text-[22px]">favorite</span>
                  <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    My Saved Wishlist
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsWishlistModalOpen(false)}
                  className="w-9 h-9 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer shadow-none"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-4 custom-scrollbar pb-24 overscroll-contain">
                {wishlist.length === 0 ? (
                  <div className="py-20 flex flex-col items-center text-center space-y-3">
                    <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-400">
                      <span className="material-symbols-outlined text-[36px]">favorite_border</span>
                    </div>
                    <h3 className="font-bodoni font-bold text-base text-black">Your Wishlist is Empty</h3>
                    <p className="font-hanken text-xs text-gray-400 max-w-xs leading-relaxed">
                      Tap the heart icon on any product to save it to your personal wishlist.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                      Saved Items ({wishlist.length})
                    </p>

                    <div className="grid grid-cols-2 gap-3.5">
                      {wishlist.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setIsWishlistModalOpen(false);
                            handleOpenProductPage(item);
                          }}
                          className="bg-gray-50 rounded-2xl p-3 flex flex-col justify-between space-y-2.5 cursor-pointer hover:bg-gray-100 transition-all border-0 shadow-3xs"
                        >
                          <div className="w-full h-28 rounded-xl bg-white relative overflow-hidden flex items-center justify-center p-1 border-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain p-1" />
                            ) : (
                              <span className="material-symbols-outlined text-[28px] text-gray-300">storefront</span>
                            )}
                            <button
                              type="button"
                              onClick={(e) => handleToggleWishlistProduct(e, item)}
                              className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center shadow-xs border-0"
                              title="Remove"
                            >
                              <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                                favorite
                              </span>
                            </button>
                          </div>

                          <div>
                            <h4 className="font-hanken font-extrabold text-xs uppercase text-black line-clamp-1 leading-tight">
                              {item.title}
                            </h4>
                            <p className="font-mono font-black text-xs text-[#FC7A00] mt-1">
                              ₦{item.price.toLocaleString()}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddToCart(item, 1);
                            }}
                            className="w-full py-2 bg-[#FC7A00] text-white rounded-xl text-[9.5px] font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 shadow-2xs border-0"
                          >
                            <span className="material-symbols-outlined text-[14px]">add_shopping_cart</span>
                            <span>Add to Cart</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full Screen Shopping Cart Modal - Borderless */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100002] flex flex-col text-black overflow-hidden"
            >
              <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between z-10 border-0 shadow-none">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 hover:text-black active:scale-90 transition-all cursor-pointer shadow-none"
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
                  className="w-10 h-10 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer shadow-none"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-3.5 custom-scrollbar pb-36">
                {cart.length === 0 ? (
                  <div className="py-20 flex flex-col items-center text-center space-y-3">
                    <div className="w-20 h-20 rounded-full bg-gray-50 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[48px] text-gray-300">remove_shopping_cart</span>
                    </div>
                    <h3 className="font-bodoni font-bold text-lg text-black">Your Cart is Empty</h3>
                    <p className="font-hanken text-xs text-gray-400 max-w-xs leading-relaxed">
                      Explore storefront hardware and gear to add items to your cart.
                    </p>
                    <button
                      type="button"
                      onClick={() => setIsCartOpen(false)}
                      className="mt-2 px-6 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-xs border-0"
                    >
                      Browse Products
                    </button>
                  </div>
                ) : (
                  cart.map(({ product, quantity }) => (
                    <div
                      key={product.id}
                      className="p-4 bg-gray-50 border-0 rounded-2xl flex items-center justify-between gap-3 shadow-3xs"
                    >
                      <div className="flex items-center gap-3.5 min-w-0">
                        <div className="w-14 h-14 rounded-xl border-0 bg-white overflow-hidden relative flex-shrink-0">
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

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-lg border-0 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
                        >
                          -
                        </button>
                        <span className="font-mono font-black text-xs w-4 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg border-0 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer shadow-3xs"
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

              {cart.length > 0 && !isCheckoutStep && (
                <div className="absolute bottom-0 left-0 right-0 p-5 bg-white border-0 space-y-3 shadow-lg z-20 max-w-md mx-auto">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span className="text-gray-500 uppercase tracking-wider">Subtotal ({totalCartItems} items)</span>
                    <span className="font-mono text-lg font-black text-black">₦{cartSubtotal.toLocaleString()}</span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsCheckoutStep(true)}
                    className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm border-0"
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

              {isCheckoutStep && (
                <div className="absolute inset-0 bg-white z-30 p-5 overflow-y-auto flex flex-col justify-between max-w-md mx-auto">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-0">
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
                          className="w-full px-3.5 py-2.5 rounded-xl border-0 bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FC7A00]"
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
                          className="w-full px-3.5 py-2.5 rounded-xl border-0 bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FC7A00]"
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
                          className="w-full px-3.5 py-2.5 rounded-xl border-0 bg-gray-50 text-xs font-bold outline-none focus:ring-2 focus:ring-[#FC7A00] resize-none"
                        />
                      </div>

                      <div className="p-3.5 rounded-2xl bg-orange-50/60 border-0 space-y-1">
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

                  <div className="pt-4 border-0 space-y-2">
                    <button
                      type="submit"
                      form="checkout-form"
                      disabled={isPlacingOrder}
                      className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 border-0"
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
              <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between z-10 border-0 shadow-none">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">receipt_long</span>
                  <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    My Order History
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsMyOrdersOpen(false)}
                  className="w-10 h-10 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer shadow-none"
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
                    <div key={ord.id} className="p-4 bg-gray-50 border-0 rounded-2xl space-y-2.5 shadow-3xs">
                      <div className="flex items-center justify-between pb-2">
                        <div>
                          <span className="font-mono font-black text-xs text-[#FC7A00]">{ord.id}</span>
                          <span className="text-[10px] text-gray-400 block">{new Date(ord.createdAt).toLocaleString()}</span>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase border-0 bg-orange-100 text-orange-800">
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
                        <div className="p-2 rounded-xl bg-orange-50 border-0 text-[10px] text-orange-800 font-medium">
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

        {/* Dedicated Paginated "Recently Viewed" Full-Screen Modal */}
        <AnimatePresence>
          {isAllRecentlyViewedOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100007] flex flex-col text-black overflow-hidden overscroll-contain"
            >
              <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between z-10 border-0 shadow-none">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">history</span>
                  <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    Recently Viewed History
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAllRecentlyViewedOpen(false)}
                  className="w-9 h-9 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer shadow-none"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-4 custom-scrollbar pb-24 overscroll-contain">
                {recentlyViewed.length === 0 ? (
                  <div className="py-16 text-center space-y-2">
                    <span className="material-symbols-outlined text-[48px] text-gray-300">history_toggle_off</span>
                    <p className="font-bold text-xs text-gray-500">Your recently viewed history is empty.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-[10px] font-extrabold uppercase text-gray-400">
                      <span>
                        Showing {Math.min(visibleRecentlyViewedLimit, recentlyViewed.length)} of {recentlyViewed.length} items
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setRecentlyViewed([]);
                          if (typeof window !== "undefined") localStorage.removeItem("e_tech_recently_viewed");
                          setIsAllRecentlyViewedOpen(false);
                        }}
                        className="text-red-500 hover:underline cursor-pointer"
                      >
                        Clear All History
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-3.5">
                      {recentlyViewed.slice(0, visibleRecentlyViewedLimit).map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            setIsAllRecentlyViewedOpen(false);
                            handleOpenProductPage(item);
                          }}
                          className="bg-gray-50 rounded-2xl p-3.5 flex flex-col justify-between space-y-3 cursor-pointer hover:bg-gray-100 transition-all border-0 shadow-xs"
                        >
                          <div className="w-full h-28 rounded-xl bg-white relative overflow-hidden flex items-center justify-center p-1 border-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain p-1" />
                            ) : (
                              <span className="material-symbols-outlined text-[32px] text-gray-300">storefront</span>
                            )}
                            <span className="absolute top-1.5 right-1.5 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-black/75 text-white backdrop-blur-xs">
                              {item.category}
                            </span>
                          </div>

                          <div>
                            <h4 className="font-hanken font-extrabold text-xs uppercase text-black line-clamp-1 leading-tight">
                              {item.title}
                            </h4>
                            <p className="font-mono font-black text-xs text-[#FC7A00] mt-1">
                              ₦{item.price.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    {recentlyViewed.length > visibleRecentlyViewedLimit && (
                      <div className="pt-3 text-center">
                        <button
                          type="button"
                          onClick={() => setVisibleRecentlyViewedLimit((prev) => prev + 10)}
                          className="px-6 py-3 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 shadow-xs"
                        >
                          Load More History ({recentlyViewed.length - visibleRecentlyViewedLimit} remaining)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full-Screen Paginated Search Modal */}
        <AnimatePresence>
          {isSearchModalOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "tween", ease: [0.32, 0.72, 0, 1], duration: 0.3 }}
              className="fixed inset-0 bg-white z-[100005] flex flex-col text-black overflow-hidden overscroll-contain"
            >
              <div className="sticky top-0 bg-white px-5 py-3.5 flex items-center justify-between gap-3 z-10 border-0 shadow-none">
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery(searchModalQuery);
                    setActiveCategory(searchModalCategory);
                    setIsSearchModalOpen(false);
                  }}
                  className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-800 hover:text-black active:scale-90 transition-all cursor-pointer border-0 shadow-none flex-shrink-0"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
                </button>

                <div className="relative flex-1">
                  <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                    search
                  </span>
                  <input
                    type="text"
                    autoFocus
                    value={searchModalQuery}
                    onChange={(e) => {
                      setSearchModalQuery(e.target.value);
                      setVisibleSearchLimit(20);
                    }}
                    placeholder="Search store products, gear, hardware..."
                    className="w-full bg-gray-100 focus:bg-gray-150 rounded-2xl pl-10 pr-9 py-2.5 text-xs font-semibold text-black placeholder-gray-400 outline-none border-0 shadow-none"
                  />
                  {searchModalQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchModalQuery("");
                        setVisibleSearchLimit(20);
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black"
                    >
                      <span className="material-symbols-outlined text-[16px]">close</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="px-5 py-2 flex gap-2 overflow-x-auto no-scrollbar border-0 flex-shrink-0 select-none">
                {categories.filter((c) => !c.isHidden).map((cat) => {
                  const isActive = searchModalCategory.toLowerCase() === cat.name.toLowerCase();
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        setSearchModalCategory(cat.name);
                        setVisibleSearchLimit(20);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer border-0 ${
                        isActive
                          ? "bg-[#FC7A00] text-white shadow-xs"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              <div className="flex-1 overflow-y-auto p-5 max-w-md mx-auto w-full space-y-4 custom-scrollbar pb-24 overscroll-contain">
                {(() => {
                  const q = searchModalQuery.toLowerCase().trim();
                  const results = items.filter((item) => {
                    const matchesCategory =
                      searchModalCategory === "ALL" || item.category.toLowerCase() === searchModalCategory.toLowerCase();
                    const matchesQuery =
                      !q ||
                      item.title.toLowerCase().includes(q) ||
                      item.description.toLowerCase().includes(q) ||
                      item.category.toLowerCase().includes(q);
                    return matchesCategory && matchesQuery;
                  });

                  const paginatedResults = results.slice(0, visibleSearchLimit);

                  if (results.length === 0) {
                    return (
                      <div className="py-16 text-center space-y-3">
                        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto text-gray-300">
                          <span className="material-symbols-outlined text-[32px]">search_off</span>
                        </div>
                        <h3 className="font-bodoni font-bold text-base text-black">No Products Found</h3>
                        <p className="font-hanken text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
                          {q
                            ? `No store items matched "${q}". Try searching another keyword.`
                            : "No products match the selected category filter."}
                        </p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-4">
                      <p className="text-[10px] font-extrabold uppercase text-gray-400 tracking-wider">
                        Showing {paginatedResults.length} of {results.length} matched products
                      </p>

                      <div className="grid grid-cols-2 gap-3">
                        {paginatedResults.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setIsSearchModalOpen(false);
                              handleOpenProductPage(item);
                            }}
                            className="bg-gray-50 rounded-2xl p-3 flex flex-col justify-between space-y-2.5 cursor-pointer hover:bg-gray-100 transition-all border-0 shadow-xs"
                          >
                            <div className="w-full h-24 rounded-xl bg-white relative overflow-hidden flex items-center justify-center p-1 border-0">
                              {item.imageUrl ? (
                                <img src={item.imageUrl} alt={item.title} className="w-full h-full object-contain p-1" />
                              ) : (
                                <span className="material-symbols-outlined text-[28px] text-gray-300">storefront</span>
                              )}
                            </div>
                            <div>
                              <h4 className="font-hanken font-extrabold text-xs uppercase text-black line-clamp-1 leading-tight">
                                {item.title}
                              </h4>
                              <p className="font-mono font-black text-xs text-[#FC7A00] mt-0.5">
                                ₦{item.price.toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>

                      {results.length > visibleSearchLimit && (
                        <div className="pt-3 text-center">
                          <button
                            type="button"
                            onClick={() => setVisibleSearchLimit((prev) => prev + 20)}
                            className="px-6 py-3 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 shadow-xs"
                          >
                            Load More Products ({results.length - visibleSearchLimit} remaining)
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Confirmed Order Modal Dialog */}
        {confirmedOrder && (
          <div className="fixed inset-0 z-[100004] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
            <div className="w-full max-w-sm p-6 rounded-3xl bg-white text-black space-y-4 shadow-2xl text-center border-0">
              <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto text-emerald-600">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>

              <div>
                <h3 className="font-black text-base uppercase tracking-tight text-black">Order Placed Successfully!</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Order ID: <strong className="font-mono text-[#FC7A00]">{confirmedOrder.id}</strong>
                </p>
              </div>

              <div className="p-3 rounded-2xl bg-gray-50 border-0 text-left text-xs space-y-1">
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
                className="w-full py-3 bg-[#FC7A00] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 border-0"
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
