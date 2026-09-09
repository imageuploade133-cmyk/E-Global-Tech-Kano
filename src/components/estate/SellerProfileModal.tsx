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
    <div className="fixed inset-0 w-full h-full bg-white z-[100000+] flex flex-col justify-between overflow-y-auto no-scrollbar p-4 sm:p-6 text-black animate-in fade-in duration-200">
      {/* Full Screen App Drawer Header */}
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-between space-y-6">
        <div>
          <div className="flex items-center justify-between border-b border-gray-150 pb-4 pt-2">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">
                account_circle
              </span>
              <div>
                <h3 className="font-bodoni text-base sm:text-lg font-bold text-black leading-tight">
                  {isEditable ? "Edit Agent Profile" : "Seller & Agent Profile"}
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  {isEditable ? "Update business & phone details" : "Agent contact & verification status"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 border-0 flex items-center justify-center text-gray-600 hover:text-black cursor-pointer transition-all"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Banner Card */}
          <div className="mt-5 p-4 sm:p-5 rounded-3xl bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left shadow-2xs">
            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-2xl overflow-hidden border-2 border-[#FC7A00] shadow-sm flex-shrink-0 bg-white">
              <img src={avatarUrl} alt={seller.displayName} className="w-full h-full object-cover" />
              <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-white rounded-full" />
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center justify-center sm:justify-start gap-2 flex-wrap">
                <h4 className="font-extrabold text-base text-black">{seller.displayName}</h4>
                {seller.isVerified ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-200">
                    Verified Agent
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-200">
                    Pending Verification
                  </span>
                )}
              </div>
              <p className="text-xs font-extrabold text-[#FC7A00] uppercase">
                {seller.agencyName || "Independent Property Agent"}
              </p>
              <p className="text-xs text-gray-500 font-mono">{seller.email}</p>
            </div>
          </div>

          {/* Drawer Form Body */}
          <div className="mt-6">
            {isEditable ? (
              <form id="seller-profile-form" onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                    Agency / Business Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Apex Real Estate"
                    className="w-full p-3.5 bg-gray-50 border border-gray-250 rounded-2xl font-semibold text-black text-xs outline-none focus:border-[#FC7A00] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                    Contact Phone Number *
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 08012345678"
                    className="w-full p-3.5 bg-gray-50 border border-gray-250 rounded-2xl font-semibold text-black text-xs outline-none focus:border-[#FC7A00] transition-all"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                    Office / Business Address
                  </label>
                  <textarea
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. Suite 12, Victoria Island Plaza, Lagos"
                    className="w-full p-3.5 bg-gray-50 border border-gray-250 rounded-2xl font-semibold text-black text-xs outline-none focus:border-[#FC7A00] transition-all resize-none"
                  />
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-2xl border border-gray-150 space-y-3 text-xs">
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider mb-0.5">
                      Phone Number
                    </span>
                    <span className="font-mono font-extrabold text-black text-sm">
                      {seller.phone || "Not specified"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-gray-400 block tracking-wider mb-0.5">
                      Office Address
                    </span>
                    <span className="font-medium text-gray-700 leading-relaxed">
                      {seller.address || "Location not provided"}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-2">
                  <a
                    href={`tel:${seller.phone}`}
                    className="py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase rounded-2xl text-center cursor-pointer border-0 flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">call</span>
                    <span>Call Agent</span>
                  </a>
                  <a
                    href={`https://wa.me/${(seller.phone || "").replace(/[^0-9]/g, "")}`}
                    target="_blank"
                    rel="noreferrer"
                    className="py-3.5 bg-black hover:bg-gray-900 text-white font-black text-xs uppercase rounded-2xl text-center cursor-pointer border-0 flex items-center justify-center gap-2 shadow-2xs"
                  >
                    <span className="material-symbols-outlined text-[18px]">chat</span>
                    <span>WhatsApp</span>
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Action Footer for Editable Form */}
        {isEditable && (
          <div className="pt-4 border-t border-gray-150 flex gap-3 pb-4">
            <button
              type="button"
              onClick={onClose}
              className="w-1/2 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs uppercase rounded-2xl border-0 cursor-pointer transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="seller-profile-form"
              disabled={isSaving}
              className="w-1/2 py-3.5 bg-[#FC7A00] hover:bg-[#e06600] text-white font-black text-xs uppercase rounded-2xl border-0 cursor-pointer shadow-xs disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? "Saving..." : "Save Profile"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
