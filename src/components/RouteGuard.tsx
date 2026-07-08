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

    const isAuthRoute = pathname.startsWith("/auth");

    if (!user) {
      if (!isAuthRoute) {
        router.push("/auth/login");
      }
    } else {
      // User is logged in
      if (!userData?.pin && pathname !== "/auth/pin-setup") {
        router.push("/auth/pin-setup");
      } else if (userData?.pin && !isPinVerified && pathname !== "/auth/pin") {
        router.push("/auth/pin");
      } else if (isPinVerified && isAuthRoute) {
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

  const isAuthRoute = pathname.startsWith("/auth");

  // Show nothing while redirecting
  if (!user && !isAuthRoute) return null;
  if (user && !userData?.pin && pathname !== "/auth/pin-setup") return null;
  if (user && userData?.pin && !isPinVerified && pathname !== "/auth/pin") return null;

  return <>{children}</>;
}
