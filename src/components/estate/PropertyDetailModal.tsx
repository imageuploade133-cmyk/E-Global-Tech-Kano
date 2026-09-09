"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EstateProperty } from "@/estate/types";
import { useModalBackHandler } from "@/lib/useModalBackHandler";

interface PropertyDetailModalProps {
  isOpen: boolean;
  property: EstateProperty | null;
  onClose: () => void;
  onSubmitInquiry: (message: string) => void;
  onReportProperty: (reason: string, details: string) => void;
  onInspectAgent?: () => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  isOpen,
  property,
  onClose,
  onSubmitInquiry,
  onReportProperty,
  onInspectAgent,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [fullscreenImageIndex, setFullscreenImageIndex] = useState<number | null>(null);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

  useModalBackHandler(isOpen, onClose, property ? `property-detail-${property.id}` : "property-detail");

  if (!isOpen || !property) return null;

  const images = property.images && property.images.length > 0 ? property.images : [];

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: property.title,
        text: `Check out ${property.title} for ${property.purpose} on E-Global Estate!`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Property link copied to clipboard!");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100008] bg-white w-full h-full flex flex-col justify-between overflow-hidden text-black">
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-gray-150 flex items-center justify-between flex-shrink-0 bg-white z-20 shadow-xs">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-all cursor-pointer border-0 active:scale-90"
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </button>
              <div className="min-w-0">
                <h2 className="font-hanken font-extrabold text-sm text-black truncate uppercase tracking-tight">
                  {property.title}
                </h2>
                <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase">
                  For {property.purpose} • {property.propertyType}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShare}
                className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-all cursor-pointer border-0 active:scale-90"
                title="Share Property"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
            </div>
          </div>

          {/* Main Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 min-[425px]:p-6 space-y-6 custom-scrollbar pb-12">
            {/* Main Featured Image Gallery Viewer */}
            <div className="space-y-2">
              <div
                onClick={() => setFullscreenImageIndex(activeImageIndex)}
                className="w-full h-64 min-[425px]:h-80 rounded-2xl bg-gray-100 relative overflow-hidden flex items-center justify-center p-1 border border-gray-200 cursor-pointer group shadow-sm"
              >
                {images[activeImageIndex] ? (
                  <Image
                    src={images[activeImageIndex]}
                    alt={property.title}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                    unoptimized
                  />
                ) : (
                  <span className="material-symbols-outlined text-[56px] text-gray-300">
                    domain
                  </span>
                )}

                <span className="absolute bottom-3 right-3 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-black/75 text-white backdrop-blur-xs flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[12px]">zoom_in</span>
                  <span>{activeImageIndex + 1} / {images.length || 1}</span>
                </span>

                <span
                  className={`absolute top-3 right-3 px-3 py-1 rounded-md text-[9.5px] font-black uppercase tracking-wider text-white shadow-sm ${
                    property.purpose === "Sale"
                      ? "bg-emerald-600"
                      : property.purpose === "Short-let"
                      ? "bg-purple-600"
                      : "bg-[#FC7A00]"
                  }`}
                >
                  For {property.purpose}
                </span>
              </div>

              {/* Thumbnails list */}
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                  {images.map((img, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setActiveImageIndex(idx)}
                      className={`w-16 h-16 rounded-xl border-2 overflow-hidden flex-shrink-0 relative cursor-pointer transition-all ${
                        activeImageIndex === idx
                          ? "border-[#FC7A00] scale-105 shadow-sm"
                          : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <Image src={img} alt="Thumbnail" fill className="object-cover" unoptimized />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Price & Location Card Container */}
            <div className="bg-gradient-to-r from-[#FC7A00]/10 via-amber-50 to-[#E06600]/10 p-4 rounded-2xl border border-[#FC7A00]/25 flex items-center justify-between shadow-xs">
              <div>
                <span className="text-[10px] font-black uppercase text-gray-500 block">Listing Price</span>
                <span className="font-mono text-2xl font-black text-[#FC7A00]">
                  ₦{property.price.toLocaleString()}
                </span>
                {property.purpose !== "Sale" && property.pricePeriod && (
                  <span className="text-xs text-gray-600 font-extrabold"> /{property.pricePeriod}</span>
                )}
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black uppercase text-gray-500 block">Location</span>
                <span className="font-extrabold text-xs text-gray-900 block truncate max-w-[160px]">
                  {property.location?.city || "City"}, {property.location?.state || "State"}
                </span>
                {property.location?.address && (
                  <span className="text-[10px] font-semibold text-gray-500 block truncate max-w-[160px]">
                    {property.location.address}
                  </span>
                )}
              </div>
            </div>

            {/* Property Key Metrics Grid */}
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1 shadow-2xs">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">bed</span>
                <span className="text-[10px] font-black uppercase text-gray-400 block">Bedrooms</span>
                <span className="font-mono font-black text-sm text-black block">{property.bedrooms || "-"}</span>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1 shadow-2xs">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">bathtub</span>
                <span className="text-[10px] font-black uppercase text-gray-400 block">Bathrooms</span>
                <span className="font-mono font-black text-sm text-black block">{property.bathrooms || "-"}</span>
              </div>
              <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-2xl space-y-1 shadow-2xs">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">square_foot</span>
                <span className="text-[10px] font-black uppercase text-gray-400 block">Size</span>
                <span className="font-mono font-black text-xs text-black block truncate">{property.propertySize || "N/A"}</span>
              </div>
            </div>

            {/* Property Overview & Description */}
            <div className="space-y-2 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
              <h4 className="font-hanken font-black text-xs text-black uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[18px]">description</span>
                <span>Property Overview</span>
              </h4>
              <p className="font-hanken text-xs text-gray-700 leading-relaxed font-medium whitespace-pre-line">
                {property.description}
              </p>
            </div>

            {/* Amenities & Facilities */}
            {property.amenities && property.amenities.length > 0 && (
              <div className="space-y-2.5 bg-white p-4 rounded-2xl border border-gray-200 shadow-2xs">
                <h4 className="font-hanken font-black text-xs text-black uppercase tracking-wider flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[18px]">verified</span>
                  <span>Amenities & Facilities</span>
                </h4>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((am, i) => (
                    <span
                      key={i}
                      className="px-3.5 py-1.5 rounded-xl bg-orange-50/80 border border-[#FC7A00]/20 text-[11px] font-extrabold text-[#FC7A00]"
                    >
                      ✓ {am}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Contact Seller Inquiry Form */}
            <div className="p-5 rounded-2xl bg-gray-50 border border-gray-200 space-y-4 shadow-2xs">
              <h4 className="font-hanken font-black text-xs text-black uppercase tracking-wider flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">support_agent</span>
                <span>Agent & Seller Inquiry</span>
              </h4>

              <div className="flex items-center justify-between p-3 bg-white rounded-xl border border-gray-200">
                <div className="min-w-0 pr-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase block">Verified Agent</span>
                  <p className="font-hanken text-xs font-black text-black truncate">
                    {property.sellerName || "E-Global Estate Partner"}
                  </p>
                </div>
                {onInspectAgent && (
                  <button
                    type="button"
                    onClick={onInspectAgent}
                    className="px-3 py-1.5 bg-[#FC7A00]/10 hover:bg-[#FC7A00]/20 text-[#FC7A00] font-black text-[10.5px] uppercase rounded-xl cursor-pointer border-0 flex items-center gap-1 flex-shrink-0 transition-all"
                  >
                    <span className="material-symbols-outlined text-[15px]">account_circle</span>
                    <span>View Profile</span>
                  </button>
                )}
              </div>

              <textarea
                rows={3}
                value={inquiryMessage}
                onChange={(e) => setInquiryMessage(e.target.value)}
                placeholder="Ask about inspection dates, availability, or payment terms..."
                className="w-full p-3.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00] resize-none"
              />

              <button
                type="button"
                onClick={() => {
                  if (!inquiryMessage.trim()) {
                    toast.error("Please type your inquiry message first.");
                    return;
                  }
                  onSubmitInquiry(inquiryMessage);
                  setInquiryMessage("");
                }}
                className="w-full py-3.5 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:brightness-105 active:scale-95 transition-all cursor-pointer border-0 shadow-sm"
              >
                Send Direct Message
              </button>
            </div>

            {/* Report Property Trigger */}
            <div className="pt-2 text-center">
              {!isReporting ? (
                <button
                  type="button"
                  onClick={() => setIsReporting(true)}
                  className="text-[10.5px] font-black text-gray-400 hover:text-red-500 uppercase tracking-wider cursor-pointer border-0 transition-colors"
                >
                  🚩 Report inaccurate or suspicious listing
                </button>
              ) : (
                <div className="p-4 bg-red-50/80 border border-red-200 rounded-2xl space-y-3 text-left">
                  <h5 className="font-black text-xs text-red-600 uppercase">Report Listing</h5>
                  <input
                    type="text"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="Reason (e.g. Fraud, Wrong Price)"
                    className="w-full p-2.5 bg-white border border-red-200 rounded-xl text-xs font-bold"
                  />
                  <textarea
                    rows={2}
                    value={reportDetails}
                    onChange={(e) => setReportDetails(e.target.value)}
                    placeholder="Additional details..."
                    className="w-full p-2.5 bg-white border border-red-200 rounded-xl text-xs font-medium resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setIsReporting(false)}
                      className="w-1/3 py-2 bg-gray-200 text-gray-700 text-[10px] font-bold uppercase rounded-lg cursor-pointer border-0"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!reportReason.trim()) {
                          toast.error("Please enter a report reason.");
                          return;
                        }
                        onReportProperty(reportReason, reportDetails);
                        setIsReporting(false);
                        setReportReason("");
                        setReportDetails("");
                      }}
                      className="w-2/3 py-2 bg-red-600 text-white text-[10px] font-black uppercase rounded-lg cursor-pointer border-0"
                    >
                      Submit Report
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fullscreen Image Zoom Overlay */}
          {fullscreenImageIndex !== null && images[fullscreenImageIndex] && (
            <div
              className="fixed inset-0 z-[100010] bg-black/95 flex flex-col justify-between p-4"
              onClick={() => setFullscreenImageIndex(null)}
            >
              <div className="flex items-center justify-between text-white pt-2 px-2">
                <span className="text-xs font-black uppercase">
                  Image {fullscreenImageIndex + 1} of {images.length}
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenImageIndex(null)}
                  className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white border-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[22px]">close</span>
                </button>
              </div>

              <div className="relative w-full h-[75vh] flex items-center justify-center">
                <Image
                  src={images[fullscreenImageIndex]}
                  alt="Zoomed View"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>

              <div className="flex justify-center gap-4 pb-4">
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenImageIndex(idx);
                        }}
                        className={`w-12 h-12 rounded-lg border-2 overflow-hidden flex-shrink-0 relative cursor-pointer ${
                          fullscreenImageIndex === idx ? "border-[#FC7A00]" : "border-transparent opacity-50"
                        }`}
                      >
                        <Image src={img} alt="Thumb" fill className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </AnimatePresence>
  );
};
