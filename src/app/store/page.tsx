"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function StoreRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    // Client-side redirect to /bills?type=data immediately
    router.replace("/bills?type=data");
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-10 h-10 rounded-full border-2 border-gray-150 border-t-[#FC7A00] animate-spin" />
    </div>
  );
}
