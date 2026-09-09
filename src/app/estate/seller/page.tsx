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
  PropertyStatus,
} from "@/estate/types";
import {
  PropertyCard,
  PropertyDetailModal,
  AddPropertyModal,
  SellerProfileModal,
} from "@/components/estate";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

export default function EstateSellerDashboard() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL ||
    user?.photoURL ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  const [sellerProfile, setSellerProfile] = useState<EstateSeller | null>(null);
  const [properties, setProperties] = useState<EstateProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Status Filter
  const [activeTab, setActiveTab] = useState<PropertyStatus | "ALL">("ALL");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState<EstateProperty | null>(null);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isSavingSeller, setIsSavingSeller] = useState(false);
  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false);

  useModalBackHandler(isAddModalOpen, () => setIsAddModalOpen(false), "seller-add-modal");
  useModalBackHandler(Boolean(selectedProperty), () => setSelectedProperty(null), "seller-detail-modal");
  useModalBackHandler(isProfileModalOpen, () => setIsProfileModalOpen(false), "seller-edit-profile-modal");

  const fetchSellerData = async () => {
    setIsLoading(true);
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      // Fetch Seller Profile
      const sellerRes = await fetch("/api/estate/sellers", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const sellerData = await sellerRes.json();

      if (sellerData.success && sellerData.seller) {
        setSellerProfile(sellerData.seller);
      } else {
        setSellerProfile({
          uid: user?.uid || "seller-id",
          displayName: userName,
          agencyName: "Independent Agent",
          phone: String(userData?.phoneNumber || ""),
          email: String(userData?.email || user?.email || ""),
          address: "",
          isVerified: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Fetch Seller Properties
      const propRes = await fetch(`/api/estate/properties?sellerId=${user?.uid || ""}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const propData = await propRes.json();

      if (propData.success && Array.isArray(propData.properties)) {
        setProperties(propData.properties);
      }
    } catch (err) {
      console.warn("Failed to load seller dashboard:", err);
      toast.error("Unable to load seller properties.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchSellerData();
    }
  }, [user]);

  const handleSaveSellerProfile = async (updated: { agencyName: string; phone: string; address: string }) => {
    setIsSavingSeller(true);
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/estate/sellers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          displayName: userName,
          agencyName: updated.agencyName,
          phone: updated.phone,
          email: userData?.email || user?.email || "",
          address: updated.address,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSellerProfile(data.seller);
        toast.success("Seller profile saved successfully!");
        setIsProfileModalOpen(false);
      } else {
        toast.error(data.error || "Failed to save profile.");
      }
    } catch {
      toast.error("Network error saving seller profile.");
    } finally {
      setIsSavingSeller(false);
    }
  };

  const handleCreateProperty = async (payload: Partial<EstateProperty>) => {
    setIsSubmittingProperty(true);
    try {
      let idToken = "";
      if (user && typeof user.getIdToken === "function") {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/estate/properties", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Property submitted successfully!");
        setIsAddModalOpen(false);
        fetchSellerData();
      } else {
        toast.error(data.error || "Failed to submit property.");
      }
    } catch {
      toast.error("Network error creating property listing.");
    } finally {
      setIsSubmittingProperty(false);
    }
  };

  const filteredProperties = properties.filter((p) => {
    if (activeTab === "ALL") return true;
    return p.status === activeTab;
  });

  return (
    <RouteGuard>
      <div id="estate-page-root" className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-7xl mx-auto pt-3 px-4 md:px-8 flex-grow pb-28 text-black space-y-6">
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-white border border-gray-150 shadow-2xs">
            <div className="flex items-center gap-3">
              <Link
                href="/estate"
                className="w-10 h-10 rounded-2xl border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-700 hover:text-black active:scale-95 transition-all cursor-pointer shadow-none"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
              </Link>
              <div>
                <h1 className="font-bodoni text-xl md:text-2xl font-bold tracking-tight text-black">
                  Seller Agent Console
                </h1>
                <p className="font-hanken text-xs text-gray-500 font-medium">
                  Manage Estate Listings, Seller Profile & Inquiries
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsProfileModalOpen(true)}
                className="px-3.5 py-2.5 rounded-2xl bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">account_circle</span>
                <span>Agent Profile</span>
              </button>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="px-4 py-2.5 rounded-2xl bg-[#FC7A00] hover:bg-[#e06600] text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0 shadow-xs flex items-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[18px]">add</span>
                <span>Add Property</span>
              </button>
            </div>
          </div>

          {/* Seller / Agent Profile Header Banner */}
          <div
            onClick={() => setIsProfileModalOpen(true)}
            className="p-4 md:p-5 bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] rounded-3xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:border-[#FC7A00] transition-all shadow-2xs"
          >
            <div className="flex items-center gap-4">
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border-2 border-[#FC7A00] shadow-xs flex-shrink-0 bg-white">
                <img src={currentPhoto} alt={userName} className="w-full h-full object-cover" />
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full" />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-sm md:text-base text-black">{userName}</h3>
                  {sellerProfile?.isVerified ? (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                      Verified Agent
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                      Pending Verification
                    </span>
                  )}
                </div>
                <p className="text-xs font-bold text-[#FC7A00] uppercase mt-0.5">
                  {sellerProfile?.agencyName || "Independent Real Estate Agent"}
                </p>
                <p className="text-[11px] text-gray-500 font-medium mt-0.5">
                  {sellerProfile?.address || "Click to update office address & contact phone"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <span className="text-xs font-extrabold text-[#FC7A00] uppercase tracking-wider">
                Edit Agent Profile
              </span>
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">chevron_right</span>
            </div>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 select-none">
            {[
              { id: "ALL" as const, label: `All Properties (${properties.length})` },
              { id: "PUBLISHED" as const, label: "Published" },
              { id: "PENDING_REVIEW" as const, label: "Pending Review" },
              { id: "DRAFT" as const, label: "Drafts" },
              { id: "REJECTED" as const, label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap border-0 cursor-pointer transition-all ${
                  activeTab === tab.id
                    ? "bg-[#FC7A00] text-white shadow-2xs"
                    : "bg-white text-gray-700 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* My Properties Directory Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 bg-white rounded-2xl border border-gray-150 p-3 animate-pulse space-y-3">
                  <div className="w-full h-36 bg-gray-100 rounded-xl" />
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center space-y-3 border border-gray-150 shadow-xs">
              <span className="material-symbols-outlined text-[56px] text-gray-300">
                home_work
              </span>
              <h3 className="font-bold text-sm text-gray-500 uppercase">
                No listings under {activeTab}
              </h3>
              <p className="text-xs text-gray-400">
                Submit new property listings to showcase them to buyers across the marketplace.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProperties.map((prop) => (
                <PropertyCard
                  key={prop.id}
                  property={prop}
                  onOpenDetails={(p) => setSelectedProperty(p)}
                />
              ))}
            </div>
          )}
        </main>

        {/* Add Property Sheet Modal */}
        <AddPropertyModal
          isOpen={isAddModalOpen}
          onClose={() => setIsAddModalOpen(false)}
          onSubmitProperty={handleCreateProperty}
          isSubmitting={isSubmittingProperty}
        />

        {/* Editable Seller Profile Modal */}
        <SellerProfileModal
          isOpen={isProfileModalOpen}
          seller={sellerProfile}
          currentPhoto={currentPhoto}
          isEditable={true}
          onClose={() => setIsProfileModalOpen(false)}
          onSaveProfile={handleSaveSellerProfile}
          isSaving={isSavingSeller}
        />

        {/* Property Detail View */}
        <PropertyDetailModal
          isOpen={Boolean(selectedProperty)}
          property={selectedProperty}
          onClose={() => setSelectedProperty(null)}
          onSubmitInquiry={() => {}}
          onReportProperty={() => {}}
        />

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
