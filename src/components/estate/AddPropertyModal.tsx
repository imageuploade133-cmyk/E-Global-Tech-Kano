"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PropertyPurpose, PropertyType, EstateProperty } from "@/estate/types";

interface AddPropertyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitProperty: (payload: Partial<EstateProperty>) => void;
  isSubmitting: boolean;
}

export const AddPropertyModal: React.FC<AddPropertyModalProps> = ({
  isOpen,
  onClose,
  onSubmitProperty,
  isSubmitting,
}) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [purpose, setPurpose] = useState<PropertyPurpose>("Rent");
  const [propertyType, setPropertyType] = useState<PropertyType>("Apartment");
  const [price, setPrice] = useState("");
  const [pricePeriod, setPricePeriod] = useState<"year" | "month" | "night" | "total">("year");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Lagos");
  const [state, setState] = useState("Lagos");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [toilets, setToilets] = useState("2");
  const [propertySize, setPropertySize] = useState("");
  const [furnished, setFurnished] = useState<"Fully Furnished" | "Semi Furnished" | "Unfurnished">("Unfurnished");
  const [amenitiesText, setAmenitiesText] = useState("24/7 Power, Water Supply, Security");
  const [imagesText, setImagesText] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (targetStatus: "DRAFT" | "PENDING_REVIEW") => {
    const amenities = amenitiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const images = imagesText
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    onSubmitProperty({
      title,
      description,
      purpose,
      propertyType,
      price: Number(price) || 0,
      pricePeriod,
      location: {
        address,
        city,
        state,
      },
      bedrooms: Number(bedrooms) || 0,
      bathrooms: Number(bathrooms) || 0,
      toilets: Number(toilets) || 0,
      propertySize,
      furnished,
      amenities,
      images,
      status: targetStatus,
    });
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
              <h3 className="font-hanken font-extrabold text-sm text-black uppercase tracking-wider">
                Add Property Listing
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-700 transition-colors border-0 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Scrollable Form */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4 custom-scrollbar text-xs font-semibold">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Property Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Modern 3-Bedroom Duplex with Swimming Pool"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Purpose *</label>
                  <select
                    value={purpose}
                    onChange={(e) => setPurpose(e.target.value as PropertyPurpose)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  >
                    <option value="Rent">Rent</option>
                    <option value="Sale">Sale</option>
                    <option value="Short-let">Short-let</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Property Type *</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  >
                    <option value="Apartment">Apartment</option>
                    <option value="House">House</option>
                    <option value="Duplex">Duplex</option>
                    <option value="Villa">Villa</option>
                    <option value="Land">Land</option>
                    <option value="Shop">Shop</option>
                    <option value="Office">Office</option>
                    <option value="Commercial property">Commercial property</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Price (NGN) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="e.g. 2500000"
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Price Period</label>
                  <select
                    value={pricePeriod}
                    onChange={(e) => setPricePeriod(e.target.value as any)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  >
                    <option value="year">Per Year</option>
                    <option value="month">Per Month</option>
                    <option value="night">Per Night</option>
                    <option value="total">Total Outright</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Address *</label>
                <input
                  type="text"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. 12 Admiralty Way, Lekki Phase 1"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">City</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">State</label>
                  <input
                    type="text"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Bedrooms</label>
                  <input
                    type="number"
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Bathrooms</label>
                  <input
                    type="number"
                    value={bathrooms}
                    onChange={(e) => setBathrooms(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase text-gray-400">Toilets</label>
                  <input
                    type="number"
                    value={toilets}
                    onChange={(e) => setToilets(e.target.value)}
                    className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black text-center"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Description *</label>
                <textarea
                  rows={3}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the property, features, neighborhood..."
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-black resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">
                  Image Direct File URLs (One per line)
                </label>
                <textarea
                  rows={3}
                  value={imagesText}
                  onChange={(e) => setImagesText(e.target.value)}
                  placeholder="https://i.ibb.co/property1.jpg&#10;https://i.ibb.co/property2.jpg"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-mono resize-none"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400">Amenities (Comma separated)</label>
                <input
                  type="text"
                  value={amenitiesText}
                  onChange={(e) => setAmenitiesText(e.target.value)}
                  placeholder="24/7 Power, Swimming Pool, Gym, Security"
                  className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-black"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSubmit("DRAFT")}
                  className="w-1/2 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer border-0"
                >
                  Save as Draft
                </button>
                <button
                  type="button"
                  disabled={isSubmitting || !title || !price || !address}
                  onClick={() => handleSubmit("PENDING_REVIEW")}
                  className="w-1/2 py-3.5 bg-[#FC7A00] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 active:scale-95 transition-all cursor-pointer border-0 disabled:opacity-50"
                >
                  {isSubmitting ? "Submitting..." : "Submit Listing"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
