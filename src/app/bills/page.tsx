"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import BannerSlideshow from "@/components/BannerSlideshow";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { useModalBackHandler } from "@/lib/useModalBackHandler";
import { AppLogo } from "@/components/AppLogo";

interface Biller {
  id: number;
  name: string;
  biller_code: string;
  logo: string;
}

interface BillItem {
  id: number;
  biller_code: string;
  name: string;
  item_code: string;
  amount: number;
  is_fixed_amount: boolean;
}

const BILLS_CACHE_TTL_MS = 10 * 60 * 1000; // 10 Minutes Cache Expiration TTL

function getBillsCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`vtu_cache_${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.timestamp || !parsed.data) return null;
    if (Date.now() - parsed.timestamp > BILLS_CACHE_TTL_MS) {
      sessionStorage.removeItem(`vtu_cache_${key}`);
      return null;
    }
    return parsed.data as T;
  } catch {
    return null;
  }
}

function setBillsCache<T>(key: string, data: T): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(
      `vtu_cache_${key}`,
      JSON.stringify({ timestamp: Date.now(), data })
    );
  } catch {
    // Ignore storage quota errors
  }
}

// Global flat micro spinner
const ButtonSpinner = () => (
  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

export default function GenericBillPage() {
  const { userData, user } = useAuth();
  const searchParams = useSearchParams();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [pagePreloading, setPagePreloading] = useState(true);

  useEffect(() => {
    try {
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch (err) {
      console.warn("scrollTo failed:", err);
    }
    const timer = setTimeout(() => {
      setPagePreloading(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, []);

  // Wallet Balance sync
  const balance = Number(userData?.balance) || 0;
  const bonusBalance = Number(userData?.bonusBalance) || 0;

  // Selected Wallet Type
  const [walletTypeSelected, setWalletTypeSelected] = useState<"MAIN" | "BONUS">("MAIN");

  // Determine Category from URL query or default to AIRTIME
  const pageCategory = ((searchParams ? searchParams.get("type") : "AIRTIME") || "AIRTIME").toUpperCase();

  // Dynamic States
  const [billers, setBillers] = useState<Biller[]>([]);
  const [items, setItems] = useState<BillItem[]>([]);

  const [selectedBiller, setSelectedBiller] = useState<Biller | null>(null);
  const [selectedItem, setSelectedItem] = useState<BillItem | null>(null);

  // Active data categorisation/tab state
  const [activeDataTab, setActiveDataTab] = useState<string>("ALL");

  const [customerId, setCustomerId] = useState<string>("");
  const [customAmount, setCustomAmount] = useState<string>("");
  const [validatedName, setValidatedName] = useState<string>("");

  // Loading States
  const [isBillersLoading, setIsBillersLoading] = useState<boolean>(false);
  const [isItemsLoading, setIsItemsLoading] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isPaying, setIsPaying] = useState<boolean>(false);

  // Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState<boolean>(false);

  // PIN Pad Modal States
  const [isPinModalOpen, setIsPinModalOpen] = useState<boolean>(false);
  const [enteredPin, setEnteredPin] = useState<string>("");
  const [keypadNumbers, setKeypadNumbers] = useState<string[]>([]);

  // Payment Success Screen States
  const [successReceipt, setSuccessReceipt] = useState<{ reference?: string; tx_ref?: string; amount?: number; pins?: Array<{ pin: string; serial?: string }> } | null>(null);

  // Mute background scrolling & intercept mobile hardware back button across bills drawers
  useModalBackHandler(isCheckoutModalOpen, () => setIsCheckoutModalOpen(false), "bills-checkout-modal");
  useModalBackHandler(isPinModalOpen, () => setIsPinModalOpen(false), "bills-pin-modal");
  useModalBackHandler(Boolean(successReceipt), () => setSuccessReceipt(null), "bills-receipt-modal");

  const getPageTitle = () => {
    switch (pageCategory) {
      case "AIRTIME": return "Buy Airtime";
      case "DATA": return "Buy Mobile Data";
      case "BETTING": return "Betting Account Funding";
      case "CABLE": return "Cable TV Bills";
      case "UTILITY": return "Electricity Utility Bills";
      case "INTERNET": return "Internet Subscriptions";
      case "WAEC": return "Buy WAEC PINs";
      default: return "Bill Payments";
    }
  };

  const getReviewModalTitle = () => {
    switch (pageCategory) {
      case "AIRTIME": return "Review Airtime Purchase";
      case "DATA": return "Review Data Purchase";
      case "UTILITY": return "Review Electricity Purchase";
      case "CABLE": return "Review Cable TV Subscription";
      case "WAEC": return "Review WAEC Scratch Card Purchase";
      default: return "Review Order Details";
    }
  };

  const getPageIcon = () => {
    switch (pageCategory) {
      case "AIRTIME": return "call";
      case "DATA": return "network_wifi";
      case "BETTING": return "sports_basketball";
      case "CABLE": return "tv";
      case "UTILITY": return "bolt";
      case "INTERNET": return "language";
      case "WAEC": return "school";
      default: return "payments";
    }
  };

  // Suffle Keypad logic matching Auth PIN Page
  const shuffleKeypad = () => {
    const numbers = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
    for (let i = numbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
    }
    setKeypadNumbers(numbers);
  };

  useEffect(() => {
    shuffleKeypad();
  }, [isPinModalOpen]);

  // Prevent background scrolling while pay bills PIN keypad modal is active
  useEffect(() => {
    if (isPinModalOpen || isCheckoutModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isPinModalOpen, isCheckoutModalOpen]);

  // Fetch billers and custom logo overrides when pageCategory changes (with 10-min cache)
  useEffect(() => {
    async function fetchBillers() {
      setIsBillersLoading(true);
      setSelectedBiller(null);
      setSelectedItem(null);
      setItems([]);
      setCustomerId("");
      setCustomAmount("");
      setValidatedName("");

      const cacheKey = `billers_${pageCategory}`;
      const cachedBillers = getBillsCache<Biller[]>(cacheKey);
      if (cachedBillers && Array.isArray(cachedBillers) && cachedBillers.length > 0) {
        setBillers(cachedBillers);
        setIsBillersLoading(false);
        return;
      }

      try {
        // Fetch custom bill logo overrides from backend
        let customLogos: Record<string, string> = {};
        try {
          const logosRes = await fetch("/api/bills/logos");
          const logosData = await logosRes.json();
          if (logosData.success && logosData.logos) {
            customLogos = logosData.logos;
          }
        } catch {
          console.warn("Custom bill logos fetch fallback.");
        }

        const isMock = typeof window !== "undefined" && (sessionStorage.getItem("mock") === "true" || window.location.search.includes("mock=true"));
        if (isMock) {
          let list: Biller[] = [];
          if (pageCategory === "AIRTIME" || pageCategory === "DATA") {
            list = [
              { id: 1, name: "MTN Network", biller_code: "mtn", logo: customLogos["mtn"] || "" },
              { id: 2, name: "GLO Network", biller_code: "glo", logo: customLogos["glo"] || "" },
              { id: 3, name: "AIRTEL Network", biller_code: "airtel", logo: customLogos["airtel"] || "" },
              { id: 4, name: "9MOBILE Network", biller_code: "9mobile", logo: customLogos["9mobile"] || "" }
            ];
          } else if (pageCategory === "UTILITY") {
            list = [
              { id: 1, name: "IKEDC Electricity", biller_code: "ikedc", logo: customLogos["ikedc"] || "" },
              { id: 2, name: "EKEDC Electricity", biller_code: "ekedc", logo: customLogos["ekedc"] || "" },
              { id: 3, name: "KEDCO Electricity", biller_code: "kedco", logo: customLogos["kedco"] || "" }
            ];
          } else if (pageCategory === "CABLE") {
            list = [
              { id: 1, name: "DStv", biller_code: "dstv", logo: customLogos["dstv"] || "" },
              { id: 2, name: "GOtv", biller_code: "gotv", logo: customLogos["gotv"] || "" },
              { id: 3, name: "StarTimes", biller_code: "startimes", logo: customLogos["startimes"] || "" }
            ];
          } else if (pageCategory === "WAEC") {
            list = [
              { id: 1, name: "WAEC Council", biller_code: "waec", logo: customLogos["waec"] || "" }
            ];
          }
          setBillers(list);
          setBillsCache(cacheKey, list);
          setIsBillersLoading(false);
          return;
        }

        let idToken = "mock-token";
        if (user) {
          try {
            idToken = await user.getIdToken();
          } catch (tokErr) {
            console.warn("Failed to get idToken:", tokErr);
          }
        }
        const authHeaders = { "Authorization": `Bearer ${idToken}` };

        let finalBillersList: Biller[] = [];

        if (pageCategory === "AIRTIME" || pageCategory === "DATA") {
          const res = await fetch("/api/vtu/networks", { headers: authHeaders });
          if (!res.ok) throw new Error("Failed to load networks from gateway.");
          const data = await res.json();
          finalBillersList = (data.networks || []).map((name: string, index: number) => {
            const codeKey = name.toLowerCase();
            return {
              id: index + 1,
              name: `${name} Network`,
              biller_code: name,
              logo: customLogos[codeKey] || "",
            };
          });
        } else if (pageCategory === "UTILITY") {
          const companies = ["IKEDC", "EKEDC", "AEDC", "KEDCO", "PHED", "JED", "EEDC", "IBEDC", "KAEDCO"];
          finalBillersList = companies.map((name, index) => {
            const codeKey = name.toLowerCase();
            return {
              id: index + 1,
              name: `${name} Electricity`,
              biller_code: name,
              logo: customLogos[codeKey] || "",
            };
          });
        } else if (pageCategory === "CABLE") {
          const providers = ["DStv", "GOtv", "StarTimes"];
          finalBillersList = providers.map((name, index) => {
            const codeKey = name.toLowerCase();
            return {
              id: index + 1,
              name: name,
              biller_code: codeKey,
              logo: customLogos[codeKey] || "",
            };
          });
        } else if (pageCategory === "WAEC") {
          finalBillersList = [{
            id: 1,
            name: "WAEC Council",
            biller_code: "waec",
            logo: customLogos["waec"] || "",
          }];
        } else {
          const apiCategory = pageCategory;
          const res = await fetch(`/api/bills/billers?category=${apiCategory}`);
          if (!res.ok) throw new Error("Failed to load billing providers.");
          const data = await res.json();
          finalBillersList = (data.data || []).map((b: Biller) => ({
            ...b,
            logo: customLogos[b.biller_code.toLowerCase()] || b.logo || "",
          }));
        }

        setBillers(finalBillersList);
        setBillsCache(cacheKey, finalBillersList);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error fetching billers:", error.message);
        toast.error("Unable to load billing providers.");
      } finally {
        setIsBillersLoading(false);
      }
    }
    fetchBillers();
  }, [pageCategory, user]);

  // Fetch items/packages when selectedBiller changes (with 10-min cache)
  useEffect(() => {
    if (!selectedBiller) return;

    const currentBiller = selectedBiller;

    async function fetchItems() {
      setIsItemsLoading(true);
      setSelectedItem(null);
      setActiveDataTab("ALL");
      setCustomerId("");
      setCustomAmount("");
      setValidatedName("");

      const cacheKey = `items_${pageCategory}_${currentBiller.biller_code}`;
      const cachedItems = getBillsCache<BillItem[]>(cacheKey);
      if (cachedItems && Array.isArray(cachedItems) && cachedItems.length > 0) {
        setItems(cachedItems);
        setIsItemsLoading(false);
        return;
      }

      try {
        const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";
        if (isMock) {
          let list: BillItem[] = [];
          if (pageCategory === "DATA") {
            list = [
              { id: 1, biller_code: currentBiller.biller_code, name: "1 GB - 30 days (SME)", item_code: "sme_1gb", amount: 461, is_fixed_amount: true },
              { id: 2, biller_code: currentBiller.biller_code, name: "2 GB - 30 days (SME)", item_code: "sme_2gb", amount: 922, is_fixed_amount: true },
              { id: 3, biller_code: currentBiller.biller_code, name: "5 GB - 30 days (SME)", item_code: "sme_5gb", amount: 2306, is_fixed_amount: true },
              { id: 4, biller_code: currentBiller.biller_code, name: "125MB - 1 day (Awoof Data)", item_code: "awoof_125", amount: 97, is_fixed_amount: true },
              { id: 5, biller_code: currentBiller.biller_code, name: "2.5GB - Weekend Plan - [Sat & Sun]", item_code: "weekend_25", amount: 485, is_fixed_amount: true }
            ];
          } else if (pageCategory === "AIRTIME") {
            list = [{ id: 1, biller_code: currentBiller.biller_code, name: `${currentBiller.name} Airtime topup`, item_code: "airtime", amount: 0, is_fixed_amount: false }];
          } else if (pageCategory === "UTILITY") {
            list = [
              { id: 1, biller_code: currentBiller.biller_code, name: "Prepaid Meter Bill Payment", item_code: "prepaid", amount: 0, is_fixed_amount: false },
              { id: 2, biller_code: currentBiller.biller_code, name: "Postpaid Meter Bill Payment", item_code: "postpaid", amount: 0, is_fixed_amount: false }
            ];
          } else if (pageCategory === "CABLE") {
            list = [
              { id: 1, biller_code: currentBiller.biller_code, name: "GOtv Max", item_code: "gotv_max", amount: 4850, is_fixed_amount: true },
              { id: 2, biller_code: currentBiller.biller_code, name: "GOtv Jolli", item_code: "gotv_jolli", amount: 3300, is_fixed_amount: true }
            ];
          } else if (pageCategory === "WAEC") {
            list = [
              { id: 1, biller_code: currentBiller.biller_code, name: "WAEC Result Checker PIN", item_code: "waec_checker", amount: 3500, is_fixed_amount: true }
            ];
          }
          setItems(list);
          setBillsCache(cacheKey, list);
          setIsItemsLoading(false);
          return;
        }

        let idToken = "mock-token";
        if (user) {
          try {
            idToken = await user.getIdToken();
          } catch (tokErr) {
            console.warn("Failed to get idToken:", tokErr);
          }
        }
        const authHeaders = { "Authorization": `Bearer ${idToken}` };

        let finalItemList: BillItem[] = [];

        if (pageCategory === "DATA") {
          const res = await fetch(`/api/vtu/data/plans?network=${currentBiller.biller_code}`, { headers: authHeaders });
          if (!res.ok) throw new Error("Failed to load data plans from gateway.");
          const data = await res.json();
          finalItemList = (data.data || []).map((plan: { item_code: string; name: string; amount: number; plan_code: string }, index: number) => ({
            id: index + 1,
            biller_code: currentBiller.biller_code,
            name: plan.name,
            item_code: plan.item_code,
            amount: plan.amount,
            is_fixed_amount: true,
          }));
        } else if (pageCategory === "AIRTIME") {
          finalItemList = [{
            id: 1,
            biller_code: currentBiller.biller_code,
            name: `${currentBiller.name} Airtime topup`,
            item_code: "airtime",
            amount: 0,
            is_fixed_amount: false,
          }];
        } else if (pageCategory === "UTILITY") {
          finalItemList = [
            {
              id: 1,
              biller_code: currentBiller.biller_code,
              name: "Prepaid Meter Bill Payment",
              item_code: "prepaid",
              amount: 0,
              is_fixed_amount: false,
            },
            {
              id: 2,
              biller_code: currentBiller.biller_code,
              name: "Postpaid Meter Bill Payment",
              item_code: "postpaid",
              amount: 0,
              is_fixed_amount: false,
            }
          ];
        } else if (pageCategory === "CABLE") {
          const res = await fetch(`/api/vtu/cable/packages?provider=${currentBiller.biller_code}`, { headers: authHeaders });
          if (!res.ok) throw new Error("Failed to load bouquets from gateway.");
          const data = await res.json();
          finalItemList = (data.data || []).map((pkg: { item_code: string; name: string; amount: number; package_code: string }, index: number) => ({
            id: index + 1,
            biller_code: currentBiller.biller_code,
            name: pkg.name,
            item_code: pkg.package_code || pkg.item_code,
            amount: pkg.amount,
            is_fixed_amount: true,
          }));
        } else if (pageCategory === "WAEC") {
          const res = await fetch(`/api/vtu/waec/products`, { headers: authHeaders });
          if (!res.ok) throw new Error("Failed to load WAEC products.");
          const data = await res.json();
          finalItemList = (data.data || []).map((prod: { item_code: string; name: string; amount: number; product_code: string }, index: number) => ({
            id: index + 1,
            biller_code: currentBiller.biller_code,
            name: prod.name,
            item_code: prod.product_code || prod.item_code,
            amount: prod.amount,
            is_fixed_amount: true,
          }));
        } else {
          const res = await fetch(`/api/bills/items?biller_code=${currentBiller.biller_code}`, { headers: authHeaders });
          if (!res.ok) throw new Error("Failed to load packages.");
          const data = await res.json();
          finalItemList = data.data || [];
        }

        setItems(finalItemList);
        setBillsCache(cacheKey, finalItemList);
      } catch (err: unknown) {
        const error = err as Error;
        console.error("Error fetching items:", error.message);
        toast.error("Unable to load billing packages.");
      } finally {
        setIsItemsLoading(false);
      }
    }
    fetchItems();
  }, [selectedBiller, pageCategory, user]);

  // Parse details for data plan presentation
  const parseDataPlan = (name: string) => {
    const sizeMatch = name.match(/(\d+(?:\.\d+)?\s*(?:GB|MB))/i);
    const durationMatch = name.match(/\(([^)]+)\)/);

    const gbSize = sizeMatch ? sizeMatch[1] : "";
    const duration = durationMatch ? durationMatch[1] : "30 Days";

    let cleanedName = name;
    if (sizeMatch && gbSize) {
      cleanedName = name.replace(sizeMatch[0], "").replace(/\([^)]+\)/, "").trim();
    }
    cleanedName = cleanedName.replace(/^(MTN|GLO|Airtel|9mobile|Smile|Spectranet)\s+(Mobile\s+)?(Data\s+)?(Plan\s+)?/i, "");

    return {
      size: gbSize || "Data Plan",
      duration,
      displayName: cleanedName || "Standard Plan"
    };
  };

  // Helper to categorize data plans into tabs based on plan attributes
  const getDataPlanCategory = (plan: BillItem): string => {
    const nameLower = plan.name.toLowerCase();

    if (nameLower.includes("weekend") || nameLower.includes("sat & sun") || nameLower.includes("[sun]")) {
      return "WEEKEND";
    }
    if (nameLower.includes("1 gb") || nameLower.includes("1gb") || nameLower.includes("1000 mb") || nameLower.includes("1000mb")) {
      return "1GB";
    }
    if (nameLower.includes("1 day") || nameLower.includes("2 day") || nameLower.includes("daily") || nameLower.includes("awoof") || nameLower.includes("awooof")) {
      return "DAILY";
    }
    if (nameLower.includes("7 days") || nameLower.includes("14 days") || nameLower.includes("weekly")) {
      return "WEEKLY";
    }
    return "MONTHLY";
  };

  // Compute final transaction amount dynamically
  const finalAmount = selectedItem
    ? (pageCategory === "WAEC"
        ? selectedItem.amount * (Number(customerId) || 1)
        : (selectedItem.is_fixed_amount ? selectedItem.amount : Number(customAmount)))
    : 0;

  // Frontend input validation checks
  const isAirtimeInvalid = pageCategory === "AIRTIME" && (Number(customAmount) < 100 || Number(customAmount) > 50000);

  // Interactive Validation handler
  const handleValidateCustomer = async () => {
    if (!selectedBiller || !selectedItem || !customerId) {
      toast.error("Please select a provider, package, and enter your customer ID.");
      return;
    }

    setIsValidating(true);
    setValidatedName("");

    try {
      let res;
      if (pageCategory === "UTILITY") {
        res = await fetch(`/api/vtu/electricity/validate?provider=${selectedBiller.biller_code}&meterNo=${customerId}&meterType=${selectedItem.item_code}`);
      } else if (pageCategory === "CABLE") {
        res = await fetch(`/api/vtu/cable/validate?provider=${selectedBiller.biller_code}&smartCardNo=${customerId}`);
      } else {
        res = await fetch("/api/bills/validate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            item_code: selectedItem.item_code,
            customer_id: customerId,
            biller_code: selectedBiller.biller_code,
          }),
        });
      }

      const resData = await res.json();

      if (!res.ok || !resData.success) {
        throw new Error(resData.error || resData.message || "Customer validation failed. Please check identifier.");
      }

      setValidatedName(resData.name || "VALIDATED CUSTOMER");
      if (resData.address) {
        setValidatedName((prev) => `${prev} (${resData.address})`);
      }
      toast.success("Billing verification successful!");
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[Customer Validation Error]:", error.message);
      toast.error(error.message || "Unable to verify recipient with provider.");
    } finally {
      setIsValidating(false);
    }
  };

  // Submit trigger - Opens Pin Keypad Modal
  const handlePayTrigger = () => {
    if (!selectedBiller || !selectedItem || !customerId) {
      toast.error("Please fill out all billing details.");
      return;
    }

    if (!finalAmount || finalAmount <= 0) {
      toast.error("Please specify a valid payment amount.");
      return;
    }

    if (isAirtimeInvalid) {
      toast.error("Airtime amount must be between ₦100 and ₦50,000.");
      return;
    }

    const currentSelectedBalance = walletTypeSelected === "BONUS" ? bonusBalance : balance;
    if (finalAmount > currentSelectedBalance) {
      toast.error(`Insufficient ${walletTypeSelected === "BONUS" ? "bonus reward" : "wallet"} balance. Required: ₦${finalAmount.toLocaleString()}, Available: ₦${currentSelectedBalance.toLocaleString()}`);
      return;
    }

    if (walletTypeSelected === "BONUS") {
      const typeUpper = (pageCategory || "").toUpperCase();
      if (typeUpper === "AIRTIME") {
        if (finalAmount > 200) {
          toast.error("Bonus Airtime purchases are limited to a maximum of ₦200 NGN per day.");
          return;
        }
      } else if (typeUpper === "DATA") {
        const normalizedName = (selectedItem?.name || "").toLowerCase();
        let isWithinLimit = false;
        if (normalizedName.includes("mb") || normalizedName.includes("megabyte")) {
          isWithinLimit = true;
        } else {
          const match = normalizedName.match(/([\d.]+)\s*gb/);
          if (match) {
            const gbVal = parseFloat(match[1]);
            if (!isNaN(gbVal) && gbVal <= 1.0) {
              isWithinLimit = true;
            }
          } else if (normalizedName.includes("1gb") || normalizedName.includes("1 gb")) {
            isWithinLimit = true;
          }
        }
        if (!isWithinLimit && normalizedName) {
          toast.error("Using the bonus wallet, you can only purchase Data plans within a 1GB limit (e.g. 1GB or less).");
          return;
        }
      }
    }

    // Open PIN pad modal and close checkout modal
    setEnteredPin("");
    setIsPinModalOpen(true);
  };

  // PIN entry handlers
  const handlePinPress = (num: string) => {
    if (enteredPin.length < 4) {
      const nextPin = enteredPin + num;
      setEnteredPin(nextPin);
      shuffleKeypad();
      if (nextPin.length === 4) {
        executePayment(nextPin);
      }
    }
  };

  const handlePinDelete = () => {
    setEnteredPin((prev) => prev.slice(0, -1));
    shuffleKeypad();
  };

  // Final Payment execution
  const executePayment = async (pin: string) => {
    setIsPaying(true);
    setIsPinModalOpen(false);
    setIsCheckoutModalOpen(false);
    toast.loading("Verifying your transaction PIN securely...");

    try {
      let idToken = "mock-token";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const pinVerifyRes = await fetch("/api/auth/pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: "verify", pin }),
      });

      const pinData = await pinVerifyRes.json();
      if (!pinVerifyRes.ok || !pinData.success) {
        throw new Error(pinData.message || "Incorrect transaction PIN. Please try again.");
      }

      toast.loading("Processing your transaction with gateway...");

      const isData = pageCategory === "DATA";
      const isAirtime = pageCategory === "AIRTIME";
      const isUtility = pageCategory === "UTILITY";
      const isCable = pageCategory === "CABLE";
      const isWaec = pageCategory === "WAEC";

      if (isAirtime || isData || isUtility || isCable || isWaec) {
        const endpoint = isData ? "/api/vtu/data" : (isUtility ? "/api/vtu/electricity" : (isCable ? "/api/vtu/cable" : (isWaec ? "/api/vtu/waec" : "/api/vtu/airtime")));
        const payload = isData
          ? {
              network: selectedBiller?.biller_code,
              phone: customerId,
              item_code: selectedItem?.item_code,
              walletType: walletTypeSelected,
            }
          : (isUtility
              ? {
                  provider: selectedBiller?.biller_code,
                  meterNo: customerId,
                  meterType: selectedItem?.item_code,
                  amount: finalAmount,
                }
              : (isCable
                  ? {
                      provider: selectedBiller?.biller_code,
                      smartCardNo: customerId,
                      packageCode: selectedItem?.item_code,
                    }
                  : (isWaec
                      ? {
                          productCode: selectedItem?.item_code,
                          quantity: Number(customerId) || 1,
                        }
                      : {
                          network: selectedBiller?.biller_code,
                          phone: customerId,
                          amount: finalAmount,
                          walletType: walletTypeSelected,
                        })));

        let res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify(payload),
        });

        if (res.status === 401) {
          console.log("[VTU Pay] Auth token expired or invalid, forcing refresh and retrying S2S...");
          if (user && typeof user.getIdToken === "function") {
            idToken = await user.getIdToken(true);
          }

          res = await fetch(endpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify(payload),
          });
        }

        const data = await res.json();
        toast.dismiss();

        if (!res.ok || !data.success) {
          throw new Error(data.message || data.error || "Failed to process transaction.");
        }

        setSuccessReceipt({
          reference: data.requestId,
          tx_ref: data.orderId || data.requestId,
          amount: finalAmount,
          pins: data.pins || undefined,
        });
        toast.success("Transaction completed successfully!");
      } else {
        let res = await fetch("/api/bills/pay", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({
            biller_code: selectedBiller?.biller_code,
            item_code: selectedItem?.item_code,
            amount: finalAmount,
            customer_id: customerId,
            biller_name: selectedBiller?.name,
            biller_type: pageCategory.toLowerCase(),
            pin,
            walletType: walletTypeSelected,
          }),
        });

        if (res.status === 401) {
          console.log("[Bills Pay] Auth token expired or invalid, forcing refresh and retrying...");
          if (user && typeof user.getIdToken === "function") {
            idToken = await user.getIdToken(true);
          }

          res = await fetch("/api/bills/pay", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${idToken}`,
            },
            body: JSON.stringify({
              biller_code: selectedBiller?.biller_code,
              item_code: selectedItem?.item_code,
              amount: finalAmount,
              customer_id: customerId,
              biller_name: selectedBiller?.name,
              biller_type: pageCategory.toLowerCase(),
              pin,
              walletType: walletTypeSelected,
            }),
          });
        }

        const data = await res.json();
        toast.dismiss();

        if (!res.ok || !data.success) {
          throw new Error(data.error || "Failed to process bill payment.");
        }

        setSuccessReceipt(data.data);
        toast.success("Bill payment processed successfully!");
      }
    } catch (err: unknown) {
      const error = err as Error;
      toast.dismiss();
      toast.error(error.message || "Your transaction failed. Your wallet balance is safe.");
    } finally {
      setIsPaying(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied!`);
  };

  const getCustomerFieldLabel = () => {
    switch (pageCategory) {
      case "AIRTIME":
      case "DATA":
        return "Phone Number";
      case "BETTING":
        return "User ID";
      case "CABLE":
        return "Smartcard / Decoder Number";
      case "UTILITY":
        return "Meter Number";
      case "WAEC":
        return "Quantity (1-5)";
      default:
        return "Customer Identifier";
    }
  };

  const sortedItems = [...items].sort((a, b) => a.amount - b.amount);

  if (pagePreloading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white/20 backdrop-blur-[1px] p-6">
        <div className="relative flex flex-col items-center">
          <div className="flex flex-col items-center p-5 rounded-2xl bg-white/40 backdrop-blur-md border border-white/30 shadow-[0_8px_32px_rgba(0,0,0,0.03)]">
            <div className="relative w-10 h-10 flex items-center justify-center">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                className="absolute inset-0 rounded-full border-[2px] border-gray-100/80 border-t-[#FC7A00] border-r-[#0b513d]"
              />
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
                className="relative w-7 h-7 bg-white rounded-full flex items-center justify-center overflow-hidden"
              >
                <AppLogo size={24} />
              </motion.div>
            </div>
            <motion.p
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut" }}
              className="mt-3 font-hanken font-bold text-[8px] tracking-[0.25em] uppercase text-gray-500 select-none"
            >
              E-TECH HUB
            </motion.p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 min-[375px]:pb-32 text-black">
          {/* Title Row with Back History Button */}
          <div className="flex items-center gap-4 mb-5">
            <button
              onClick={() => window.history.back()}
              className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black hover:border-gray-200 active:scale-95 transition-all duration-300 cursor-pointer shadow-none"
              title="Go Back"
            >
              <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
            </button>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center flex-shrink-0 shadow-none">
                <span className="material-symbols-outlined text-primary text-[22px]">
                  {getPageIcon()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="font-bodoni text-[18px] min-[375px]:text-[20px] font-bold tracking-tight text-black truncate">
                  {getPageTitle()}
                </h1>
                <p className="font-hanken text-[11px] text-gray-500 font-medium truncate">
                  Settle {getPageTitle().toLowerCase()} instantly using your NGN balance
                </p>
              </div>
            </div>

            <a
              href="/bills/history"
              className="px-3 py-1.5 rounded-xl border border-[#FC7A00]/30 bg-[#FC7A00]/10 text-[#FC7A00] hover:bg-[#FC7A00] hover:text-white transition-all text-xs font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer flex-shrink-0"
              title="View Bills History"
            >
              <span className="material-symbols-outlined text-[16px]">receipt_long</span>
              <span className="hidden min-[360px]:inline">History</span>
            </a>
          </div>

          {/* Marketing Slide Banners - displayed below page title and back history */}
          <BannerSlideshow page="bills" />

          <AnimatePresence mode="wait">
            {successReceipt ? (
              // --- GLASSMORPHIC SUCCESS SCREEN / RECEIPT ---
              <motion.div
                key="receipt"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="premium-gradient-card premium-gradient-border p-6 shadow-none flex flex-col items-center text-center relative overflow-hidden"
              >
                {/* Visual Stamp */}
                <div className="absolute right-[-10px] top-[-10px] text-[120px] text-emerald-500/5 select-none font-bold rotate-12 pointer-events-none">
                  PAID
                </div>

                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mb-4 shadow-none animate-bounce-subtle">
                  <span className="material-symbols-outlined text-[36px]" style={{ fontVariationSettings: '"FILL" 1' }}>
                    check_circle
                  </span>
                </div>

                <h2 className="font-bodoni text-[20px] font-bold text-black mb-1">
                  Payment Successful
                </h2>
                <p className="font-hanken text-[11.5px] text-gray-500 max-w-[280px] leading-relaxed mb-6">
                  Sovereign transaction logged atomically in your secure ledger database.
                </p>

                {/* Receipt Grid */}
                <div className="w-full bg-white border border-gray-150 rounded-2xl p-4 space-y-3 text-left font-hanken text-xs mb-6 shadow-none">
                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Provider</span>
                    <div className="flex items-center gap-1.5">
                      {selectedBiller?.logo && (
                        <div className="w-4 h-4 rounded border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                          <img src={selectedBiller.logo} alt={selectedBiller.name} className="w-full h-full object-contain" />
                        </div>
                      )}
                      <span className="text-black font-extrabold">{selectedBiller?.name}</span>
                    </div>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Package Name</span>
                    <span className="text-black font-extrabold">{selectedItem?.name}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">{getCustomerFieldLabel()}</span>
                    <span className="text-black font-mono font-bold">{customerId}</span>
                  </div>

                  <div className="flex justify-between border-b border-gray-100 pb-2.5 text-gray-500">
                    <span className="font-semibold">Ref Code</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-black font-mono font-bold truncate max-w-[120px]">
                        {successReceipt.reference || successReceipt.tx_ref || "N/A"}
                      </span>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(successReceipt.reference || successReceipt.tx_ref || "N/A", "Reference")}
                        className="text-primary font-bold hover:underline"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  {successReceipt.pins && Array.isArray(successReceipt.pins) && (
                    <div className="border-b border-gray-100 pb-2.5 pt-1 text-gray-500 text-left">
                      <span className="font-semibold block mb-2 text-black">Purchased WAEC E-PINs:</span>
                      <div className="space-y-2">
                        {successReceipt.pins.map((pinObj: { pin: string; serial?: string }, index: number) => (
                          <div key={index} className="p-2.5 bg-gray-50 border border-gray-200 rounded-xl flex flex-col space-y-1">
                            <div className="flex justify-between items-center text-xs">
                              <span className="font-bold text-gray-400">PIN</span>
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-black font-extrabold">{pinObj.pin}</span>
                                <button
                                  type="button"
                                  onClick={() => copyToClipboard(pinObj.pin, "PIN")}
                                  className="text-primary font-black hover:underline"
                                >
                                  Copy
                                </button>
                              </div>
                            </div>
                            {pinObj.serial && (
                              <div className="flex justify-between items-center text-xs">
                                <span className="font-bold text-gray-400">SERIAL</span>
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-black font-bold">{pinObj.serial}</span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(pinObj.serial!, "Serial")}
                                    className="text-primary font-black hover:underline"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-1">
                    <span className="font-black text-black">Total Paid Amount</span>
                    <span className="font-mono text-emerald-600 font-black text-sm">
                      ₦{Number(successReceipt.amount || finalAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setSuccessReceipt(null);
                    setCustomerId("");
                    setCustomAmount("");
                    setSelectedBiller(null);
                    setSelectedItem(null);
                  }}
                  className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/10 cursor-pointer hover:brightness-105 active:scale-98 transition-all"
                >
                  Pay Another Bill
                </button>
              </motion.div>
            ) : (
              // --- FORM AND INPUT CONTAINER Restructured to have separate network and plan cards ---
              <div className="space-y-6">
                {/* Standalone Network Selection Card */}
                <div className="premium-gradient-card premium-gradient-border p-6 shadow-none space-y-4">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                    Choose Network / Provider
                  </label>
                  {isBillersLoading ? (
                    <div className="grid grid-cols-2 gap-3.5">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="h-14 bg-gray-50 border border-gray-200 rounded-2xl animate-pulse" />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {billers.map((b) => {
                        const isSelected = selectedBiller?.id === b.id;
                        return (
                          <button
                            key={b.id}
                            type="button"
                            onClick={() => {
                              setSelectedBiller(b);
                              setSelectedItem(null);
                              setCustomerId("");
                              setCustomAmount("");
                              setValidatedName("");
                            }}
                            className={`p-3 rounded-2xl border text-left transition-all duration-300 flex items-center gap-3 cursor-pointer shadow-none ${
                              isSelected
                                ? "bg-orange-50/50 border-[#FC7A00]"
                                : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                            }`}
                          >
                            <div className={`w-10 h-10 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative ${
                              isSelected ? "border-[#FC7A00]" : ""
                            }`}>
                              {b.logo ? (
                                <img
                                  src={b.logo}
                                  alt={b.name}
                                  className="w-full h-full object-contain p-1"
                                  onError={(e) => {
                                    (e.target as HTMLElement).style.display = "none";
                                  }}
                                />
                              ) : (
                                <span className="font-extrabold text-xs text-gray-700">{b.name.substring(0, 2).toUpperCase()}</span>
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-hanken text-[11px] font-extrabold text-black truncate leading-tight">
                                {b.name}
                              </p>
                              <p className="font-hanken text-[8.5px] text-gray-400 font-bold uppercase tracking-wider mt-0.5">
                                Select
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Standalone Plan Selection Card below Network Card */}
                {selectedBiller && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="premium-gradient-card premium-gradient-border p-6 shadow-none space-y-4"
                  >
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                      Choose Plan / Package
                    </label>
                    {isItemsLoading ? (
                      <div className="grid grid-cols-2 gap-3.5">
                        {[1, 2, 3, 4].map((i) => (
                          <div key={i} className="h-28 bg-gray-50 border border-gray-150 rounded-2xl animate-pulse flex flex-col justify-between p-3.5">
                            <div className="flex justify-between items-center">
                              <div className="h-4 bg-gray-200 rounded w-12" />
                              <div className="h-3 bg-gray-200 rounded w-10" />
                            </div>
                            <div className="h-3 bg-gray-200 rounded w-20 mt-2" />
                            <div className="h-4 bg-gray-200 rounded w-1/2 mt-4" />
                          </div>
                        ))}
                      </div>
                    ) : sortedItems.length === 0 ? (
                      <div className="py-8 text-center text-gray-400 font-hanken text-xs font-semibold">
                        No plans available from this provider.
                      </div>
                    ) : pageCategory === "DATA" ? (
                      <div className="space-y-4">
                        <div className="flex gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin no-scrollbar">
                          {[
                            { id: "ALL", label: "All Plans" },
                            { id: "1GB", label: "1GB / Popular" },
                            { id: "DAILY", label: "Daily Plans" },
                            { id: "WEEKEND", label: "Weekend" },
                            { id: "WEEKLY", label: "Weekly" },
                            { id: "MONTHLY", label: "Monthly / More" }
                          ].map((tab) => {
                            const count = tab.id === "ALL"
                              ? sortedItems.length
                              : sortedItems.filter(item => getDataPlanCategory(item) === tab.id).length;

                            const isTabActive = activeDataTab === tab.id;

                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setActiveDataTab(tab.id)}
                                className={`px-3.5 py-2 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap flex items-center gap-1.5 transition-all duration-200 cursor-pointer border ${
                                  isTabActive
                                    ? "bg-black border-black text-white"
                                    : "bg-white border-gray-150 text-gray-600 hover:border-gray-200"
                                }`}
                              >
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-mono font-black ${
                                  isTabActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                                }`}>
                                  {count}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {(() => {
                          const filteredPlans = sortedItems.filter((item) => {
                            if (activeDataTab === "ALL") return true;
                            return getDataPlanCategory(item) === activeDataTab;
                          });

                          if (filteredPlans.length === 0) {
                            return (
                              <div className="py-8 text-center text-gray-400 font-hanken text-xs font-semibold">
                                No plans available under this category.
                              </div>
                            );
                          }

                          return (
                            <div className="grid grid-cols-2 gap-3 pr-1">
                              {filteredPlans.map((i) => {
                                const isSelected = selectedItem?.id === i.id;
                                const planInfo = parseDataPlan(i.name);

                                return (
                                  <button
                                    key={i.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedItem(i);
                                      setCustomAmount(i.amount.toString());
                                      setCustomerId("");
                                      setValidatedName("");
                                      setIsCheckoutModalOpen(true);
                                    }}
                                    className={`p-3.5 rounded-2xl border text-left flex flex-col justify-between h-[120px] transition-all duration-300 cursor-pointer shadow-none ${
                                      isSelected
                                        ? "bg-orange-50/50 border-[#FC7A00]"
                                        : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                                    }`}
                                  >
                                    <div className="w-full">
                                      <div className="flex justify-between items-start gap-1 w-full">
                                        <span className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-black tracking-tight leading-none ${
                                          isSelected ? "bg-[#FC7A00] text-white" : "bg-gray-200 text-gray-700"
                                        }`}>
                                          {planInfo.size}
                                        </span>
                                        <span className="text-[8px] text-gray-400 font-bold uppercase truncate">
                                          {planInfo.duration}
                                        </span>
                                      </div>
                                      <p className="font-hanken text-[10px] font-extrabold text-black mt-2 leading-tight line-clamp-2">
                                        {planInfo.displayName}
                                      </p>
                                    </div>

                                    <div className="w-full text-right mt-2 pt-1 border-t border-gray-100/30 flex justify-between items-center">
                                      <span className="text-[7.5px] text-gray-400 font-bold uppercase">Price</span>
                                      <span className="font-mono text-[11.5px] font-black text-black">
                                        ₦{i.amount.toLocaleString()}
                                      </span>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}
                      </div>
                    ) : (
                      /* Standard package selector (e.g. Airtime, Cable, Utility) */
                      <div className="max-h-[320px] overflow-y-auto space-y-2 pr-1 no-scrollbar">
                        {sortedItems.map((i) => {
                          const isSelected = selectedItem?.id === i.id;
                          return (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => {
                                setSelectedItem(i);
                                setCustomAmount("");
                                setCustomerId("");
                                setValidatedName("");
                                setIsCheckoutModalOpen(true);
                              }}
                              className={`w-full p-4 rounded-2xl border text-left flex items-center justify-between transition-all duration-300 cursor-pointer shadow-none ${
                                isSelected
                                  ? "bg-orange-50/50 border-[#FC7A00]"
                                  : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                              }`}
                            >
                              <div className="min-w-0 flex-1 pr-3">
                                <p className="font-hanken text-[12px] font-extrabold text-black leading-tight">
                                  {i.name}
                                </p>
                                <p className="font-hanken text-[9px] text-gray-400 font-bold mt-1 uppercase tracking-wider">
                                  {i.is_fixed_amount ? "Standard Package" : "Custom Payment Amount"}
                                </p>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <span className={`px-3 py-1.5 rounded-full font-mono text-[11px] font-black ${
                                  isSelected ? "bg-[#FC7A00] text-white" : "bg-gray-100 text-gray-700"
                                }`}>
                                  {i.is_fixed_amount ? `₦${i.amount.toLocaleString()}` : "Enter Amount"}
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            )}
          </AnimatePresence>
        </main>

        {/* Dynamic high-fidelity checkout bottom-sheet modal */}
        <AnimatePresence>
          {isCheckoutModalOpen && selectedItem && selectedBiller && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCheckoutModalOpen(false)}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[1000]"
              />

              {/* Bottom Sheet Review & Checkout panel */}
              <motion.div
                initial={{ opacity: 0, y: "100%" }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: "100%" }}
                transition={{ type: "spring", damping: 30, stiffness: 280 }}
                className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white rounded-t-[32px] z-[1001] p-6 pb-8 shadow-2xl text-black max-h-[85dvh] overflow-y-auto custom-scrollbar will-change-transform"
              >
                {/* Drag handle */}
                <div className="w-12 h-1.5 bg-gray-200 rounded-full mb-4 mx-auto" />

                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                  <h3 className="font-hanken font-bold text-base text-black uppercase tracking-wide">
                    {getReviewModalTitle()}
                  </h3>
                  <button
                    type="button"
                    onClick={() => setIsCheckoutModalOpen(false)}
                    className="w-8 h-8 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer shadow-none"
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">close</span>
                  </button>
                </div>

                <div className="space-y-5">
                  {/* Selected Plan overview detail card */}
                  <div className="bg-gray-50 border border-gray-150 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-bold uppercase">Provider</span>
                      <div className="flex items-center gap-2">
                        {selectedBiller.logo && (
                          <div className="w-5 h-5 rounded-md border border-gray-200 bg-white flex items-center justify-center overflow-hidden p-0.5 shrink-0">
                            <img
                              src={selectedBiller.logo}
                              alt={selectedBiller.name}
                              className="w-full h-full object-contain"
                              onError={(e) => {
                                (e.target as HTMLElement).style.display = "none";
                              }}
                            />
                          </div>
                        )}
                        <span className="font-black text-black">{selectedBiller.name}</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-gray-400 font-bold uppercase">Plan Package</span>
                      <span className="font-black text-black text-right max-w-[200px] truncate">{selectedItem.name}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs border-t border-gray-100 pt-2 mt-2">
                      <span className="text-gray-400 font-bold uppercase">Price</span>
                      <span className="font-mono font-black text-primary text-sm">
                        ₦{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Payment Source Selection Toggle (Only for Airtime & Data) */}
                  {(pageCategory === "AIRTIME" || pageCategory === "DATA") && (
                    <div className="space-y-2 text-left font-hanken">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
                        Select Payment Wallet
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => setWalletTypeSelected("MAIN")}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-none ${
                            walletTypeSelected === "MAIN"
                              ? "bg-orange-50/50 border-[#FC7A00]"
                              : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-[8.5px] text-gray-400 uppercase">Main Wallet</span>
                            <p className="font-mono text-xs font-bold text-black mt-1">₦{balance.toLocaleString()}</p>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setWalletTypeSelected("BONUS")}
                          className={`p-3 rounded-xl border text-left flex flex-col justify-between transition-all duration-300 cursor-pointer shadow-none ${
                            walletTypeSelected === "BONUS"
                              ? "bg-orange-50/50 border-[#FC7A00]"
                              : "bg-gray-50/50 border-gray-150 hover:bg-gray-50"
                          }`}
                        >
                          <div>
                            <span className="font-bold text-[8.5px] text-gray-400 uppercase">Bonus Wallet</span>
                            <p className="font-mono text-xs font-bold text-emerald-600 mt-1">₦{bonusBalance.toLocaleString()}</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Recipient Details Input Field */}
                  <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      {getCustomerFieldLabel()}
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        placeholder={`Enter your ${getCustomerFieldLabel().toLowerCase()}`}
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                      />
                      {customerId.length >= 6 && (
                        <button
                          type="button"
                          onClick={handleValidateCustomer}
                          disabled={isValidating}
                          className="absolute right-3 top-1/2 -translate-y-1/2 bg-[#FFF0E0] hover:bg-[#FFE0CC] text-primary text-[10px] font-black uppercase px-3 py-2 rounded-xl active:scale-95 transition-all"
                        >
                          {isValidating ? "Validating..." : "Verify"}
                        </button>
                      )}
                    </div>
                  </div>

                  {validatedName && (
                    <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-left">
                      <p className="text-[8px] font-black uppercase text-emerald-600 tracking-wider">
                        Verified Recipient Owner
                      </p>
                      <p className="font-hanken text-xs font-black text-emerald-700 uppercase mt-0.5">
                        {validatedName}
                      </p>
                    </div>
                  )}

                  {/* Manual custom Amount field if not fixed amount */}
                  {!selectedItem.is_fixed_amount && (
                    <div className="space-y-1.5 text-left">
                      <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                        Enter Custom Payment Amount (NGN)
                      </label>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono font-bold text-base text-gray-400">
                          ₦
                        </span>
                        <input
                          type="number"
                          pattern="[0-9]*"
                          inputMode="numeric"
                          placeholder="Amount (e.g. 2000)"
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value.replace(/\D/g, ""))}
                          className="w-full bg-white border border-black rounded-2xl pl-9 pr-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all"
                        />
                      </div>
                      {isAirtimeInvalid && customAmount !== "" && (
                        <p className="text-[10px] text-rose-500 font-bold text-left mt-1">
                          Airtime amount must be between ₦100 and ₦50,000.
                        </p>
                      )}
                    </div>
                  )}

                  {/* Proceed to checkout trigger */}
                  <button
                    type="button"
                    onClick={handlePayTrigger}
                    disabled={isPaying || !customerId || (pageCategory === "AIRTIME" && isAirtimeInvalid) || (finalAmount <= 0)}
                    className="w-full py-4 mt-2 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-xl border border-white/10 cursor-pointer hover:brightness-105 active:scale-98 transition-all disabled:opacity-50"
                  >
                    Proceed to Pay (₦{finalAmount.toLocaleString()})
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Dynamic transaction PIN verification keypad - Full Screen Modal Design */}
        <AnimatePresence>
          {isPinModalOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", damping: 25, stiffness: 280 }}
              className="fixed inset-0 bg-white z-[99999] p-6 flex flex-col justify-between text-black max-w-md mx-auto"
            >
              {/* Back / Close button */}
              <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="w-10 h-10 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-500 hover:text-black transition-all cursor-pointer shadow-none"
                  title="Close Pin Pad"
                >
                  <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
                </button>
                <h3 className="font-hanken font-black text-sm text-black uppercase tracking-wider">
                  Secure Verification
                </h3>
                <div className="w-10" />
              </div>

              {/* Central Details and dots */}
              <div className="flex-grow flex flex-col items-center justify-center space-y-8 py-8">
                {/* Visual Lock Badge */}
                <div className="w-16 h-16 bg-orange-50 border border-orange-100 text-primary rounded-full flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-[30px]" style={{ fontVariationSettings: '"FILL" 1' }}>lock</span>
                </div>

                <div className="text-center space-y-2">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Order Payout Settlement</p>
                  <p className="font-mono text-3xl font-black text-black">
                    ₦{finalAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                  <p className="text-xs text-gray-500 font-semibold max-w-[260px] mx-auto leading-relaxed mt-1">
                    Paying <span className="font-bold text-black">{selectedBiller?.name}</span> for <span className="font-bold text-black">{selectedItem?.name}</span>
                  </p>
                </div>

                <div className="space-y-4 w-full flex flex-col items-center">
                  <p className="font-hanken text-[11px] text-gray-400 text-center max-w-[240px]">
                    Provide your highly secure 4-digit Access PIN to approve this debit transaction.
                  </p>

                  {/* 4 Box PIN Indicators */}
                  <div className="flex justify-center gap-2 pt-1">
                    {[0, 1, 2, 3].map((idx) => (
                      <div
                        key={idx}
                        className={`w-11 h-12 rounded-xl border-2 flex items-center justify-center text-lg font-black transition-all ${
                          enteredPin.length > idx
                            ? "border-[#FC7A00] bg-orange-50/40 text-black"
                            : "border-gray-200 bg-white"
                        }`}
                      >
                        {enteredPin[idx] ? "•" : ""}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Standardized Transaction Keypad Grid */}
                <div className="grid grid-cols-3 gap-2.5 pt-1 w-full max-w-xs mx-auto">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => handlePinPress(num.toString())}
                      className="py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-base font-black text-black cursor-pointer active:scale-95 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEnteredPin("")}
                    className="py-3.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-xs font-bold text-gray-600 cursor-pointer active:scale-95 transition-all"
                  >
                    CLEAR
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePinPress("0")}
                    className="py-3.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl text-base font-black text-black cursor-pointer active:scale-95 transition-all"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handlePinDelete}
                    className="py-3.5 bg-gray-100 hover:bg-gray-200 border border-gray-200 rounded-xl text-gray-600 cursor-pointer active:scale-95 transition-all flex items-center justify-center"
                  >
                    <span className="material-symbols-outlined text-[20px]">backspace</span>
                  </button>
                </div>
              </div>

              <div className="h-4" />
            </motion.div>
          )}
        </AnimatePresence>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
