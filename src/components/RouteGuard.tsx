"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import Image from "next/image";
import { motion } from "framer-motion";

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const { user, loading, isPinVerified, userData } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Only allow /auth/login and /auth/signup without session authentication
    const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup";

    if (!user) {
      if (!isPublicRoute) {
        router.push("/auth/login");
      }
    } else {
      // User is logged in
      const hasPin = Boolean(userData?.pin);

      if (!hasPin && pathname !== "/auth/pin-setup") {
        router.push("/auth/pin-setup");
      } else if (hasPin && !isPinVerified && pathname !== "/auth/pin") {
        router.push("/auth/pin");
      } else if (hasPin && isPinVerified && (pathname === "/auth/login" || pathname === "/auth/signup" || pathname === "/auth/pin" || pathname === "/auth/pin-setup")) {
        router.push("/");
      }
    }
  }, [user, loading, isPinVerified, userData, pathname, router]);

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-white p-6">
        <div className="relative flex flex-col items-center">
          {/* Spinning brand gradient ring */}
          <div className="relative w-24 h-24 flex items-center justify-center">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
              className="absolute inset-0 rounded-full border-4 border-gray-100 border-t-[#FC7A00] border-r-[#0b513d]"
            />

            {/* Logo container inside the ring with micro-scale pulse */}
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
              className="relative w-14 h-14 bg-white rounded-full p-2 shadow-sm flex items-center justify-center"
            >
              <Image
                src="https://e-global-tech-kano.vercel.app/_next/image?url=https%3A%2F%2Fi.ibb.co%2FWWjZrtC7%2FE-Tech.png&w=640&q=75"
                alt="E-Tech Logo"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </motion.div>
          </div>

          <motion.p
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
            className="mt-6 font-hanken font-bold text-xs tracking-widest uppercase text-gray-500"
          >
            E-TECH GLOBAL HUB
          </motion.p>
        </div>
      </div>
    );
  }

  const isPublicRoute = pathname === "/auth/login" || pathname === "/auth/signup";

  // Show nothing while redirecting
  if (!user && !isPublicRoute) return null;
  if (user && !userData?.pin && pathname !== "/auth/pin-setup") return null;
  if (user && userData?.pin && !isPinVerified && pathname !== "/auth/pin") return null;

  return <>{children}</>;
}
