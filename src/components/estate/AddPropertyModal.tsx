"use client";

import React, { useState, useRef } from "react";
import { PropertyPurpose, PropertyType, EstateProperty } from "@/estate/types";
import { uploadImageSecurely } from "@/lib/image-upload";
import { toast } from "sonner";

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

  // Media
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [coverIndex, setCoverIndex] = useState(0);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [youtubeVideoUrl, setYoutubeVideoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  if (!isOpen) return null;

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingImage(true);
    try {
      const uploadPromises = Array.from(files).map((file) => uploadImageSecurely(file, "estate_listing"));
      const results = await Promise.all(uploadPromises);

      const successfulUrls = results.filter((r) => r.success && r.url).map((r) => r.url as string);

      if (successfulUrls.length > 0) {
        setUploadedImages((prev) => [...prev, ...successfulUrls]);
        toast.success(`Uploaded ${successfulUrls.length} image(s) successfully.`);
      } else {
        toast.error("Failed to upload image(s). Please try again.");
      }
    } catch {
      toast.error("Network error during image upload.");
    } finally {
      setIsUploadingImage(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setUploadedImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (coverIndex === indexToRemove) {
      setCoverIndex(0);
    } else if (coverIndex > indexToRemove) {
      setCoverIndex(coverIndex - 1);
    }
  };

  const handleSubmit = (targetStatus: "DRAFT" | "PENDING_REVIEW") => {
    const amenities = amenitiesText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    // Arrange images so cover image is at index 0
    let finalImages = [...uploadedImages];
    if (finalImages.length > 0 && coverIndex < finalImages.length) {
      const coverUrl = finalImages[coverIndex];
      finalImages = [coverUrl, ...finalImages.filter((_, idx) => idx !== coverIndex)];
    }

    const videos = youtubeVideoUrl.trim() ? [youtubeVideoUrl.trim()] : [];

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
      images: finalImages,
      videos,
      status: targetStatus,
    });
  };

  return (
    <div className="fixed inset-0 w-full h-full bg-white z-[100005+] flex flex-col justify-between overflow-y-auto no-scrollbar text-black animate-in fade-in duration-200">
      {/* Full Screen Top Header & Body Container */}
      <div className="w-full max-w-2xl mx-auto flex-1 flex flex-col justify-between p-4 sm:p-6 space-y-6 pb-28">
        <div>
          {/* Top Header */}
          <div className="flex items-center justify-between pb-3 pt-1 border-b border-gray-100">
            <div className="flex items-center gap-2.5">
              <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">
                add_home_work
              </span>
              <div>
                <h3 className="font-bodoni text-base sm:text-lg font-bold text-black leading-tight">
                  Add Property Listing
                </h3>
                <p className="text-[11px] text-gray-500 font-medium">
                  Create new listing for rent, sale, or short-let
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

          {/* Form Content */}
          <div className="mt-5 space-y-4 text-xs font-semibold">
            {/* Title */}
            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                Property Title *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Modern 3-Bedroom Duplex with Swimming Pool"
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20 transition-all shadow-2xs"
              />
            </div>

            {/* Purpose & Type */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Purpose *
                </label>
                <select
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value as PropertyPurpose)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
                >
                  <option value="Rent">For Rent</option>
                  <option value="Sale">For Sale</option>
                  <option value="Short-let">Short-let</option>
                </select>
              </div>

              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Property Type *
                </label>
                <select
                  value={propertyType}
                  onChange={(e) => setPropertyType(e.target.value as PropertyType)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
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

            {/* Price & Period */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Price (NGN) *
                </label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="e.g. 2500000"
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20 transition-all shadow-2xs"
                />
              </div>

              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  Price Period
                </label>
                <select
                  value={pricePeriod}
                  onChange={(e) => setPricePeriod(e.target.value as any)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
                >
                  <option value="year">Per Year</option>
                  <option value="month">Per Month</option>
                  <option value="night">Per Night</option>
                  <option value="total">Total Outright</option>
                </select>
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                Address *
              </label>
              <input
                type="text"
                required
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="e.g. 12 Admiralty Way, Lekki Phase 1"
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20 transition-all shadow-2xs"
              />
            </div>

            {/* City & State */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  City
                </label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                  State
                </label>
                <input
                  type="text"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Bedrooms, Bathrooms, Toilets */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider text-center">
                  Bedrooms
                </label>
                <input
                  type="number"
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs text-center outline-none focus:border-[#FC7A00] shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider text-center">
                  Bathrooms
                </label>
                <input
                  type="number"
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs text-center outline-none focus:border-[#FC7A00] shadow-2xs"
                />
              </div>
              <div>
                <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider text-center">
                  Toilets
                </label>
                <input
                  type="number"
                  value={toilets}
                  onChange={(e) => setToilets(e.target.value)}
                  className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs text-center outline-none focus:border-[#FC7A00] shadow-2xs"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                Description *
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe the property, features, neighborhood..."
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-semibold text-black text-xs outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20 transition-all resize-none shadow-2xs"
              />
            </div>

            {/* Image Upload & Cover Selection */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-[10.5px] font-black uppercase text-gray-500 block tracking-wider">
                  Property Images (Upload & Set Cover)
                </label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingImage}
                  className="px-3 py-1.5 rounded-xl bg-[#FC7A00] hover:bg-[#e06600] text-white text-[10.5px] font-black uppercase tracking-wider border-0 cursor-pointer flex items-center gap-1 shadow-2xs disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[16px]">upload_file</span>
                  <span>{isUploadingImage ? "Uploading..." : "Upload Photos"}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {/* Uploaded Gallery Preview */}
              {uploadedImages.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5 p-3 bg-gray-50 rounded-2xl border border-gray-200">
                  {uploadedImages.map((imgUrl, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-gray-200 bg-white group">
                      <img src={imgUrl} alt={`Uploaded ${idx}`} className="w-full h-full object-cover" />
                      {coverIndex === idx && (
                        <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded-md text-[8px] font-black uppercase bg-[#FC7A00] text-white shadow-2xs">
                          Cover
                        </span>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                        {coverIndex !== idx && (
                          <button
                            type="button"
                            onClick={() => setCoverIndex(idx)}
                            title="Set as Cover"
                            className="p-1 rounded-full bg-white text-black border-0 cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-[14px]">photo_camera</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(idx)}
                          title="Remove Image"
                          className="p-1 rounded-full bg-red-600 text-white border-0 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-6 bg-gray-50 border-2 border-dashed border-gray-300 rounded-2xl text-center space-y-1 cursor-pointer hover:border-[#FC7A00] transition-colors"
                >
                  <span className="material-symbols-outlined text-[36px] text-gray-400">
                    add_a_photo
                  </span>
                  <p className="text-xs font-bold text-gray-600">Tap to upload property photos</p>
                  <p className="text-[10px] text-gray-400">Supports JPG, PNG, WebP up to 10MB</p>
                </div>
              )}
            </div>

            {/* YouTube Video URL / Embed (Optional) */}
            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                YouTube Video Link (Optional Embed URL)
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3.5 top-3.5 text-red-600 text-[20px]">
                  movie
                </span>
                <input
                  type="url"
                  value={youtubeVideoUrl}
                  onChange={(e) => setYoutubeVideoUrl(e.target.value)}
                  placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                  className="w-full p-3.5 pl-11 bg-gray-50 border border-gray-300 rounded-2xl font-medium text-black text-xs outline-none focus:border-[#FC7A00] focus:ring-2 focus:ring-[#FC7A00]/20 transition-all shadow-2xs"
                />
              </div>
            </div>

            {/* Amenities */}
            <div>
              <label className="text-[10.5px] font-black uppercase text-gray-500 block mb-1.5 tracking-wider">
                Amenities (Comma separated)
              </label>
              <input
                type="text"
                value={amenitiesText}
                onChange={(e) => setAmenitiesText(e.target.value)}
                placeholder="24/7 Power, Swimming Pool, Gym, Security"
                className="w-full p-3.5 bg-gray-50 border border-gray-300 rounded-2xl font-bold text-black text-xs outline-none focus:border-[#FC7A00] transition-all shadow-2xs"
              />
            </div>
          </div>
        </div>

        {/* Fixed Mobile Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-[100006] bg-white border-t border-gray-200 p-4 shadow-lg flex justify-center">
          <div className="w-full max-w-2xl flex gap-3">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => handleSubmit("DRAFT")}
              className="w-1/2 py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-800 font-extrabold text-xs uppercase rounded-2xl border-0 cursor-pointer transition-all"
            >
              Save as Draft
            </button>
            <button
              type="button"
              disabled={isSubmitting || !title || !price || !address}
              onClick={() => handleSubmit("PENDING_REVIEW")}
              className="w-1/2 py-3.5 bg-[#FC7A00] hover:bg-[#e06600] text-white font-black text-xs uppercase rounded-2xl border-0 cursor-pointer shadow-md disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">publish</span>
              <span>{isSubmitting ? "Submitting..." : "Submit Listing"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
