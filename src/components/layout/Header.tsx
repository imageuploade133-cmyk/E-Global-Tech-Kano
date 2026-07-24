"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NotificationTray, Notification } from "./NotificationTray";
import { LogoutDrawer } from "./LogoutDrawer";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";
import { useAppConfig } from "@/lib/ConfigContext";

interface HeaderProps {
  userName: string;
  profileImage: string;
  isLoading?: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "Transfer Successful",
    message: "Transfer of ₦25,000.00 to Opay account STEVE was completed successfully. Tap to view transaction receipt.",
    time: "2m ago",
    type: "transaction",
    read: false,
  },
  {
    id: "2",
    title: "Security Alert",
    message: "A secure new login session was authenticated on an iPhone 15 Pro from Lagos, Nigeria. Tap to inspect security log.",
    time: "1h ago",
    type: "security",
    read: false,
  },
  {
    id: "3",
    title: "Premium Promo Reward",
    message: "Welcome to E-Tech Infinite! Your elite status grants you 15% off at luxury ZUMA lounges. Tap to view invitation card.",
    time: "5h ago",
    type: "promo",
    read: true,
  },
];

const isCustomAvatar = (url?: string) => {
  if (!url) return false;
  if (url.includes("aida-public") || url.includes("googleusercontent.com/aida-public")) return false;
  return url.includes("i.ibb.co") || url.includes("ibb.co") || url.includes("images.unsplash.com");
};

export const Header: React.FC<HeaderProps> = ({ userName, profileImage, isLoading }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const { config } = useAppConfig();
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);

  const unreadCount = notifications.filter(n => !n.read).length;
  const hasCustomPhoto = isCustomAvatar(profileImage);

  const handleSignOut = async () => {
    setIsLogoutOpen(false);
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch {
      toast.error("Failed to logout");
    }
  };

  // Production-grade action handlers
  const handleMarkAllRead = () => {
    setNotifications([]);
    toast.success("Notifications cleared");
  };

  const handleDeleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast.success("Alert cleared");
  };

  const handleToggleRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, read: true } : n))
    );
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile py-2.5 min-[375px]:py-3 bg-surface-dim/80 backdrop-blur-xl shadow-sm text-black">
        <div className="flex items-center gap-1.5 min-[375px]:gap-2.5 flex-1 min-w-0 mr-2">
          {isLoading ? (
            <div className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full skeleton-shimmer flex-shrink-0" />
          ) : hasCustomPhoto ? (
            <div className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full border border-primary/30 overflow-hidden scale-95 active:scale-90 transition-transform relative flex-shrink-0">
              <Image
                className="object-cover"
                alt="Profile"
                src={profileImage}
                fill
                sizes="36px"
                priority
              />
            </div>
          ) : (
            <div className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full bg-gradient-to-tr from-[#FC7A00] to-[#FF9022] flex items-center justify-center text-white scale-95 active:scale-90 transition-transform relative flex-shrink-0 shadow-sm">
              <span className="material-symbols-outlined text-[18px] min-[375px]:text-[20px] font-bold">person</span>
            </div>
          )}
          <div className="relative w-6 h-6 min-[375px]:w-7 min-[375px]:h-7 flex-shrink-0 bg-black/5 rounded p-0.5 overflow-hidden animate-fade-in" style={{ width: "28px", height: "28px" }}>
            <Image
              src={config.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png"}
              alt="E-Tech Logo"
              fill
              sizes="28px"
              className="object-contain"
              priority
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-label-sm text-[8px] min-[375px]:text-[9px] text-on-surface-variant uppercase tracking-tighter font-bold leading-none truncate">
              Welcome back
            </p>
            {isLoading ? (
              <div className="h-4 bg-gray-200 rounded skeleton-shimmer w-20 mt-1" />
            ) : (
              <h1 className="font-hanken text-[14px] min-[375px]:text-[16px] tracking-tight text-black font-bold truncate" title={userName}>
                {userName}
              </h1>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Link
            href="/support"
            className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
            title="Customer Support"
          >
            <span className="material-symbols-outlined text-[20px] min-[375px]:text-[22px]" style={{ fontVariationSettings: '"wght" 500' }}>
              support_agent
            </span>
          </Link>
          <button
            onClick={() => setIsLogoutOpen(true)}
            className="w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
            title="Sign Out"
          >
            <span className="material-symbols-outlined text-[18px] min-[375px]:text-[20px]" style={{ fontVariationSettings: '"wght" 500' }}>
              power_settings_new
            </span>
          </button>
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative w-8 h-8 min-[375px]:w-9 min-[375px]:h-9 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
            title="Notifications"
          >
            <span className="material-symbols-outlined text-[20px] min-[375px]:text-[22px]">notifications</span>
            {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-error text-error-container rounded-full text-[8px] font-bold flex items-center justify-center border border-surface-dim">
                    {unreadCount}
                </span>
            )}
          </button>
        </div>
      </header>

      <NotificationTray
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={notifications}
        onMarkAllRead={handleMarkAllRead}
        onDeleteNotification={handleDeleteNotification}
        onToggleRead={handleToggleRead}
      />

      <LogoutDrawer
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleSignOut}
      />
    </>
  );
};
