"use client";

import React, { useState } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface TransactionIconProps {
  type: string;
  description?: string;
  recipientName?: string;
  bankName?: string;
  className?: string;
  iconSizeClassName?: string;
}

export const getNetworkLogo = (text: string): string | null => {
  const t = text.toLowerCase();
  if (t.includes("mtn")) return "https://i.ibb.co/bMCvF48h/mtn.png";
  if (t.includes("airtel")) return "https://i.ibb.co/S7mSByR8/airtel.png";
  if (t.includes("glo")) return "https://i.ibb.co/hJ0F6GgY/glo.png";
  if (t.includes("9mobile") || t.includes("etisalat") || t.includes("9mob")) return "https://i.ibb.co/yFC4X9pC/9mobile.png";
  return null;
};

export const getBankLogo = (text: string): string | null => {
  const t = text.toLowerCase();
  if (t.includes("providus")) return "https://i.ibb.co/68Xk9X6M/providus.png";
  if (t.includes("wema")) return "https://i.ibb.co/vxS3P98t/wema.png";
  if (t.includes("fcmb")) return "https://i.ibb.co/3ykbNfG3/fcmb.png";
  if (t.includes("opay") || t.includes("owealth")) return "https://i.ibb.co/Lzq2S3Wq/opay.png";
  if (t.includes("access")) return "https://i.ibb.co/PZrQW8fB/access.png";
  if (t.includes("first bank") || t.includes("firstbank")) return "https://i.ibb.co/gZH0b2y1/firstbank.png";
  return null;
};

export const TransactionIcon: React.FC<TransactionIconProps> = ({
  type,
  description = "",
  recipientName = "",
  bankName = "",
  className,
  iconSizeClassName = "text-[20px]",
}) => {
  const [imageError, setImageError] = useState(false);
  const normalizedType = (type || "").toUpperCase().trim();
  const fullContext = `${description} ${recipientName} ${bankName}`.toLowerCase();

  const isAirtime = normalizedType.includes("AIRTIME") || fullContext.includes("airtime");
  const isData = normalizedType.includes("DATA") || fullContext.includes("data");
  const isSwap = normalizedType.includes("SWAP") || fullContext.includes("swap") || fullContext.includes("exchange");
  const isTransfer = normalizedType.includes("TRANSFER") || normalizedType.includes("WITHDRAWAL") || normalizedType.includes("SEND");
  const isDeposit = normalizedType.includes("DEPOSIT") || normalizedType.includes("CASHOUT") || normalizedType.includes("CARD_FUND");
  const isCable = normalizedType.includes("CABLE") || fullContext.includes("dstv") || fullContext.includes("gotv") || fullContext.includes("startimes");
  const isElectricity = normalizedType.includes("ELECTRIC") || fullContext.includes("electricity") || fullContext.includes("meter") || fullContext.includes("kedco") || fullContext.includes("ikedc");
  const isWaec = normalizedType.includes("WAEC") || fullContext.includes("waec") || fullContext.includes("exam");

  // Check network logo for Airtime/Data
  const networkLogo = (isAirtime || isData) ? getNetworkLogo(fullContext) : null;
  const bankLogo = (isTransfer || isDeposit) ? getBankLogo(fullContext) : null;
  const logoUrl = networkLogo || bankLogo;

  if (logoUrl && !imageError) {
    return (
      <div className={cn("relative rounded-full overflow-hidden flex items-center justify-center p-1 bg-white border border-gray-100 shadow-3xs", className)}>
        <Image
          src={logoUrl}
          alt="Provider Logo"
          width={28}
          height={28}
          className="object-contain w-full h-full rounded-full"
          onError={() => setImageError(true)}
          unoptimized
        />
      </div>
    );
  }

  // Fallback to specific Material Symbols icon for each transaction type
  let iconName = "receipt_long";
  let iconBgColor = "bg-gray-50 text-gray-700 border-gray-200";

  if (isDeposit) {
    iconName = "south_west";
    iconBgColor = "bg-emerald-50 text-emerald-600 border-emerald-200/50";
  } else if (isTransfer) {
    iconName = "north_east";
    iconBgColor = "bg-[#FFF2E6] text-[#FC7A00] border-[#FFE4CC]/50";
  } else if (isSwap) {
    iconName = "swap_horiz";
    iconBgColor = "bg-blue-50 text-blue-600 border-blue-200/50";
  } else if (isAirtime) {
    iconName = "cell_tower";
    iconBgColor = "bg-amber-50 text-amber-600 border-amber-200/50";
  } else if (isData) {
    iconName = "swap_vert";
    iconBgColor = "bg-purple-50 text-purple-600 border-purple-200/50";
  } else if (isCable) {
    iconName = "tv";
    iconBgColor = "bg-indigo-50 text-indigo-600 border-indigo-200/50";
  } else if (isElectricity) {
    iconName = "bolt";
    iconBgColor = "bg-amber-50 text-amber-500 border-amber-200/50";
  } else if (isWaec) {
    iconName = "school";
    iconBgColor = "bg-teal-50 text-teal-600 border-teal-200/50";
  } else if (normalizedType.includes("CARD")) {
    iconName = "credit_card";
    iconBgColor = "bg-cyan-50 text-cyan-600 border-cyan-200/50";
  }

  return (
    <div
      className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 border shadow-3xs",
        iconBgColor,
        className
      )}
    >
      <span className={cn("material-symbols-outlined font-black", iconSizeClassName)}>
        {iconName}
      </span>
    </div>
  );
};
