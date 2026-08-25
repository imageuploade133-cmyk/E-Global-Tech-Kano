"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CpanelRouteGuardProps {
  requiredPermission: string;
  children: React.ReactNode;
}

export function CpanelRouteGuard({ requiredPermission, children }: CpanelRouteGuardProps) {
  const pathname = usePathname();
  const [status, setStatus] = useState<"loading" | "authorized" | "denied">("loading");
  const [adminUser, setAdminUser] = useState<{ role?: string; permissions?: string[] } | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkPermission() {
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();

        if (!isMounted) return;

        if (res.ok && data.success && data.user) {
          setAdminUser(data.user);
          const role = (data.user.role || "").toLowerCase();
          const perms = Array.isArray(data.user.permissions) ? data.user.permissions : [];

          if (role === "super_admin" || perms.includes("*") || perms.includes(requiredPermission)) {
            setStatus("authorized");
          } else {
            setStatus("denied");
          }
        } else {
          setStatus("denied");
        }
      } catch {
        if (isMounted) setStatus("denied");
      }
    }

    checkPermission();

    return () => {
      isMounted = false;
    };
  }, [pathname, requiredPermission]);

  if (status === "loading") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 space-y-4">
        <div className="w-10 h-10 border-3 border-[#FC7A00] border-t-transparent rounded-full animate-spin" />
        <p className="text-xs font-black uppercase tracking-wider text-gray-400">Verifying Route Authorization...</p>
      </div>
    );
  }

  if (status === "denied") {
    return (
      <div className="p-6 md:p-12 max-w-2xl mx-auto my-12 text-center font-hanken">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white dark:bg-gray-900 border border-red-200 dark:border-red-900/40 rounded-3xl p-8 md:p-10 shadow-xl space-y-6"
        >
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/20 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <span className="material-symbols-outlined text-[36px]">block</span>
          </div>

          <div>
            <h2 className="text-xl font-extrabold text-gray-900 dark:text-white uppercase tracking-tight">
              Access Denied (HTTP 403)
            </h2>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
              Your account does not possess the required permission (<code className="bg-gray-100 dark:bg-gray-800 text-[#FC7A00] px-2 py-0.5 rounded font-mono text-[11px]">{requiredPermission}</code>) to view or manage this administrative route.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/cpanel/profile"
              className="w-full sm:w-auto px-6 py-3 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">account_circle</span>
              Return to Admin Profile
            </Link>
            <Link
              href="/cpanel"
              className="w-full sm:w-auto px-5 py-3 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-sm">dashboard</span>
              Dashboard
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return <>{children}</>;
}
