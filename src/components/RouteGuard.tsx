"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

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
      <div className="flex min-h-screen items-center justify-center bg-white">
        <div className="w-12 h-12 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
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
