"use client";

import React, { useState } from "react";
import Image from "next/image";
import { NotificationTray, Notification } from "./NotificationTray";
import { LogoutDrawer } from "./LogoutDrawer";
import { auth } from "@/lib/firebase";
import { signOut } from "firebase/auth";
import { toast } from "sonner";

interface HeaderProps {
  userName: string;
  profileImage: string;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "Transfer Successful",
    message: "You have successfully sent #25,000 to Opay - STEVE.",
    time: "2m ago",
    type: "transaction",
    read: false,
  },
  {
    id: "2",
    title: "New Login Detected",
    message: "A new login was detected on an iPhone 15 Pro near Lagos.",
    time: "1h ago",
    type: "security",
    read: false,
  },
  {
    id: "3",
    title: "Exclusive Reward",
    message: "Your Infinite card status grants you access to 15% off at ZUMA.",
    time: "5h ago",
    type: "promo",
    read: true,
  },
];

export const Header: React.FC<HeaderProps> = ({ userName, profileImage }) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isLogoutOpen, setIsLogoutOpen] = useState(false);
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  const handleSignOut = async () => {
    setIsLogoutOpen(false);
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch {
      toast.error("Failed to logout");
    }
  };

  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile py-4 bg-surface-dim/80 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden scale-95 active:scale-90 transition-transform relative">
            <Image
              className="object-cover"
              alt="Profile"
              src={profileImage}
              fill
              sizes="40px"
            />
          </div>
          <div className="relative w-8 h-8 mr-1">
            <Image
              src="https://i.ibb.co/WWjZrtC7/E-Tech.png"
              alt="E-Tech Logo"
              fill
              className="object-contain"
            />
          </div>
          <div>
            <p className="font-label-sm text-[10px] text-on-surface-variant uppercase tracking-tighter font-bold leading-none">
              Welcome back
            </p>
            <h1 className="font-hanken text-[18px] tracking-tight text-black font-bold">
              {userName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsLogoutOpen(true)}
            className="w-10 h-10 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: '"wght" 500' }}>
              power_settings_new
            </span>
          </button>
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative w-10 h-10 rounded-full border border-gray-100 bg-gray-50 flex items-center justify-center text-gray-700 hover:bg-gray-100 active:scale-90 transition-all cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px]">notifications</span>
            {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-error text-error-container rounded-full text-[10px] font-bold flex items-center justify-center border-2 border-surface-dim">
                    {unreadCount}
                </span>
            )}
          </button>
        </div>
      </header>

      <NotificationTray
        isOpen={isNotificationsOpen}
        onClose={() => setIsNotificationsOpen(false)}
        notifications={MOCK_NOTIFICATIONS}
      />

      <LogoutDrawer
        isOpen={isLogoutOpen}
        onClose={() => setIsLogoutOpen(false)}
        onConfirm={handleSignOut}
      />
    </>
  );
};
