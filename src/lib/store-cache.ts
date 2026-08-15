export interface StoreItem {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  imageUrl: string;
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
}

export interface CartItem {
  product: StoreItem;
  quantity: number;
}

const CACHE_KEY = "e_tech_store_cache";
const CART_KEY = "e_tech_store_cart";
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes cache TTL for low Firestore reads

// Memory cache for active session
let memoryStoreCache: { items: StoreItem[]; slides: StoreSlide[]; timestamp: number } | null = null;
const memoryProductDetails = new Map<string, StoreItem>();

export const getCachedStore = (): { items: StoreItem[]; slides: StoreSlide[] } | null => {
  // Check memory cache first
  if (memoryStoreCache && (Date.now() - memoryStoreCache.timestamp < CACHE_TTL_MS)) {
    return { items: memoryStoreCache.items, slides: memoryStoreCache.slides };
  }

  // Fallback to sessionStorage
  if (typeof window !== "undefined") {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && (Date.now() - parsed.timestamp < CACHE_TTL_MS)) {
          memoryStoreCache = parsed;
          return { items: parsed.items, slides: parsed.slides };
        }
      }
    } catch {
      // Ignore cache parse errors
    }
  }

  return null;
};

export const setCachedStore = (items: StoreItem[], slides: StoreSlide[]) => {
  const cacheData = { items, slides, timestamp: Date.now() };
  memoryStoreCache = cacheData;

  // Pre-populate product details cache
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

// Persistent Cart Helper Functions
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
