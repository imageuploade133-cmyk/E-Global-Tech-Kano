"use client";

import React, { useState, useEffect } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { useAuth } from "@/lib/AuthContext";
import { toast } from "sonner";
import Link from "next/link";
import {
  EstateProperty,
  EstateSeller,
  PropertyPurpose,
  PropertyType,
} from "@/estate/types";
import {
  PropertyCard,
  PropertyDetailModal,
  SellerProfileModal,
} from "@/components/estate";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

export default function EstateMarketplacePage() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL ||
    user?.photoURL ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [properties, setProperties] = useState<EstateProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedPurpose, setSelectedPurpose] = useState<PropertyPurpose | "ALL">("ALL");
  const [selectedType, setSelectedType] = useState<PropertyType | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Selected Property Detail Modal
  const [selectedProperty, setSelectedProperty] = useState<EstateProperty | null>(null);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Agent Profile Modal State
  const [inspectedSeller, setInspectedSeller] = useState<EstateSeller | null>(null);

  useModalBackHandler(Boolean(selectedProperty), () => setSelectedProperty(null), "estate-detail-modal");
  useModalBackHandler(Boolean(inspectedSeller), () => setInspectedSeller(null), "estate-seller-profile-modal");

  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      let url = "/api/estate/properties";
      const params = new URLSearchParams();

      if (selectedPurpose !== "ALL") params.append("purpose", selectedPurpose);
      if (selectedType !== "ALL") params.append("type", selectedType);
      if (searchQuery.trim()) params.append("query", searchQuery.trim());

      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (data.success && Array.isArray(data.properties)) {
        setProperties(data.properties);
      }
    } catch (err) {
      console.warn("Failed to load estate properties:", err);
      toast.error("Unable to load estate listings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, [selectedPurpose, selectedType]);

  const handleToggleFavorite = async (e: React.MouseEvent, property: EstateProperty) => {
    e.stopPropagation();
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/estate/favorites", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ propertyId: property.id }),
      });

      const data = await res.json();
      if (data.success) {
        if (data.saved) {
          setFavorites((prev) => [...prev, property.id]);
          toast.success(`Saved "${property.title}" to favorites.`);
        } else {
          setFavorites((prev) => prev.filter((id) => id !== property.id));
          toast.info(`Removed "${property.title}" from saved.`);
        }
      }
    } catch {
      toast.error("Failed to toggle saved property.");
    }
  };

  const handleOpenSellerProfile = (sellerId?: string, sellerName?: string, sellerPhone?: string) => {
    setInspectedSeller({
      uid: sellerId || "agent-id",
      displayName: sellerName || "Partner Agent",
      agencyName: "Verified Estate Agent",
      phone: sellerPhone || "N/A",
      email: "contact@estate.agent",
      address: "Verified Marketplace Partner",
      isVerified: true,
      verificationStatus: "VERIFIED",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  const handleSubmitInquiry = async (message: string) => {
    if (!selectedProperty) return;
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/estate/inquiries", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          propertyTitle: selectedProperty.title,
          sellerId: selectedProperty.sellerId,
          message,
          userName: userData?.name || user?.displayName || "",
          userPhone: userData?.phoneNumber || "",
          userEmail: userData?.email || user?.email || "",
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Inquiry sent to property agent successfully!");
      } else {
        toast.error(data.error || "Failed to send inquiry.");
      }
    } catch {
      toast.error("Network error submitting inquiry.");
    }
  };

  const handleReportProperty = async (reason: string, details: string) => {
    if (!selectedProperty) return;
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/estate/favorites", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          propertyId: selectedProperty.id,
          propertyTitle: selectedProperty.title,
          reason,
          details,
        }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success("Listing report submitted for admin investigation.");
      } else {
        toast.error(data.error || "Failed to submit report.");
      }
    } catch {
      toast.error("Network error submitting report.");
    }
  };

  return (
    <RouteGuard>
      <div id="estate-page-root" className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-7xl mx-auto pt-3 px-4 md:px-8 flex-grow pb-28 text-black">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 p-4 rounded-3xl bg-white border border-gray-150 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center flex-shrink-0 shadow-xs">
                <span className="material-symbols-outlined text-[#FC7A00] text-[26px]">
                  domain
                </span>
              </div>
              <div>
                <h1 className="font-bodoni text-xl md:text-2xl font-bold tracking-tight text-black">
                  Estate Marketplace
                </h1>
                <p className="font-hanken text-xs text-gray-500 font-medium">
                  Houses, Apartments, Duplexes & Land for Rent or Sale
                </p>
              </div>
            </div>

            <Link
              href="/estate/seller"
              className="px-4 py-2.5 rounded-2xl bg-[#FC7A00] hover:bg-[#e06600] text-white text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 flex-shrink-0 shadow-xs border-0"
            >
              <span className="material-symbols-outlined text-[18px]">add_home_work</span>
              <span>Seller / Agent Hub</span>
            </Link>
          </div>

          {/* Search Box with Gradient Border */}
          <div className="relative w-full mb-4 bg-gradient-to-r from-[#FC7A00] via-amber-400 to-[#E06600] p-[1.5px] rounded-2xl shadow-2xs">
            <div className="relative w-full bg-white rounded-[14.5px] flex items-center">
              <span className="material-symbols-outlined absolute left-3.5 text-gray-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") fetchProperties();
                }}
                placeholder="Search Lekki duplex, Ikeja apartment, land for sale..."
                className="w-full bg-transparent border-0 pl-11 pr-10 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    fetchProperties();
                  }}
                  className="absolute right-3 text-gray-400 hover:text-black border-0"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
              )}
            </div>
          </div>

          {/* Purpose Filter Pills */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-3 select-none">
            {[
              { id: "ALL" as const, label: "All Purposes" },
              { id: "Rent" as const, label: "For Rent" },
              { id: "Sale" as const, label: "For Sale" },
              { id: "Short-let" as const, label: "Short-let" },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelectedPurpose(p.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap border-0 cursor-pointer transition-all ${
                  selectedPurpose === p.id
                    ? "bg-[#FC7A00] text-white shadow-2xs"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Property Type Filter Chips */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2 mb-5 select-none">
            {[
              "ALL",
              "Apartment",
              "House",
              "Duplex",
              "Villa",
              "Land",
              "Shop",
              "Office",
              "Commercial property",
            ].map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setSelectedType(t as any)}
                className={`px-3.5 py-1.5 rounded-xl text-[11px] font-extrabold uppercase tracking-wider whitespace-nowrap border-0 cursor-pointer transition-all ${
                  selectedType === t
                    ? "bg-black text-white"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          {/* Listings Directory Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div
                  key={i}
                  className="h-72 bg-white border border-gray-150 rounded-2xl p-3 animate-pulse space-y-3"
                >
                  <div className="w-full h-40 bg-gray-100 rounded-xl" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-gray-150 shadow-xs">
              <span className="material-symbols-outlined text-[56px] text-gray-300">
                domain_disabled
              </span>
              <h3 className="font-bodoni font-bold text-lg text-black">No Properties Found</h3>
              <p className="font-hanken text-xs text-gray-500 max-w-sm mx-auto">
                No active property listings matched your current filter or search criteria.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {properties.map((prop) => (
                <PropertyCard
                  key={prop.id}
                  property={prop}
                  onOpenDetails={(p) => setSelectedProperty(p)}
                  onSaveFavorite={handleToggleFavorite}
                  isSaved={favorites.includes(prop.id)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Selected Property Detail Sheet Modal */}
        <PropertyDetailModal
          isOpen={Boolean(selectedProperty)}
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onSubmitInquiry={handleSubmitInquiry}
          onReportProperty={handleReportProperty}
          onInspectAgent={() => {
            if (selectedProperty) {
              handleOpenSellerProfile(selectedProperty.sellerId, selectedProperty.sellerName, selectedProperty.sellerPhone);
            }
          }}
        />

        {/* Inspected Seller / Agent Profile Modal */}
        <SellerProfileModal
          isOpen={Boolean(inspectedSeller)}
          seller={inspectedSeller}
          onClose={() => setInspectedSeller(null)}
        />

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
