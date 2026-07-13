"use client";

import React from "react";
import { BottomNav } from "@/components/layout/BottomNav";
import { RouteGuard } from "@/components/RouteGuard";
import { Header } from "@/components/layout/Header";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";

export default function StorePage() {
  const { userData, user } = useAuth();
  const userName = (userData?.name || user?.displayName || "Captain") as string;
  const currentPhoto = (userData?.photoURL || user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M") as string;

  return (
    <RouteGuard>
      <div className="min-h-dvh bg-background text-on-background pb-32">
        <Header userName={userName.split(" ")[0].toUpperCase()} profileImage={currentPhoto} />

        <main className="max-w-md mx-auto px-margin-mobile pt-6">
          {/* Header Section */}
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[22px]">
                storefront
              </span>
            </div>
            <div>
              <h1 className="font-bodoni text-[20px] font-bold tracking-tight text-black">
                E-Tech Store
              </h1>
              <p className="font-hanken text-[11px] text-gray-500 font-medium">
                Premium boutique products & services
              </p>
            </div>
          </div>

          {/* Luxury Blank Store Showcase */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-white rounded-[24px] border border-gray-100 p-8 shadow-[0_8px_30px_rgb(0,0,0,0.02)] flex flex-col items-center text-center justify-center min-h-[340px]"
          >
            {/* Elegant Store Outline Design */}
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-primary/10 blur-xl rounded-full scale-110 animate-pulse" />
              <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-[#FFF5EB] to-[#FFF0E0] border border-[#FFD0A1] flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-[42px] animate-bounce-subtle">
                  storefront
                </span>
              </div>
            </div>

            <h2 className="font-bodoni text-[18px] font-bold text-black mb-2">
              Bespoke Storefront
            </h2>

            <p className="font-hanken text-[12px] text-gray-500 leading-relaxed max-w-[260px] mb-6">
              Our curated marketplace featuring physical high-tech gear, exclusive lifestyle merchandise, and priority server subscriptions is coming soon.
            </p>

            {/* Premium Empty State Indicator Pills */}
            <div className="flex flex-wrap gap-2 justify-center max-w-[280px]">
              {["Hardware", "Memberships", "E-Tech Gear"].map((badge) => (
                <span
                  key={badge}
                  className="px-3 py-1.5 rounded-full bg-gray-50 border border-gray-100 font-hanken text-[9.5px] font-bold text-gray-400 tracking-wide uppercase"
                >
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>
        </main>

        <BottomNav />
      </div>
    </RouteGuard>
  );
}
