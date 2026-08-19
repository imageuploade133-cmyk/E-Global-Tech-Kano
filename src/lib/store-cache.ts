export interface StoreItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
  images?: string[];
  coverImageUrl?: string;
  videoUrl?: string;
  autoSlide?: boolean;
  inStock: boolean;
  specs?: string[];
  features?: string[];
}

export interface StoreSlide {
  id: string;
  imageUrl: string;
  title: string;
  subtitle: string;
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

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  imageUrl?: string;
  backupUrl?: string;
  iconName?: string;
  isHidden?: boolean;
  sortOrder?: number;
}

export interface StoreSettings {
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

export interface CartItem {
  product: StoreItem;
  quantity: number;
}

const CACHE_KEY = "e_tech_store_cache";
const CART_KEY = "e_tech_store_cart";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL for low Firestore reads

let memoryStoreCache: { items: StoreItem[]; slides: StoreSlide[]; categories: StoreCategory[]; settings: StoreSettings; timestamp: number } | null = null;
const memoryProductDetails = new Map<string, StoreItem>();

export const getCachedStore = (): { items: StoreItem[]; slides: StoreSlide[]; categories: StoreCategory[]; settings: StoreSettings } | null => {
  if (memoryStoreCache && (Date.now() - memoryStoreCache.timestamp < CACHE_TTL_MS)) {
    return { items: memoryStoreCache.items, slides: memoryStoreCache.slides, categories: memoryStoreCache.categories, settings: memoryStoreCache.settings };
  }

  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
          memoryStoreCache = parsed;
          return { items: parsed.items, slides: parsed.slides, categories: parsed.categories || [], settings: parsed.settings || {} };
        }
      }
    } catch {
      // Ignore cache parse errors
    }
  }

  return null;
};

export const setCachedStore = (items: StoreItem[], slides: StoreSlide[], categories: StoreCategory[] = [], settings: StoreSettings = {}) => {
  const cacheData = { items, slides, categories, settings, timestamp: Date.now() };
  memoryStoreCache = cacheData;

  items.forEach((item) => {
    memoryProductDetails.set(item.id, item);
  });

  if (typeof window !== "undefined") {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));
    } catch {
      // Ignore storage write errors
    }
  }
};

export const getCachedProductDetail = (id: string): StoreItem | null => {
  if (memoryProductDetails.has(id)) {
    return memoryProductDetails.get(id) || null;
  }

  const cachedStore = getCachedStore();
  if (cachedStore) {
    const found = cachedStore.items.find((item) => item.id === id);
    if (found) {
      memoryProductDetails.set(id, found);
      return found;
    }
  }

  return null;
};

export const getSavedCart = (): CartItem[] => {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const saveCart = (cart: CartItem[]) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  } catch {
    // Ignore storage errors
  }
};
