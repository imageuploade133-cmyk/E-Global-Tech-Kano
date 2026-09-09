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

  // Profile Form States
  const [agencyName, setAgencyName] = useState("");
  const [sellerPhone, setSellerPhone] = useState("");
  const [sellerAddress, setSellerAddress] = useState("");
  const [isSavingSeller, setIsSavingSeller] = useState(false);
  const [isSubmittingProperty, setIsSubmittingProperty] = useState(false);

  useModalBackHandler(isAddModalOpen, () => setIsAddModalOpen(false), "seller-add-modal");
  useModalBackHandler(Boolean(selectedProperty), () => setSelectedProperty(null), "seller-detail-modal");

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
        setAgencyName(sellerData.seller.agencyName || "");
        setSellerPhone(sellerData.seller.phone || userData?.phoneNumber || "");
        setSellerAddress(sellerData.seller.address || "");
      } else {
        setSellerPhone(String(userData?.phoneNumber || ""));
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

  const handleSaveSellerProfile = async (e: React.FormEvent) => {
    e.preventDefault();
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
          agencyName,
          phone: sellerPhone,
          email: userData?.email || user?.email || "",
          address: sellerAddress,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSellerProfile(data.seller);
        toast.success("Seller profile saved successfully!");
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
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-28 text-black space-y-5">
          {/* Header Row */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href="/estate"
                className="w-10 h-10 rounded-full border border-gray-150 bg-white flex items-center justify-center text-gray-700 hover:text-black active:scale-95 transition-all cursor-pointer shadow-none"
              >
                <span className="material-symbols-outlined text-[20px] font-bold">arrow_back</span>
              </Link>
              <div>
                <h1 className="font-bodoni text-lg min-[375px]:text-xl font-bold tracking-tight text-black">
                  Seller Dashboard
                </h1>
                <p className="font-hanken text-[10.5px] text-gray-500 font-medium">
                  Manage Property Listings & Inquiries
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-[#FC7A00] text-white text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 shadow-xs flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              <span>Add Property</span>
            </button>
          </div>

          {/* Seller Agent Profile Setup Form */}
          <div className="p-4 bg-white border border-gray-150 rounded-2xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">badge</span>
                <h3 className="font-hanken font-extrabold text-xs text-black uppercase tracking-wider">
                  Seller / Agent Profile
                </h3>
              </div>

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

            <form onSubmit={handleSaveSellerProfile} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                    Agency / Business Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Apex Real Estate"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black"
                  />
                </div>
                <div>
                  <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                    Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={sellerPhone}
                    onChange={(e) => setSellerPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                  Office / Business Address
                </label>
                <input
                  type="text"
                  value={sellerAddress}
                  onChange={(e) => setSellerAddress(e.target.value)}
                  placeholder="e.g. Suite 12, Victoria Island Plaza, Lagos"
                  className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black"
                />
              </div>

              <button
                type="submit"
                disabled={isSavingSeller}
                className="w-full py-2.5 bg-black hover:bg-gray-900 text-white font-black text-[10px] uppercase tracking-wider rounded-xl cursor-pointer border-0 shadow-xs"
              >
                {isSavingSeller ? "Saving Profile..." : "Update Agent Profile"}
              </button>
            </form>
          </div>

          {/* Status Tabs */}
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 select-none">
            {[
              { id: "ALL" as const, label: "All Properties" },
              { id: "PUBLISHED" as const, label: "Published" },
              { id: "PENDING_REVIEW" as const, label: "Pending Review" },
              { id: "DRAFT" as const, label: "Drafts" },
              { id: "REJECTED" as const, label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3.5 py-2 rounded-xl text-[10.5px] font-black uppercase tracking-wider whitespace-nowrap border-0 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-[#FC7A00] text-white shadow-xs"
                    : "bg-white text-gray-700 hover:bg-gray-100"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* My Properties List */}
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-32 bg-white rounded-2xl border border-gray-150 p-3 animate-pulse" />
              ))}
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className="bg-white rounded-2xl p-8 text-center space-y-2 border border-gray-150">
              <span className="material-symbols-outlined text-[40px] text-gray-300">
                home_work
              </span>
              <h3 className="font-bold text-xs text-gray-500 uppercase">
                No listings under {activeTab}
              </h3>
            </div>
          ) : (
            <div className="grid grid-cols-1 min-[375px]:grid-cols-2 gap-3.5">
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
