"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { NotificationTray, Notification } from "./NotificationTray";

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
  const unreadCount = MOCK_NOTIFICATIONS.filter(n => !n.read).length;

  return (
    <>
      <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin-mobile py-4 bg-surface-dim/80 backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full border border-primary/30 overflow-hidden scale-95 active:scale-90 transition-transform">
            <img
              className="w-full h-full object-cover"
              alt="Profile"
              src={profileImage}
            />
          </div>
          <div>
            <p className="font-label-sm text-[12px] text-on-surface-variant uppercase tracking-tighter font-bold">
              Welcome back
            </p>
            <h1 className="font-headline-md text-[24px] tracking-widest text-primary font-bold">
              Hi, {userName}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={() => setIsNotificationsOpen(true)}
            className="relative text-primary hover:opacity-80 transition-opacity p-2"
          >
            <span className="material-symbols-outlined text-[28px]">notifications</span>
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
    </>
  );
};
