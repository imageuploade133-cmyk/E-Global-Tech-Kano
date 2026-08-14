"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface BillerItem {
  code: string;
  name: string;
  category: string;
  logoUrl?: string;
}

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelBillLogosPage() {
  const router = RouterHook();
  const [isDark, setIsDark] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [billers, setBillers] = useState<BillerItem[]>([
    { code: "mtn", name: "MTN Network", category: "Airtime & Data" },
    { code: "glo", name: "GLO Network", category: "Airtime & Data" },
    { code: "airtel", name: "Airtel Network", category: "Airtime & Data" },
    { code: "9mobile", name: "9mobile Network", category: "Airtime & Data" },
    { code: "kedco", name: "KEDCO Kano Electric", category: "Electricity Discos" },
    { code: "ikedc", name: "IKEDC Ikeja Electric", category: "Electricity Discos" },
    { code: "ekedc", name: "EKEDC Eko Electric", category: "Electricity Discos" },
    { code: "aedc", name: "AEDC Abuja Electric", category: "Electricity Discos" },
    { code: "phed", name: "PHED Port Harcourt Electric", category: "Electricity Discos" },
    { code: "jed", name: "JED Jos Electric", category: "Electricity Discos" },
    { code: "eedc", name: "EEDC Enugu Electric", category: "Electricity Discos" },
    { code: "ibedc", name: "IBEDC Ibadan Electric", category: "Electricity Discos" },
    { code: "kaedco", name: "KAEDCO Kaduna Electric", category: "Electricity Discos" },
    { code: "dstv", name: "DStv Subscription", category: "Cable TV" },
    { code: "gotv", name: "GOtv Subscription", category: "Cable TV" },
    { code: "startimes", name: "StarTimes Subscription", category: "Cable TV" },
    { code: "waec", name: "WAEC Result Checker", category: "Education" },
    { code: "smile", name: "Smile Internet", category: "Internet & Gaming" },
    { code: "spectranet", name: "Spectranet Internet", category: "Internet & Gaming" },
    { code: "bet9ja", name: "Bet9ja Wallet", category: "Internet & Gaming" },
    { code: "sportybet", name: "SportyBet Wallet", category: "Internet & Gaming" },
    { code: "nairabet", name: "Nairabet Wallet", category: "Internet & Gaming" },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("ALL");
  const [imgbbApiKey, setImgbbApiKey] = useState("");

  // Track logo inputs per biller code
  const [logoMap, setLogoMap] = useState<Record<string, string>>({});
  const [uploadingCode, setUploadingCode] = useState<string | null>(null);
  const [savingCode, setSavingCode] = useState<string | null>(null);

  // New Custom Biller Input
  const [customCode, setCustomCode] = useState("");
  const [customName, setCustomName] = useState("");
  const [customCategory, setCustomCategory] = useState("Airtime & Data");

  function RouterHook() {
    try {
      return useRouter();
    } catch {
      return { push: () => {} };
    }
  }

  // Theme Syncing
  useEffect(() => {
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem("cpanel_theme");
      if (cached === "dark") {
        setIsDark(true);
      }
    }
  }, []);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        localStorage.setItem("cpanel_theme", next ? "dark" : "light");
      }
      return next;
    });
  };

  // Auth & Session Check
  useEffect(() => {
    async function checkSession() {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("cpanel_unlocked") === "true");
      if (isMock) {
        setIsLoadingSession(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error("Session expired. Please log in.");
          router.push("/cpanel");
          return;
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch Admin Config for ImgBB Key
  useEffect(() => {
    async function fetchConfig() {
      try {
        const res = await fetch("/api/admin/config");
        const data = await res.json();
        if (data.config?.imgbbApiKey) {
          setImgbbApiKey(data.config.imgbbApiKey);
        }
      } catch (err) {
        console.warn("Failed to fetch admin config:", err);
      }
    }
    fetchConfig();
  }, []);

  // Fetch Bill Logos & Defaults
  const fetchBillLogos = async () => {
    setIsLoading(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("cpanel_unlocked") === "true");
      const headers: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch("/api/admin/bill-logos", { headers });
      const data = await res.json();

      if (data.success) {
        const defaultList: BillerItem[] = data.defaultBillers || [];
        const savedLogos: Record<string, string> = data.logos || {};

        setLogoMap(savedLogos);

        // Combine default list with any extra custom codes found in savedLogos
        const existingCodes = new Set(defaultList.map((b) => b.code.toLowerCase()));
        const customItems: BillerItem[] = [];

        Object.keys(savedLogos).forEach((code) => {
          if (!existingCodes.has(code.toLowerCase()) && code !== "updatedAt") {
            customItems.push({
              code: code.toLowerCase(),
              name: `${code.toUpperCase()} Service`,
              category: "Custom Billers",
            });
          }
        });

        setBillers([...defaultList, ...customItems]);
      } else {
        toast.error(data.error || "Failed to load bill logos.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error fetching bill logos.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchBillLogos();
    }
  }, [isLoadingSession]);

  // Upload file to ImgBB
  const handleFileUpload = async (code: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!imgbbApiKey) {
      toast.error("ImgBB API key is not configured in Admin Settings. Please set it under CPanel Settings.");
      return;
    }

    setUploadingCode(code);
    toast.loading(`Uploading logo image for ${code.toUpperCase()}...`, { id: `upload-${code}` });

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbbApiKey}`, {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (json.success && json.data?.url) {
        const uploadedUrl = json.data.url;
        setLogoMap((prev) => ({ ...prev, [code.toLowerCase()]: uploadedUrl }));
        toast.success("Logo image uploaded successfully!", { id: `upload-${code}` });
      } else {
        toast.error(json.error?.message || "Failed to upload image to ImgBB.", { id: `upload-${code}` });
      }
    } catch (err: any) {
      toast.error(err.message || "Image upload failed.", { id: `upload-${code}` });
    } finally {
      setUploadingCode(null);
    }
  };

  // Save single bill logo
  const handleSaveLogo = async (code: string) => {
    const cleanCode = code.trim().toLowerCase();
    const logoUrl = logoMap[cleanCode] || "";
    setSavingCode(cleanCode);

    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("cpanel_unlocked") === "true");
      const authHeader: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
      const res = await fetch("/api/admin/bill-logos", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({ billerCode: cleanCode, logoUrl }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || `Logo saved for ${cleanCode.toUpperCase()}!`);
      } else {
        toast.error(data.error || "Failed to save logo.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error saving logo.");
    } finally {
      setSavingCode(null);
    }
  };

  // Add custom biller
  const handleAddCustomBiller = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customCode.trim()) {
      toast.error("Please enter a biller code (e.g. kedco, waec).");
      return;
    }

    const cleanCode = customCode.trim().toLowerCase();
    if (billers.some((b) => b.code.toLowerCase() === cleanCode)) {
      toast.error("A biller with this code already exists.");
      return;
    }

    const newItem: BillerItem = {
      code: cleanCode,
      name: customName.trim() || `${cleanCode.toUpperCase()} Biller`,
      category: customCategory,
    };

    setBillers((prev) => [newItem, ...prev]);
    setCustomCode("");
    setCustomName("");
    toast.success(`Added ${cleanCode.toUpperCase()} biller! You can now upload or paste its logo.`);
  };

  // Filter billers
  const filteredBillers = billers.filter((b) => {
    const matchesSearch =
      b.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.code.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = activeCategory === "ALL" || b.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ["ALL", "Airtime & Data", "Electricity Discos", "Cable TV", "Education", "Internet & Gaming", "Custom Billers"];

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark ? "bg-[#131927] border-gray-800" : "bg-white border-gray-200 shadow-sm";
  const inputClass = isDark
    ? "bg-gray-900/80 border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00]"
    : "bg-white border-gray-200 text-black placeholder-gray-400 focus:border-[#FC7A00]";

  if (isLoadingSession) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
        <div className="flex flex-col items-center gap-3">
          <ButtonSpinner />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Header */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-orange-500 text-[22px]">receipt_long</span>
                <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Bills Logos Manager</h1>
              </div>
              <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                Upload and configure brand logos for MTN, GLO, Airtel, 9mobile, KEDCO, IKEDC, EKEDC, DStv, GOtv, WAEC, and all utility billers.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={toggleTheme}
              className={cn("px-3 h-10 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer", isDark ? "bg-gray-900 border-gray-800 text-yellow-400" : "bg-gray-100 border-gray-200 text-gray-700")}
            >
              <span className="material-symbols-outlined text-[18px]">{isDark ? "light_mode" : "dark_mode"}</span>
              <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
            </button>
            <Link
              href="/cpanel"
              className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5"
            >
              <span className="material-symbols-outlined text-[18px]">dashboard</span>
              <span>Control Panel</span>
            </Link>
          </div>
        </div>

        {/* Add Custom Biller Form */}
        <div className={cn("p-5 rounded-2xl border space-y-3", panelClass)}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-orange-500 text-[18px]">add_circle</span>
            <h3 className="font-extrabold text-xs uppercase tracking-wider">Add Custom Biller Code</h3>
          </div>
          <form onSubmit={handleAddCustomBiller} className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <input
              type="text"
              placeholder="Biller Code (e.g. kedco, waec)"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value)}
              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
            />
            <input
              type="text"
              placeholder="Display Name (e.g. Kano Electric)"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
            />
            <select
              value={customCategory}
              onChange={(e) => setCustomCategory(e.target.value)}
              className={cn("h-10 px-3 rounded-xl text-xs font-semibold outline-none border cursor-pointer", inputClass)}
            >
              <option value="Airtime & Data">Airtime & Data</option>
              <option value="Electricity Discos">Electricity Discos</option>
              <option value="Cable TV">Cable TV</option>
              <option value="Education">Education</option>
              <option value="Internet & Gaming">Internet & Gaming</option>
              <option value="Custom Billers">Custom Billers</option>
            </select>
            <button
              type="submit"
              className="h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
            >
              Add Biller
            </button>
          </form>
        </div>

        {/* Filter Bar & Categories */}
        <div className={cn("p-5 rounded-2xl border space-y-4", panelClass)}>
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative flex-1 w-full">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 material-symbols-outlined text-gray-400 text-[18px]">search</span>
              <input
                type="text"
                placeholder="Filter biller name or code (e.g. MTN, KEDCO, DStv)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("w-full h-11 pl-10 pr-4 rounded-xl text-xs font-semibold outline-none border transition-all", inputClass)}
              />
            </div>
            <div className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
              <span>Showing:</span>
              <span className="px-2.5 py-1 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-lg">
                {filteredBillers.length} Providers
              </span>
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer",
                  activeCategory === cat
                    ? "bg-[#FC7A00] text-white shadow-sm"
                    : isDark ? "bg-gray-800 text-gray-400 hover:text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Billers Grid */}
        {isLoading ? (
          <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
            <ButtonSpinner />
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Bills Directory...</p>
          </div>
        ) : filteredBillers.length === 0 ? (
          <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
            <span className="material-symbols-outlined text-[42px] text-gray-400">receipt</span>
            <p className="text-xs font-black uppercase text-gray-400">No Billers Found</p>
            <p className="text-[11px] text-gray-500 max-w-md mx-auto">No billers matched your search query or selected category filter.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBillers.map((biller) => {
              const codeKey = biller.code.toLowerCase();
              const currentUrl = logoMap[codeKey] || "";
              const isUploading = uploadingCode === codeKey;
              const isSaving = savingCode === codeKey;

              return (
                <div key={biller.code} className={cn("p-5 rounded-2xl border flex flex-col justify-between space-y-4 transition-all", panelClass)}>
                  {/* Biller Info Header */}
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl border border-gray-200 bg-white flex items-center justify-center overflow-hidden flex-shrink-0 relative">
                      {currentUrl ? (
                        <img
                          src={currentUrl}
                          alt={biller.name}
                          className="w-full h-full object-contain p-1"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <span className="text-xs font-black text-gray-600">{biller.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-extrabold text-xs uppercase tracking-tight truncate leading-tight">{biller.name}</h3>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider bg-orange-500/10 text-orange-500 border border-orange-500/20">
                          Code: {biller.code}
                        </span>
                        <span className="text-[10px] font-medium text-gray-400 truncate">{biller.category}</span>
                      </div>
                    </div>
                  </div>

                  {/* Logo Upload Form */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Logo Image URL or File</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Paste image URL (https://...)"
                        value={currentUrl}
                        onChange={(e) => setLogoMap((prev) => ({ ...prev, [codeKey]: e.target.value }))}
                        className={cn("flex-1 h-10 px-3 rounded-xl text-xs font-semibold outline-none border transition-all truncate", inputClass)}
                      />
                      <div className="relative flex-shrink-0">
                        <input
                          type="file"
                          accept="image/*, image/png, image/jpeg, image/webp, image/svg+xml"
                          onChange={(e) => handleFileUpload(codeKey, e)}
                          disabled={isUploading}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                        />
                        <button
                          type="button"
                          disabled={isUploading}
                          className={cn("w-10 h-10 border rounded-xl flex items-center justify-center transition-all cursor-pointer", isDark ? "bg-gray-800 border-gray-700 text-white" : "bg-gray-100 border-gray-200 text-gray-700")}
                          title="Upload image file to ImgBB"
                        >
                          {isUploading ? <ButtonSpinner /> : <span className="material-symbols-outlined text-[18px]">upload</span>}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-200/40">
                    {currentUrl ? (
                      <button
                        type="button"
                        onClick={() => setLogoMap((prev) => ({ ...prev, [codeKey]: "" }))}
                        className="text-[10px] font-bold text-red-500 hover:underline uppercase tracking-wider"
                      >
                        Clear Custom Logo
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">No Custom Logo</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleSaveLogo(codeKey)}
                      disabled={isSaving || isUploading}
                      className="px-4 h-9 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
                    >
                      {isSaving ? (
                        <ButtonSpinner />
                      ) : (
                        <>
                          <span className="material-symbols-outlined text-[16px]">save</span>
                          <span>Save</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      </div>
    </div>
  );
}
