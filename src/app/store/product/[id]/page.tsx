"use client";

import React, { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { RouteGuard } from "@/components/RouteGuard";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Image from "next/image";
import {
  StoreItem,
  StoreSettings,
  CartItem,
  getCachedStore,
  getCachedProductDetail,
  getSavedCart,
  saveCart,
  getSavedWishlist,
  isInWishlist,
  toggleWishlist,
} from "@/lib/store-cache";

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const router = useRouter();
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Customer") as string;

  const [product, setProduct] = useState<StoreItem | null>(null);
  const [allItems, setAllItems] = useState<StoreItem[]>([]);
  const [settings, setSettings] = useState<StoreSettings>({});
  const [isLoading, setIsLoading] = useState(true);

  // Gallery slider state
  const [selectedGalleryIndex, setSelectedGalleryIndex] = useState(0);
  const [productQuantity, setProductQuantity] = useState(1);

  // User state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isWishlisted, setIsWishlisted] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);

  // Checkout & Delivery Profile state
  const [isCheckoutStep, setIsCheckoutStep] = useState(false);
  const [customerDeliveryName, setCustomerDeliveryName] = useState<string>(String(userName || ""));
  const [customerDeliveryPhone, setCustomerDeliveryPhone] = useState<string>(String(userData?.phoneNumber || ""));
  const [customerDeliveryAddress, setCustomerDeliveryAddress] = useState<string>("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<any>(null);

  // Load saved cart and wishlist on mount
  useEffect(() => {
    setCart(getSavedCart());
    if (productId) {
      setIsWishlisted(isInWishlist(productId));
    }
  }, [productId]);

  // Track product view in recently viewed list (up to 50 items max)
  const trackRecentlyViewed = (item: StoreItem) => {
    if (typeof window === "undefined") return;
    try {
      const raw = localStorage.getItem("e_tech_recently_viewed");
      let list: StoreItem[] = [];
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) list = parsed;
      }
      const filtered = list.filter((p) => p.id !== item.id);
      const updated = [item, ...filtered].slice(0, 50);
      localStorage.setItem("e_tech_recently_viewed", JSON.stringify(updated));
    } catch {
      // Ignore errors
    }
  };

  // Fetch product data with low read strategy
  useEffect(() => {
    let isMounted = true;

    async function loadProduct() {
      setIsLoading(true);

      // Check cache first
      const cachedProduct = getCachedProductDetail(productId);
      const cachedStore = getCachedStore();

      if (cachedStore && isMounted) {
        setAllItems(cachedStore.items);
        setSettings(cachedStore.settings);
      }

      if (cachedProduct && isMounted) {
        setProduct(cachedProduct);
        trackRecentlyViewed(cachedProduct);
        setIsLoading(false);
        return;
      }

      // If not in cache, fetch from store API
      try {
        const res = await fetch("/api/store");
        const data = await res.json();
        if (data.success && isMounted) {
          const items: StoreItem[] = data.items || [];
          setAllItems(items);
          setSettings(data.settings || {});

          const target = items.find((i) => i.id === productId);
          if (target) {
            setProduct(target);
            trackRecentlyViewed(target);
          } else {
            toast.error("Product not found");
          }
        }
      } catch (err) {
        console.error("Failed to fetch product detail:", err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProduct();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Gallery slider helper
  const getProductGallery = (item: StoreItem): string[] => {
    if (Array.isArray(item.images) && item.images.length > 0) {
      return item.images;
    }
    if (item.imageUrl) {
      return [item.imageUrl];
    }
    return [];
  };

  // Auto slide gallery images if autoSlide is ON
  useEffect(() => {
    if (!product) return;
    const gallery = getProductGallery(product);
    const totalMedia = gallery.length + (product.videoUrl ? 1 : 0);
    if (totalMedia <= 1 || product.autoSlide === false) return;

    const interval = setInterval(() => {
      setSelectedGalleryIndex((prev) => (prev + 1) % totalMedia);
    }, 4500);

    return () => clearInterval(interval);
  }, [product]);

  // Video Embed helper
  const renderVideoEmbed = (url: string) => {
    if (!url) return null;
    let embedUrl = url;

    if (url.includes("youtube.com/watch?v=")) {
      const videoId = url.split("v=")[1]?.split("&")[0];
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
    } else if (url.includes("youtu.be/")) {
      const videoId = url.split("youtu.be/")[1]?.split("?")[0];
      if (videoId) embedUrl = `https://www.youtube.com/embed/${videoId}?autoplay=0&rel=0`;
    }

    if (embedUrl.includes("youtube.com/embed/")) {
      return (
        <iframe
          src={embedUrl}
          title="Product Video"
          className="w-full h-full rounded-2xl border-0 shadow-none"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      );
    }

    return (
      <video
        src={url}
        controls
        className="w-full h-full object-cover rounded-2xl border-0 shadow-none"
      />
    );
  };

  // Cart operations
  const updateCart = (newCart: CartItem[]) => {
    setCart(newCart);
    saveCart(newCart);
  };

  const handleAddToCart = (qty: number = 1, showToast: boolean = true) => {
    if (!product) return;
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
    if (showToast) {
      toast.success(`Added ${qty}x ${product.title} to cart!`);
    }
  };

  const handleUpdateCartQuantity = (pId: string, delta: number) => {
    const updatedCart = cart
      .map((item) => {
        if (item.product.id === pId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : null;
        }
        return item;
      })
      .filter((item): item is CartItem => item !== null);

    updateCart(updatedCart);
  };

  const handleRemoveFromCart = (pId: string) => {
    const updatedCart = cart.filter((c) => c.product.id !== pId);
    updateCart(updatedCart);
    toast.info("Item removed from cart.");
  };

  const handleToggleWishlist = () => {
    if (!product) return;
    const newState = toggleWishlist(product);
    setIsWishlisted(newState);
    if (newState) {
      toast.success("Saved to Wishlist!");
    } else {
      toast.info("Removed from Wishlist.");
    }
  };

  const totalCartItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const cartSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);

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

  const handleShareProduct = () => {
    if (typeof window !== "undefined" && navigator.share) {
      navigator
        .share({
          title: product?.title || "E-Tech Store",
          text: `Check out ${product?.title} on ${settings.storeName || "E-Tech Store"}`,
          url: window.location.href,
        })
        .catch(() => {});
    } else {
      if (typeof window !== "undefined") {
        navigator.clipboard.writeText(window.location.href);
        toast.success("Product link copied to clipboard!");
      }
    }
  };

  if (isLoading) {
    return (
      <RouteGuard>
        <div className="min-h-dvh bg-gray-50 flex items-center justify-center p-4">
          <div className="text-center space-y-3">
            <div className="w-12 h-12 border-3 border-[#FC7A00] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="font-hanken font-extrabold text-xs uppercase tracking-wider text-gray-500">
              Loading Product Details...
            </p>
          </div>
        </div>
      </RouteGuard>
    );
  }

  if (!product) {
    return (
      <RouteGuard>
        <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 border border-orange-200 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px] text-[#FC7A00]">error_outline</span>
          </div>
          <h2 className="font-bodoni text-xl font-bold text-black mb-2">Product Not Found</h2>
          <p className="font-hanken text-xs text-gray-500 max-w-xs mb-6">
            The product you are looking for may have been removed or is temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={() => router.push("/store")}
            className="px-6 py-3 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer"
          >
            Return to Store
          </button>
        </div>
      </RouteGuard>
    );
  }

  const gallery = getProductGallery(product);
  const hasVideo = Boolean(product.videoUrl);
  const isShowingVideo = hasVideo && selectedGalleryIndex === gallery.length;
  const activeImgUrl = gallery[selectedGalleryIndex] || gallery[0] || product.imageUrl;

  // Calculated list price for flash sale display (+20% discount standard badge)
  const listPrice = product.originalPrice || Math.round(product.price * 1.25);
  const discountPercent = Math.round(((listPrice - product.price) / listPrice) * 100);

  // Recommended Products
  const recommendedProducts = allItems.filter(
    (i) => i.id !== product.id && i.category.toLowerCase() === product.category.toLowerCase()
  );
  const displayRecs = recommendedProducts.length > 0 ? recommendedProducts : allItems.filter((i) => i.id !== product.id);

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-[#F4F5F7] text-black pb-32">
        {/* Sticky Top Bar Header with Modern UI/UX Icons */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-4 py-3 border-b border-gray-200/80 shadow-xs">
          <div className="max-w-md mx-auto flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-9 h-9 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center justify-center active:scale-90 transition-all cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>

            <div className="text-center min-w-0 flex-1 px-2">
              <h1 className="font-hanken font-black text-xs min-[375px]:text-sm uppercase tracking-wide text-black truncate">
                {product.title}
              </h1>
              <p className="font-hanken text-[9px] text-[#FC7A00] font-black uppercase tracking-widest truncate">
                {product.category}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Share Icon */}
              <button
                type="button"
                onClick={handleShareProduct}
                className="w-9 h-9 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-none"
                title="Share Product"
              >
                <span className="material-symbols-outlined text-[19px]">share</span>
              </button>

              {/* Heart Wishlist Icon */}
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={`w-9 h-9 rounded-2xl flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-none border ${
                  isWishlisted
                    ? "bg-red-50 text-red-500 border-red-200"
                    : "bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200"
                }`}
                title={isWishlisted ? "Remove from Wishlist" : "Save to Wishlist"}
              >
                <span
                  className="material-symbols-outlined text-[20px]"
                  style={{ fontVariationSettings: isWishlisted ? '"FILL" 1' : '"FILL" 0' }}
                >
                  favorite
                </span>
              </button>

              {/* Cart Icon */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative w-9 h-9 rounded-2xl bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer shadow-xs"
                title="Shopping Cart"
              >
                <span className="material-symbols-outlined text-[20px] text-orange-400">
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
        </header>

        {/* Main Content Container */}
        <main className="max-w-md mx-auto pt-3 px-3 min-[375px]:px-4 space-y-3.5">
          {/* Temu-Style Full Page Hero Media Carousel Container */}
          <div className="bg-white rounded-3xl p-3 shadow-xs space-y-3 border border-gray-200/60">
            <div className="w-full h-80 min-[375px]:h-96 rounded-2xl bg-gray-50 relative overflow-hidden flex items-center justify-center p-3">
              {isShowingVideo ? (
                renderVideoEmbed(product.videoUrl!)
              ) : activeImgUrl ? (
                <Image
                  src={activeImgUrl}
                  alt={product.title}
                  fill
                  className="object-contain p-2"
                  unoptimized
                />
              ) : (
                <span className="material-symbols-outlined text-[72px] text-gray-300">storefront</span>
              )}

              {/* Category & Stock Badges Overlay */}
              <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                <span className="px-3 py-1 rounded-full text-[9px] font-black uppercase bg-black/80 text-white backdrop-blur-md">
                  {product.category}
                </span>
                {discountPercent > 0 && (
                  <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase bg-red-600 text-white shadow-xs flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[12px]">local_fire_department</span>
                    {discountPercent}% OFF
                  </span>
                )}
              </div>

              {/* Slide Counter Indicator */}
              <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-black/70 text-white backdrop-blur-md">
                {selectedGalleryIndex + 1} / {gallery.length + (hasVideo ? 1 : 0)}
              </div>
            </div>

            {/* Gallery Thumbnails List */}
            {(gallery.length > 1 || hasVideo) && (
              <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1 select-none">
                {gallery.map((img, idx) => {
                  const isSelected = !isShowingVideo && selectedGalleryIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedGalleryIndex(idx)}
                      className={`w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 relative transition-all cursor-pointer bg-gray-50 border ${
                        isSelected ? "border-[#FC7A00] ring-2 ring-[#FC7A00]/30 scale-105" : "border-gray-200 opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt={`Thumbnail ${idx}`} className="w-full h-full object-contain p-1" />
                    </button>
                  );
                })}

                {hasVideo && (
                  <button
                    type="button"
                    onClick={() => setSelectedGalleryIndex(gallery.length)}
                    className={`w-14 h-14 rounded-2xl overflow-hidden flex-shrink-0 relative transition-all cursor-pointer bg-gray-900 text-white flex flex-col items-center justify-center border ${
                      isShowingVideo ? "border-[#FC7A00] ring-2 ring-[#FC7A00]/30 scale-105" : "border-gray-800 opacity-70 hover:opacity-100"
                    }`}
                  >
                    <span className="material-symbols-outlined text-[20px] text-[#FC7A00]">play_circle</span>
                    <span className="text-[7.5px] font-black uppercase tracking-wider mt-0.5">Video</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Temu-Style Title, Price & Ratings Section */}
          <div className="bg-white rounded-3xl p-4 min-[375px]:p-5 shadow-xs space-y-3 border border-gray-200/60">
            {/* Price Box */}
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl min-[375px]:text-3xl font-black text-[#FC7A00]">
                  ₦{product.price.toLocaleString()}
                </span>
                {listPrice > product.price && (
                  <span className="font-mono text-xs min-[375px]:text-sm text-gray-400 line-through">
                    ₦{listPrice.toLocaleString()}
                  </span>
                )}
              </div>

              <span className={`px-3 py-1 rounded-full text-[9.5px] font-black uppercase ${
                product.inStock ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-red-50 text-red-600 border border-red-200"
              }`}>
                {product.inStock ? "In Stock • Fast Dispatch" : "Out of Stock"}
              </span>
            </div>

            {/* Title */}
            <h2 className="font-hanken font-extrabold text-base min-[375px]:text-lg text-black leading-snug">
              {product.title}
            </h2>

            {/* Rating Stars & Sold Counter */}
            <div className="flex items-center gap-3 pt-1 border-t border-gray-100 text-xs">
              <div className="flex items-center gap-1 text-amber-500 font-black">
                <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                  star
                </span>
                <span>{product.rating || "4.9"}</span>
                <span className="text-gray-400 text-[10px] font-normal">(128 reviews)</span>
              </div>
              <span className="text-gray-300">•</span>
              <div className="text-gray-600 font-bold text-[11px] flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-gray-500">local_mall</span>
                <span>{product.soldCount || "420+"} sold</span>
              </div>
            </div>
          </div>

          {/* Trust & Guarantee Badges Card */}
          <div className="bg-gradient-to-r from-orange-50/80 via-amber-50/50 to-orange-50/80 rounded-3xl p-4 shadow-3xs border border-orange-200/60 space-y-2.5">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#FC7A00] text-white flex items-center justify-center flex-shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[18px]">verified_user</span>
              </div>
              <div>
                <h4 className="font-hanken font-black text-xs uppercase text-black">Buyer Protection & Quality Guarantee</h4>
                <p className="font-hanken text-[10px] text-gray-600 font-medium">100% Genuine Hardware • Express Doorstep Dispatch</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-200/60 text-[10.5px] font-bold text-gray-700">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">check_circle</span>
                <span>Instant Wallet Charge</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-emerald-600">published_with_changes</span>
                <span>7-Day Easy Returns</span>
              </div>
            </div>
          </div>

          {/* Quantity Selector Card */}
          <div className="bg-white rounded-3xl p-4 shadow-xs flex items-center justify-between border border-gray-200/60">
            <span className="font-hanken text-xs font-black uppercase text-gray-700">Quantity</span>
            <div className="flex items-center gap-3 bg-gray-100 p-1.5 rounded-2xl">
              <button
                type="button"
                onClick={() => setProductQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-8 rounded-xl bg-white text-black font-extrabold text-base flex items-center justify-center active:scale-90 cursor-pointer shadow-xs border-0"
              >
                -
              </button>
              <span className="font-mono font-black text-sm w-6 text-center">{productQuantity}</span>
              <button
                type="button"
                onClick={() => setProductQuantity((q) => q + 1)}
                className="w-8 h-8 rounded-xl bg-white text-black font-extrabold text-base flex items-center justify-center active:scale-90 cursor-pointer shadow-xs border-0"
              >
                +
              </button>
            </div>
          </div>

          {/* Detailed Product Description & Specifications */}
          <div className="bg-white rounded-3xl p-4 min-[375px]:p-5 shadow-xs space-y-3.5 border border-gray-200/60">
            <div className="flex items-center gap-2 text-black pb-2 border-b border-gray-150">
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">description</span>
              <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black">
                Product Specifications & Overview
              </h3>
            </div>

            <p className="font-hanken text-xs text-gray-700 leading-relaxed font-medium">
              {product.description || "High-grade hardware and equipment engineered for premium performance, longevity, and durability."}
            </p>

            {/* Specifications Specs list if provided */}
            {Array.isArray(product.specs) && product.specs.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="font-hanken font-black text-[11px] uppercase tracking-wider text-gray-500">Key Features:</h4>
                <div className="grid grid-cols-1 gap-2">
                  {product.specs.map((spec, i) => (
                    <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-gray-50 text-xs font-semibold text-gray-800 border border-gray-150">
                      <span className="material-symbols-outlined text-[16px] text-[#FC7A00]">check</span>
                      <span>{spec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Related / "Products You May Like" Carousel */}
          {displayRecs.length > 0 && (
            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between px-1">
                <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">thumb_up</span>
                  Products You May Like
                </h3>
              </div>

              <div className="flex gap-3 overflow-x-auto no-scrollbar py-1 select-none">
                {displayRecs.slice(0, 8).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => router.push(`/store/product/${rec.id}`)}
                    className="w-36 flex-shrink-0 bg-white shadow-xs rounded-2xl p-2.5 space-y-2 cursor-pointer hover:shadow-md transition-all border border-gray-200/70"
                  >
                    <div className="w-full h-24 rounded-xl bg-gray-50 overflow-hidden relative flex items-center justify-center p-1">
                      {rec.imageUrl ? (
                        <img src={rec.imageUrl} alt={rec.title} className="w-full h-full object-contain p-1" />
                      ) : (
                        <span className="material-symbols-outlined text-[24px] text-gray-300">storefront</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-hanken font-bold text-[11px] text-black uppercase line-clamp-1 leading-tight">
                        {rec.title}
                      </h4>
                      <p className="font-mono font-black text-xs text-[#FC7A00] mt-0.5">
                        ₦{rec.price.toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* Fixed Temu-Style Bottom Action Bar with Modern UI Icons */}
        <div className="fixed bottom-0 left-0 right-0 p-3 min-[375px]:p-4 bg-white/95 backdrop-blur-xl border-t border-gray-200/90 flex items-center gap-2 min-[375px]:gap-3 shadow-2xl z-50 max-w-md mx-auto">
          {/* Heart Wishlist Icon Button */}
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`p-3 rounded-2xl flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer border-0 ${
              isWishlisted ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Wishlist"
          >
            <span
              className="material-symbols-outlined text-[20px]"
              style={{ fontVariationSettings: isWishlisted ? '"FILL" 1' : '"FILL" 0' }}
            >
              favorite
            </span>
            <span className="text-[8px] font-black uppercase mt-0.5">Saved</span>
          </button>

          {/* Add to Cart Button */}
          <button
            type="button"
            disabled={!product.inStock}
            onClick={() => handleAddToCart(productQuantity)}
            className="flex-1 py-3.5 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-sm"
          >
            <span className="material-symbols-outlined text-[18px] text-orange-400">add_shopping_cart</span>
            <span>Add to Cart</span>
          </button>

          {/* Buy Now Button */}
          <button
            type="button"
            disabled={!product.inStock}
            onClick={() => {
              handleAddToCart(productQuantity, false);
              setIsCartOpen(true);
            }}
            className="flex-1 py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] disabled:from-gray-300 disabled:to-gray-400 text-white rounded-2xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
          >
            <span className="material-symbols-outlined text-[18px]">bolt</span>
            <span>Buy Now</span>
          </button>
        </div>

        {/* Full Screen Shopping Cart Modal (Same unified checkout flow) */}
        <AnimatePresence>
          {isCartOpen && (
            <motion.div
              initial={{ opacity: 0, y: "100%" }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              className="fixed inset-0 bg-white z-[100002] flex flex-col text-black overflow-hidden"
            >
              <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between z-10 border-b border-gray-150">
                <button
                  type="button"
                  onClick={() => setIsCartOpen(false)}
                  className="w-10 h-10 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-800 hover:text-black active:scale-90 transition-all cursor-pointer"
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
                  className="w-10 h-10 rounded-full border-0 bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-500 hover:text-black cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px] font-bold">close</span>
                </button>
              </div>

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
                      className="mt-2 px-6 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all"
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

                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, -1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer"
                        >
                          -
                        </button>
                        <span className="font-mono font-black text-xs w-4 text-center">{quantity}</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateCartQuantity(product.id, 1)}
                          className="w-8 h-8 rounded-lg border border-gray-300 bg-white text-xs font-bold flex items-center justify-center active:scale-90 cursor-pointer"
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
                </div>
              )}

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
                        Back to Cart
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

        {/* Confirmed Order Modal */}
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
                onClick={() => {
                  setConfirmedOrder(null);
                  router.push("/store");
                }}
                className="w-full py-3 bg-[#FC7A00] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90"
              >
                Close & Return to Store
              </button>
            </div>
          </div>
        )}
      </div>
    </RouteGuard>
  );
}
