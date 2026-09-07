"use client";

import React, { useState, useEffect } from "react";

interface AppLogoProps {
  logoUrl?: string;
  size?: number;
  className?: string;
  alt?: string;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  logoUrl,
  size = 28,
  className = "",
  alt = "E-Tech Logo",
}) => {
  const [imageError, setImageError] = useState(false);

  // Reset image error when logoUrl changes
  useEffect(() => {
    setImageError(false);
  }, [logoUrl]);

  const cleanUrl = logoUrl && !logoUrl.includes("vercel.app/_next/image") ? logoUrl : null;

  if (cleanUrl && !imageError) {
    return (
      <img
        src={cleanUrl}
        alt={alt}
        width={size}
        height={size}
        className={`object-contain ${className}`}
        style={{ width: `${size}px`, height: `${size}px` }}
        onError={() => setImageError(true)}
      />
    );
  }

  // Pure SVG Code Vector Logo - Zero Network Latency, Instant Display & Zero Crashes
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`select-none flex-shrink-0 ${className}`}
      style={{ width: `${size}px`, height: `${size}px` }}
    >
      <rect width="100" height="100" rx="28" fill="#111827" />
      <path
        d="M22 28H78C80.2091 28 82 29.7909 82 32V38C82 40.2091 80.2091 42 78 42H42V48H68C70.2091 48 72 49.7909 72 52V58C72 60.2091 70.2091 62 68 62H42V68H78C80.2091 68 82 69.7909 82 72V78C82 80.2091 80.2091 82 78 82H22C19.7909 82 18 80.2091 18 78V32C18 29.7909 19.7909 28 22 28Z"
        fill="url(#e_tech_gradient)"
      />
      <circle cx="78" cy="22" r="8" fill="#0b513d" />
      <defs>
        <linearGradient id="e_tech_gradient" x1="18" y1="28" x2="82" y2="82" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FC7A00" />
          <stop offset="1" stopColor="#FF9022" />
        </linearGradient>
      </defs>
    </svg>
  );
};
