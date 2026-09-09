"use client";

import React from "react";
import Image from "next/image";
import { EstateProperty } from "@/estate/types";

interface PropertyCardProps {
  property: EstateProperty;
  onOpenDetails: (property: EstateProperty) => void;
  onSaveFavorite?: (e: React.MouseEvent, property: EstateProperty) => void;
  isSaved?: boolean;
}

export const PropertyCard: React.FC<PropertyCardProps> = ({
  property,
  onOpenDetails,
  onSaveFavorite,
  isSaved,
}) => {
  const displayImage =
    property.images && property.images.length > 0 ? property.images[0] : "";

  return (
    <div
      onClick={() => onOpenDetails(property)}
      className="bg-white rounded-2xl p-3 shadow-xs hover:shadow-md transition-all cursor-pointer group relative overflow-hidden flex flex-col justify-between h-full"
    >
      <div className="space-y-2.5">
        {/* Property Thumbnail */}
        <div className="w-full h-36 min-[375px]:h-40 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden relative flex items-center justify-center p-1">
          {displayImage ? (
            <Image
              src={displayImage}
              alt={property.title}
              fill
              className="object-cover group-hover:scale-105 transition-transform duration-300"
              unoptimized
            />
          ) : (
            <span className="material-symbols-outlined text-[40px] text-gray-300">
              domain
            </span>
          )}

          {/* Favorite Heart Trigger */}
          {onSaveFavorite && (
            <button
              type="button"
              onClick={(e) => onSaveFavorite(e, property)}
              className="absolute top-2 left-2 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center text-gray-600 hover:text-red-500 shadow-xs z-10 transition-transform active:scale-90 border-0 cursor-pointer"
              title={isSaved ? "Remove Favorite" : "Save Property"}
            >
              <span
                className={`material-symbols-outlined text-[17px] ${
                  isSaved ? "text-red-500" : ""
                }`}
                style={{ fontVariationSettings: isSaved ? '"FILL" 1' : '"FILL" 0' }}
              >
                favorite
              </span>
            </button>
          )}

          {/* Purpose Badge */}
          <span
            className={`absolute top-2 right-2 px-2.5 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider text-white shadow-xs ${
              property.purpose === "Sale"
                ? "bg-emerald-600"
                : property.purpose === "Short-let"
                ? "bg-purple-600"
                : "bg-[#FC7A00]"
            }`}
          >
            For {property.purpose}
          </span>

          {/* Featured Tag */}
          {property.featured && (
            <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[8px] font-black uppercase bg-amber-500 text-black shadow-xs flex items-center gap-1">
              <span className="material-symbols-outlined text-[10px]">star</span>
              <span>Featured</span>
            </span>
          )}
        </div>

        {/* Info Body */}
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-1">
            <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
              {property.propertyType}
            </span>
            <span className="text-[9px] font-extrabold text-gray-600 truncate">
              {property.location?.city || property.location?.state || "Nigeria"}
            </span>
          </div>

          <h3 className="font-hanken font-extrabold text-xs text-black line-clamp-1 group-hover:text-[#FC7A00] transition-colors leading-tight">
            {property.title}
          </h3>

          <p className="font-hanken text-[10px] text-gray-400 line-clamp-1 leading-relaxed">
            {property.location?.address}
          </p>

          {/* Features icons row */}
          <div className="flex items-center gap-3 pt-1 text-[10px] font-bold text-gray-500">
            {typeof property.bedrooms === "number" && property.bedrooms > 0 && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-gray-400">bed</span>
                <span>{property.bedrooms} Bed</span>
              </div>
            )}
            {typeof property.bathrooms === "number" && property.bathrooms > 0 && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-gray-400">bathtub</span>
                <span>{property.bathrooms} Bath</span>
              </div>
            )}
            {property.propertySize && (
              <div className="flex items-center gap-1 truncate">
                <span className="material-symbols-outlined text-[14px] text-gray-400">square_foot</span>
                <span>{property.propertySize}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Price Footer */}
      <div className="pt-2.5 mt-2 border-t border-gray-100 flex items-center justify-between">
        <div>
          <span className="font-mono font-black text-sm text-[#FC7A00]">
            ₦{property.price.toLocaleString()}
          </span>
          {property.purpose !== "Sale" && property.pricePeriod && (
            <span className="text-[9px] text-gray-400 font-bold"> /{property.pricePeriod}</span>
          )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenDetails(property);
          }}
          className="px-2.5 py-1 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-0 shadow-2xs active:scale-95"
        >
          View
        </button>
      </div>
    </div>
  );
};
