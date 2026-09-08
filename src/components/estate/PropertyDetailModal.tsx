"use client";

import React, { useState } from "react";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { EstateProperty } from "@/estate/types";

interface PropertyDetailModalProps {
  isOpen: boolean;
  property: EstateProperty | null;
  onClose: () => void;
  onSubmitInquiry: (message: string) => void;
  onReportProperty: (reason: string, details: string) => void;
}

export const PropertyDetailModal: React.FC<PropertyDetailModalProps> = ({
  isOpen,
  property,
  onClose,
  onSubmitInquiry,
  onReportProperty,
}) => {
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [inquiryMessage, setInquiryMessage] = useState("");
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");

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
        <div className="fixed inset-0 z-[100008] bg-black/60 backdrop-blur-sm flex items-end min-[425px]:items-center justify-center p-0 min-[425px]:p-4 overflow-hidden">
          <motion.div
            initial={{ opacity: 0, y: "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="w-full max-w-md bg-white rounded-t-[32px] min-[425px]:rounded-[32px] max-h-[90dvh] flex flex-col overflow-hidden shadow-2xl text-black"
          >
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0 bg-white/95 backdrop-blur-md">
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors border-0 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[18px]">close</span>
                </button>
                <div className="min-w-0">
                  <h2 className="font-hanken font-bold text-sm text-black truncate uppercase">
                    {property.title}
                  </h2>
                  <p className="font-hanken text-[10px] text-gray-400 font-bold uppercase">
                    For {property.purpose} • {property.propertyType}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleShare}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors border-0 cursor-pointer"
                title="Share Property"
              >
                <span className="material-symbols-outlined text-[18px]">share</span>
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar">
              {/* Image Gallery Viewer */}
              <div className="space-y-2">
                <div className="w-full h-52 min-[375px]:h-60 rounded-2xl bg-gray-100 relative overflow-hidden flex items-center justify-center p-1 border border-gray-200">
                  {images[activeImageIndex] ? (
                    <Image
                      src={images[activeImageIndex]}
                      alt={property.title}
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="material-symbols-outlined text-[48px] text-gray-300">
                      domain
                    </span>
                  )}
                  <span className="absolute bottom-2 right-2 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase bg-black/75 text-white backdrop-blur-xs">
                    {activeImageIndex + 1} / {images.length || 1}
                  </span>
                </div>

                {/* Thumbnails row */}
                {images.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-1">
                    {images.map((img, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setActiveImageIndex(idx)}
                        className={`w-14 h-14 rounded-xl border-2 overflow-hidden flex-shrink-0 relative cursor-pointer ${
                          activeImageIndex === idx ? "border-[#FC7A00]" : "border-transparent opacity-60"
                        }`}
                      >
                        <Image src={img} alt="Thumbnail" fill className="object-cover" unoptimized />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Price & Location Box */}
              <div className="p-4 rounded-2xl bg-orange-50/60 border border-[#FC7A00]/20 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase text-gray-400 block">Listing Price</span>
                  <span className="font-mono text-xl font-black text-[#FC7A00]">
                    ₦{property.price.toLocaleString()}
                  </span>
                  {property.purpose !== "Sale" && property.pricePeriod && (
                    <span className="text-xs text-gray-500 font-bold"> /{property.pricePeriod}</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-[10px] font-black uppercase text-gray-400 block">Location</span>
                  <span className="font-bold text-xs text-gray-900 block truncate max-w-[140px]">
                    {property.location?.city}, {property.location?.state}
                  </span>
                </div>
              </div>

              {/* Property Features */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">bed</span>
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Bedrooms</span>
                  <span className="font-mono font-black text-xs text-black block">{property.bedrooms || "-"}</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">bathtub</span>
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Bathrooms</span>
                  <span className="font-mono font-black text-xs text-black block">{property.bathrooms || "-"}</span>
                </div>
                <div className="p-3 bg-gray-50 border border-gray-150 rounded-xl space-y-1">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">square_foot</span>
                  <span className="text-[10px] font-extrabold uppercase text-gray-400 block">Size</span>
                  <span className="font-mono font-black text-xs text-black block truncate">{property.propertySize || "N/A"}</span>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h4 className="font-hanken font-extrabold text-xs text-black uppercase tracking-wider">
                  Description
                </h4>
                <p className="font-hanken text-xs text-gray-600 leading-relaxed font-medium">
                  {property.description}
                </p>
              </div>

              {/* Amenities */}
              {property.amenities && property.amenities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-hanken font-extrabold text-xs text-black uppercase tracking-wider">
                    Amenities & Facilities
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {property.amenities.map((am, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 rounded-xl bg-gray-100 border border-gray-200 text-[10.5px] font-bold text-gray-700"
                      >
                        ✓ {am}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact Seller Inquiry Form */}
              <div className="p-4 rounded-2xl bg-gray-50 border border-gray-200 space-y-3">
                <h4 className="font-hanken font-extrabold text-xs text-black uppercase tracking-wider flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[18px]">contact_support</span>
                  <span>Contact Agent / Seller</span>
                </h4>
                <p className="font-hanken text-[11px] text-gray-500 font-semibold">
                  Agent: <strong className="text-black">{property.sellerName || "Verified Partner"}</strong>
                </p>

                <textarea
                  rows={3}
                  value={inquiryMessage}
                  onChange={(e) => setInquiryMessage(e.target.value)}
                  placeholder="Ask about inspection, availability, or pricing terms..."
                  className="w-full p-3 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-[#FC7A00] resize-none"
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
                  className="w-full py-3 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0"
                >
                  Send Inquiry Message
                </button>
              </div>

              {/* Report Property Trigger */}
              <div className="pt-2 text-center">
                {!isReporting ? (
                  <button
                    type="button"
                    onClick={() => setIsReporting(true)}
                    className="text-[10px] font-bold text-gray-400 hover:text-red-500 uppercase tracking-wider cursor-pointer border-0"
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
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
