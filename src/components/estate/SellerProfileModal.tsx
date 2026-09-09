"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { EstateSeller } from "@/estate/types";

interface SellerProfileModalProps {
  isOpen: boolean;
  seller: EstateSeller | null;
  currentPhoto?: string;
  isEditable?: boolean;
  onClose: () => void;
  onSaveProfile?: (updated: { agencyName: string; phone: string; address: string }) => Promise<void>;
  isSaving?: boolean;
}

export function SellerProfileModal({
  isOpen,
  seller,
  currentPhoto,
  isEditable = false,
  onClose,
  onSaveProfile,
  isSaving = false,
}: SellerProfileModalProps) {
  const [agencyName, setAgencyName] = useState(seller?.agencyName || "");
  const [phone, setPhone] = useState(seller?.phone || "");
  const [address, setAddress] = useState(seller?.address || "");

  React.useEffect(() => {
    if (seller) {
      setAgencyName(seller.agencyName || "");
      setPhone(seller.phone || "");
      setAddress(seller.address || "");
    }
  }, [seller]);

  if (!isOpen || !seller) return null;

  const avatarUrl =
    seller.avatarUrl ||
    currentPhoto ||
    "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M";

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (onSaveProfile) {
      await onSaveProfile({ agencyName, phone, address });
    }
  };

  return (
    <div className="fixed inset-0 z-[100000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-gray-150 space-y-5 text-black my-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">account_circle</span>
            <h3 className="font-extrabold text-sm uppercase tracking-wider text-black">
              Seller & Agent Profile
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full border border-gray-200 flex items-center justify-center text-gray-400 hover:text-black cursor-pointer border-0"
          >
            ✕
          </button>
        </div>

        {/* Profile Header Badge Section */}
        <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1]">
          <div className="relative w-16 h-16 rounded-2xl overflow-hidden border-2 border-[#FC7A00] shadow-sm flex-shrink-0 bg-white">
            <img src={avatarUrl} alt={seller.displayName} className="w-full h-full object-cover" />
            <span className="absolute bottom-0 right-0 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h4 className="font-extrabold text-sm text-black truncate">{seller.displayName}</h4>
              {seller.isVerified ? (
                <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Verified Agent
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                  Pending Verification
                </span>
              )}
            </div>
            <p className="text-xs font-bold text-[#FC7A00] uppercase truncate">
              {seller.agencyName || "Independent Property Agent"}
            </p>
            <p className="text-[10.5px] text-gray-500 font-mono truncate">{seller.email}</p>
          </div>
        </div>

        {/* Details Grid or Editable Form */}
        {isEditable ? (
          <form onSubmit={handleFormSubmit} className="space-y-3.5 text-xs">
            <div>
              <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                Agency / Business Name
              </label>
              <input
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                placeholder="e.g. Apex Real Estate"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black outline-none focus:border-[#FC7A00]"
              />
            </div>

            <div>
              <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                Contact Phone Number *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="e.g. 08012345678"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black outline-none focus:border-[#FC7A00]"
              />
            </div>

            <div>
              <label className="text-[9.5px] font-black uppercase text-gray-400 block mb-1">
                Office / Business Address
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. Suite 12, Victoria Island Plaza, Lagos"
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl font-bold text-black outline-none focus:border-[#FC7A00]"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-1/2 py-3 bg-gray-100 text-gray-700 font-extrabold text-xs uppercase rounded-xl border-0 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="w-1/2 py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white font-black text-xs uppercase rounded-xl border-0 cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isSaving ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="p-3.5 bg-gray-50 rounded-2xl border border-gray-150 space-y-2">
              <div>
                <span className="text-[9px] font-black uppercase text-gray-400 block">Phone Number</span>
                <span className="font-mono font-extrabold text-black text-xs">{seller.phone || "Not specified"}</span>
              </div>
              <div>
                <span className="text-[9px] font-black uppercase text-gray-400 block">Office Address</span>
                <span className="font-medium text-gray-700">{seller.address || "Location not provided"}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={`tel:${seller.phone}`}
                className="w-1/2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-xl text-center cursor-pointer border-0 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">call</span>
                <span>Call Agent</span>
              </a>
              <a
                href={`https://wa.me/${(seller.phone || "").replace(/[^0-9]/g, "")}`}
                target="_blank"
                rel="noreferrer"
                className="w-1/2 py-3 bg-black hover:bg-gray-900 text-white font-black text-xs uppercase rounded-xl text-center cursor-pointer border-0 flex items-center justify-center gap-1.5"
              >
                <span className="material-symbols-outlined text-[16px]">chat</span>
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
