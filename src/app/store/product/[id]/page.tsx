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

interface ProductReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  adminReply?: {
    message: string;
    repliedAt: string;
  } | null;
  createdAt: string;
}

export default function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const productId = resolvedParams.id;

  const router = useRouter();
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Verified Customer") as string;

  const [product, setProduct] = useState<StoreItem | null>(() => getCachedProductDetail(productId));
  const [allItems, setAllItems] = useState<StoreItem[]>(() => {
    const cached = getCachedStore();
    return cached ? cached.items : [];
  });
  const [settings, setSettings] = useState<StoreSettings>(() => {
    const cached = getCachedStore();
    return cached ? cached.settings : {};
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => !getCachedProductDetail(productId));

  // Reviews state
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [isLoadingReviews, setIsLoadingLoadingReviews] = useState(true);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

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

  // Fetch product & reviews data
  useEffect(() => {
    let isMounted = true;

    async function loadProductData() {
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
      } else {
        setIsLoading(true);
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
            }
          }
        } catch (err) {
          console.error("Failed to load product detail:", err);
        } finally {
          if (isMounted) setIsLoading(false);
        }
      }

      // Fetch public reviews
      try {
        const revRes = await fetch(`/api/store/reviews?productId=${productId}`);
        const revData = await revRes.json();
        if (revData.success && isMounted) {
          setReviews(revData.reviews || []);
        }
      } catch (err) {
        console.warn("Failed to fetch product reviews:", err);
      } finally {
        if (isMounted) setIsLoadingLoadingReviews(false);
      }
    }

    loadProductData();

    return () => {
      isMounted = false;
    };
  }, [productId]);

  // Submit Customer Review
  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) {
      toast.error("Please write a comment for your review.");
      return;
    }

    setIsSubmittingReview(true);
    try {
      const res = await fetch("/api/store/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          authorName: userName,
          rating: newRating,
          comment: newComment,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Thank you for your feedback! Review posted.");
        setReviews([data.review, ...reviews]);
        setNewComment("");
        setNewRating(5);
      } else {
        toast.error(data.error || "Failed to submit review.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error submitting review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

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
    } else if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Product link copied to clipboard!");
    }
  };

  if (isLoading && !product) {
    return (
      <RouteGuard>
        <div className="min-h-dvh bg-[#F4F5F7] text-black pb-32">
          <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-4 py-2 border-0 shadow-none">
            <div className="max-w-md mx-auto flex items-center justify-between gap-3">
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
              <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
              <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" />
            </div>
          </header>

          <main className="max-w-md mx-auto pt-1 px-3 space-y-2.5">
            <div className="w-full h-72 rounded-2xl bg-white p-2 animate-pulse flex items-center justify-center">
              <div className="w-full h-full bg-gray-100 rounded-xl" />
            </div>
            <div className="bg-white rounded-2xl p-4 space-y-2 animate-pulse">
              <div className="h-5 bg-gray-200 rounded w-1/3" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
            </div>
          </main>
        </div>
      </RouteGuard>
    );
  }

  if (!product) {
    return (
      <RouteGuard>
        <div className="min-h-dvh bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
          <div className="w-16 h-16 rounded-3xl bg-orange-50 flex items-center justify-center mb-4">
            <span className="material-symbols-outlined text-[36px] text-[#FC7A00]">error_outline</span>
          </div>
          <h2 className="font-bodoni text-xl font-bold text-black mb-2">Product Not Found</h2>
          <p className="font-hanken text-xs text-gray-500 max-w-xs mb-6">
            The product you are looking for may have been removed or is temporarily unavailable.
          </p>
          <button
            type="button"
            onClick={() => router.push("/store")}
            className="px-6 py-3 bg-[#FC7A00] text-white rounded-2xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all shadow-sm cursor-pointer border-0"
          >
            Return to Store
          </button>
        </div>
      </RouteGuard>
    );
  }

  const gallery = getProductGallery(product);
  const activeImgUrl = gallery[selectedGalleryIndex] || gallery[0] || product.imageUrl;

  const listPrice = product.originalPrice || Math.round(product.price * 1.25);
  const discountPercent = Math.round(((listPrice - product.price) / listPrice) * 100);

  const recommendedProducts = allItems.filter(
    (i) => i.id !== product.id && i.category.toLowerCase() === product.category.toLowerCase()
  );
  const displayRecs = recommendedProducts.length > 0 ? recommendedProducts : allItems.filter((i) => i.id !== product.id);

  const isSharingEnabled = settings.enableProductSharing !== false;

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-[#F4F5F7] text-black pb-28">
        {/* Sticky Top Header Bar - Minimal Space */}
        <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md px-3.5 py-2 border-0 shadow-none">
          <div className="max-w-md mx-auto flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-800 flex items-center justify-center active:scale-90 transition-all cursor-pointer border-0"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[18px] font-bold">arrow_back</span>
            </button>

            <div className="text-center min-w-0 flex-1 px-1">
              <h1 className="font-hanken font-black text-xs uppercase tracking-wide text-black truncate">
                {product.title}
              </h1>
              <p className="font-hanken text-[8.5px] text-[#FC7A00] font-black uppercase tracking-widest truncate">
                {product.category}
              </p>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {/* Product Sharing Icon (Controlled by Admin Setting) */}
              {isSharingEnabled && (
                <button
                  type="button"
                  onClick={handleShareProduct}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-700 flex items-center justify-center active:scale-95 transition-all cursor-pointer border-0"
                  title="Share Product"
                >
                  <span className="material-symbols-outlined text-[17px]">share</span>
                </button>
              )}

              {/* Heart Wishlist Icon */}
              <button
                type="button"
                onClick={handleToggleWishlist}
                className={`w-8 h-8 rounded-full flex items-center justify-center active:scale-95 transition-all cursor-pointer border-0 ${
                  isWishlisted ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
                title="Save to Wishlist"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ fontVariationSettings: isWishlisted ? '"FILL" 1' : '"FILL" 0' }}
                >
                  favorite
                </span>
              </button>

              {/* Cart Icon */}
              <button
                type="button"
                onClick={() => setIsCartOpen(true)}
                className="relative w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center active:scale-95 transition-all cursor-pointer border-0"
                title="Shopping Cart"
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{ color: settings.topBarCartIconColor || "#FC7A00" }}
                >
                  shopping_bag
                </span>
                {totalCartItems > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#FC7A00] text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border border-white">
                    {totalCartItems}
                  </span>
                )}
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Area - Temu/Alibaba Minimal Space Standard Layout */}
        <main className="max-w-md mx-auto pt-1 px-3 space-y-2.5">
          {/* Hero Media Carousel */}
          <div className="bg-white rounded-2xl p-2.5 shadow-3xs space-y-2 border-0">
            <div className="w-full h-72 min-[375px]:h-80 rounded-xl bg-gray-50 relative overflow-hidden flex items-center justify-center p-2">
              {activeImgUrl ? (
                <Image
                  src={activeImgUrl}
                  alt={product.title}
                  fill
                  className="object-contain p-1"
                  unoptimized
                />
              ) : (
                <span className="material-symbols-outlined text-[64px] text-gray-300">storefront</span>
              )}

              {/* Badging */}
              <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                <span className="px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-black/80 text-white backdrop-blur-md">
                  {product.category}
                </span>
                {discountPercent > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-red-600 text-white shadow-xs">
                    -{discountPercent}%
                  </span>
                )}
              </div>

              <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-black/70 text-white backdrop-blur-md">
                {selectedGalleryIndex + 1} / {gallery.length}
              </div>
            </div>

            {/* Gallery Thumbnails */}
            {gallery.length > 1 && (
              <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5 select-none">
                {gallery.map((img, idx) => {
                  const isSelected = selectedGalleryIndex === idx;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setSelectedGalleryIndex(idx)}
                      className={`w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 relative transition-all cursor-pointer bg-gray-50 border-0 ${
                        isSelected ? "ring-2 ring-[#FC7A00] scale-105" : "opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-contain p-0.5" />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pricing & Title Block */}
          <div className="bg-white rounded-2xl p-3.5 shadow-3xs space-y-2 border-0">
            <div className="flex items-baseline justify-between gap-2">
              <div className="flex items-baseline gap-2">
                <span className="font-mono text-2xl font-black text-[#FC7A00]">
                  ₦{product.price.toLocaleString()}
                </span>
                {listPrice > product.price && (
                  <span className="font-mono text-xs text-gray-400 line-through">
                    ₦{listPrice.toLocaleString()}
                  </span>
                )}
              </div>

              <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase ${
                product.inStock ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>
                {product.inStock ? "In Stock" : "Out of Stock"}
              </span>
            </div>

            <h2 className="font-hanken font-extrabold text-sm min-[375px]:text-base text-black leading-snug">
              {product.title}
            </h2>

            <div className="flex items-center gap-2.5 pt-1 text-[11px] text-gray-600">
              <div className="flex items-center gap-1 text-amber-500 font-bold">
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                  star
                </span>
                <span>{product.rating || "4.9"}</span>
              </div>
              <span className="text-gray-300">•</span>
              <span className="font-medium text-gray-500">{reviews.length} Customer Reviews</span>
              <span className="text-gray-300">•</span>
              <span className="font-bold text-gray-700">{product.soldCount || "250+"} Sold</span>
            </div>
          </div>

          {/* Quantity Selector */}
          <div className="bg-white rounded-2xl p-3 shadow-3xs flex items-center justify-between border-0">
            <span className="font-hanken text-xs font-black uppercase text-gray-700">Quantity</span>
            <div className="flex items-center gap-2.5 bg-gray-100 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setProductQuantity((q) => Math.max(1, q - 1))}
                className="w-7 h-7 rounded-lg bg-white text-black font-extrabold text-sm flex items-center justify-center active:scale-90 cursor-pointer border-0 shadow-2xs"
              >
                -
              </button>
              <span className="font-mono font-black text-xs w-5 text-center">{productQuantity}</span>
              <button
                type="button"
                onClick={() => setProductQuantity((q) => q + 1)}
                className="w-7 h-7 rounded-lg bg-white text-black font-extrabold text-sm flex items-center justify-center active:scale-90 cursor-pointer border-0 shadow-2xs"
              >
                +
              </button>
            </div>
          </div>

          {/* Description & Overview */}
          <div className="bg-white rounded-2xl p-3.5 shadow-3xs space-y-2 border-0">
            <div className="flex items-center gap-1.5 text-black">
              <span className="material-symbols-outlined text-[#FC7A00] text-[18px]">description</span>
              <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black">
                Product Details
              </h3>
            </div>
            <p className="font-hanken text-xs text-gray-700 leading-relaxed font-medium">
              {product.description || "Premium quality product built with high reliability and genuine components."}
            </p>
          </div>

          {/* Customer Reviews & Feedback Section */}
          <div className="bg-white rounded-2xl p-3.5 shadow-3xs space-y-3 border-0">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[#FC7A00] text-[18px]">rate_review</span>
                <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black">
                  Customer Reviews ({reviews.length})
                </h3>
              </div>
            </div>

            {/* Write a Review Form */}
            <form onSubmit={handleSubmitReview} className="space-y-2.5 bg-gray-50/80 p-3 rounded-xl border-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-extrabold uppercase text-gray-500">Leave Your Feedback</span>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewRating(star)}
                      className="text-amber-400 cursor-pointer transition-transform active:scale-110"
                    >
                      <span
                        className="material-symbols-outlined text-[18px]"
                        style={{ fontVariationSettings: star <= newRating ? '"FILL" 1' : '"FILL" 0' }}
                      >
                        star
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={2}
                required
                placeholder="Share your experience with this product..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full p-2.5 bg-white rounded-xl text-xs font-medium outline-none border-0 shadow-2xs resize-none"
              />

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full py-2 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all shadow-2xs disabled:opacity-50"
              >
                {isSubmittingReview ? "Posting Review..." : "Submit Review"}
              </button>
            </form>

            {/* Reviews List */}
            {isLoadingReviews ? (
              <p className="text-[10px] font-bold text-gray-400 uppercase text-center py-4">Loading Reviews...</p>
            ) : reviews.length === 0 ? (
              <p className="text-[11px] font-medium text-gray-400 text-center py-4">No reviews posted yet. Be the first to review!</p>
            ) : (
              <div className="space-y-2.5">
                {reviews.map((rev) => (
                  <div key={rev.id} className="p-3 bg-gray-50 rounded-xl space-y-1.5 border-0">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs uppercase text-gray-900">{rev.authorName}</span>
                      <div className="flex items-center text-amber-400">
                        {[...Array(rev.rating)].map((_, i) => (
                          <span key={i} className="material-symbols-outlined text-[13px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                            star
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-700 font-medium leading-snug">{rev.comment}</p>

                    {/* Official Admin Reply Bubble */}
                    {rev.adminReply && (
                      <div className="mt-2 p-2.5 rounded-lg bg-orange-100/70 text-orange-950 text-[11px] space-y-0.5">
                        <div className="flex items-center gap-1 font-bold text-[#FC7A00]">
                          <span className="material-symbols-outlined text-[14px]">support_agent</span>
                          <span>Store Support Reply:</span>
                        </div>
                        <p className="font-medium leading-relaxed">{rev.adminReply.message}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Related Products Carousel */}
          {displayRecs.length > 0 && (
            <div className="space-y-2 pt-1">
              <h3 className="font-hanken font-extrabold text-xs uppercase tracking-wider text-black flex items-center gap-1.5 px-1">
                <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">thumb_up</span>
                Recommended For You
              </h3>

              <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1 select-none">
                {displayRecs.slice(0, 8).map((rec) => (
                  <div
                    key={rec.id}
                    onClick={() => router.push(`/store/product/${rec.id}`)}
                    className="w-32 flex-shrink-0 bg-white shadow-3xs rounded-xl p-2 space-y-1.5 cursor-pointer hover:shadow-xs transition-all border-0"
                  >
                    <div className="w-full h-20 rounded-lg bg-gray-50 relative overflow-hidden flex items-center justify-center p-1">
                      {rec.imageUrl ? (
                        <img src={rec.imageUrl} alt={rec.title} className="w-full h-full object-contain p-0.5" />
                      ) : (
                        <span className="material-symbols-outlined text-[20px] text-gray-300">storefront</span>
                      )}
                    </div>
                    <div>
                      <h4 className="font-hanken font-bold text-[10.5px] text-black uppercase line-clamp-1 leading-tight">
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

        {/* Fixed Temu-Style Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 p-3 bg-white/95 backdrop-blur-xl border-0 flex items-center gap-2 shadow-2xl z-50 max-w-md mx-auto">
          <button
            type="button"
            onClick={handleToggleWishlist}
            className={`p-2.5 rounded-xl flex flex-col items-center justify-center active:scale-95 transition-all cursor-pointer border-0 ${
              isWishlisted ? "bg-red-50 text-red-500" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
            title="Wishlist"
          >
            <span
              className="material-symbols-outlined text-[18px]"
              style={{ fontVariationSettings: isWishlisted ? '"FILL" 1' : '"FILL" 0' }}
            >
              favorite
            </span>
            <span className="text-[7.5px] font-black uppercase mt-0.5">Saved</span>
          </button>

          <button
            type="button"
            disabled={!product.inStock}
            onClick={() => handleAddToCart(productQuantity)}
            className="flex-1 py-3 bg-gray-900 hover:bg-black disabled:bg-gray-300 text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 border-0"
          >
            <span className="material-symbols-outlined text-[16px] text-orange-400">add_shopping_cart</span>
            <span>Add to Cart</span>
          </button>

          <button
            type="button"
            disabled={!product.inStock}
            onClick={() => {
              handleAddToCart(productQuantity, false);
              setIsCartOpen(true);
            }}
            style={{
              backgroundColor: settings.storeButtonColor || "#FC7A00",
              color: settings.storeButtonTextColor || "#FFFFFF",
            }}
            className="flex-1 py-3 hover:opacity-90 disabled:from-gray-300 disabled:to-gray-400 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1 shadow-md border-0"
          >
            <span className="material-symbols-outlined text-[16px]">{settings.storeButtonIcon || "bolt"}</span>
            <span>Buy Now</span>
          </button>
        </div>

        {/* Shopping Cart Drawer */}
        <AnimatePresence>
          {isCartOpen && (
            <div className="fixed inset-0 z-[100002] flex flex-col justify-end">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCartOpen(false)}
                className="fixed inset-0 bg-black/50 backdrop-blur-xs"
              />

              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 300 }}
                className="relative bg-white rounded-t-[28px] max-h-[90vh] h-[85vh] flex flex-col text-black shadow-2xl z-10 max-w-md mx-auto w-full overflow-hidden"
              >
                <div className="w-12 h-1.5 bg-gray-300 rounded-full mx-auto my-2.5 flex-shrink-0" />

                <div className="px-5 pb-3.5 flex items-center justify-between flex-shrink-0 border-b border-gray-100">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">shopping_bag</span>
                    <div>
                      <h2 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                        Shopping Cart
                      </h2>
                      <p className="font-hanken text-[9.5px] text-gray-400 font-bold uppercase tracking-widest">
                        {totalCartItems} {totalCartItems === 1 ? "Item" : "Items"} Selected
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsCartOpen(false)}
                    className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 hover:text-black transition-colors cursor-pointer border-0"
                    title="Close"
                  >
                    <span className="material-symbols-outlined text-[18px]">close</span>
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 space-y-3.5 custom-scrollbar pb-36">
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
                        className="mt-2 px-6 py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer active:scale-95 transition-all border-0 shadow-xs"
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
                            className="p-1.5 text-gray-400 hover:text-red-500 transition-colors ml-1 cursor-pointer border-0"
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
                  <div className="p-5 bg-white border-t border-gray-100 space-y-3 shadow-lg z-20 flex-shrink-0">
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
                      className="w-full text-center text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider cursor-pointer transition-colors border-0"
                    >
                      Clear Shopping Cart
                    </button>
                  </div>
                )}

                {isCheckoutStep && (
                  <div className="absolute inset-0 bg-white z-30 p-5 overflow-y-auto flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                        <button
                          type="button"
                          onClick={() => setIsCheckoutStep(false)}
                          className="flex items-center gap-1 text-xs font-bold text-gray-600 hover:text-black border-0"
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
            </div>
          )}
        </AnimatePresence>

        {/* Confirmed Order Modal */}
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
                onClick={() => {
                  setConfirmedOrder(null);
                  router.push("/store");
                }}
                className="w-full py-3 bg-[#FC7A00] text-white rounded-xl font-black text-xs uppercase tracking-wider hover:opacity-90 border-0"
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
