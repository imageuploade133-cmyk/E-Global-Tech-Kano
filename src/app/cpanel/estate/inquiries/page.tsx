"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelEstateInquiriesPage() {
  const { isDark, toggleTheme } = useCpanelTheme();
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/properties?inquiries=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.inquiries)) {
        setInquiries(data.inquiries);
      } else {
        toast.error("Failed to load customer inquiries.");
      }
    } catch {
      toast.error("Network error fetching inquiries.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const filteredInquiries = inquiries.filter((inq) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (inq.propertyTitle && inq.propertyTitle.toLowerCase().includes(q)) ||
      (inq.userName && inq.userName.toLowerCase().includes(q)) ||
      (inq.userPhone && inq.userPhone.toLowerCase().includes(q)) ||
      (inq.userEmail && inq.userEmail.toLowerCase().includes(q)) ||
      (inq.message && inq.message.toLowerCase().includes(q))
    );
  });

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300 space-y-6", bgClass)}>
        <div className="max-w-7xl mx-auto space-y-6">

          {/* Sticky Top Header Bar */}
          <div className={cn("sticky top-0 z-30 p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 backdrop-blur-md shadow-xs", panelClass)}>
            <div className="flex items-center gap-3">
              <Link
                href="/cpanel"
                className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
              >
                <span className="material-symbols-outlined text-[20px]">arrow_back</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">contact_support</span>
                  <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Customer Inquiries Audit</h1>
                </div>
                <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                  Inspect buyer and tenant inquiry messages sent to property agents across the marketplace.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={toggleTheme}
                className={cn("px-3 h-10 rounded-xl border font-bold text-xs flex items-center gap-2 transition-all cursor-pointer", isDark ? "bg-gray-900 border-gray-800 text-yellow-400" : "bg-gray-100 border-gray-200 text-gray-700")}
              >
                <span className="material-symbols-outlined text-[18px]">{isDark ? "light_mode" : "dark_mode"}</span>
                <span className="hidden sm:inline">{isDark ? "Light Mode" : "Dark Mode"}</span>
              </button>
              <button
                type="button"
                onClick={fetchInquiries}
                className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm border-0"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Metric Header Card */}
          <div className={cn("p-4 rounded-2xl border space-y-1 max-w-sm", panelClass)}>
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[10px] font-black uppercase tracking-wider">Total Customer Inquiries</span>
              <span className="material-symbols-outlined text-[18px] text-[#FC7A00]">mark_email_unread</span>
            </div>
            <p className="font-mono text-xl font-black text-[#FC7A00]">{inquiries.length}</p>
            <span className="text-[10px] text-gray-400 block">Lead messages sent to sellers</span>
          </div>

          {/* Premium Search Filter Header */}
          <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">search</span>
              <h3 className="font-extrabold text-sm uppercase">Inquiries Directory ({filteredInquiries.length})</h3>
            </div>

            {/* Styled Gradient Search Container */}
            <div className="relative flex-1 max-w-lg bg-gradient-to-r from-[#FC7A00] via-amber-400 to-[#E06600] p-[1.5px] rounded-2xl shadow-xs">
              <div className={cn("relative w-full rounded-[14.5px] flex items-center h-10 px-3", isDark ? "bg-[#111827]" : "bg-white")}>
                <span className="material-symbols-outlined text-[#FC7A00] text-[18px] mr-2">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by property, sender, phone, message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={cn(
                    "w-full bg-transparent border-0 outline-none text-xs font-semibold placeholder-gray-400 truncate",
                    isDark ? "text-white" : "text-gray-900"
                  )}
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="ml-2 text-gray-400 hover:text-black dark:hover:text-white border-0 cursor-pointer"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Directory Table */}
          {isLoading ? (
            <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
              <ButtonSpinner />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Customer Inquiries...</p>
            </div>
          ) : filteredInquiries.length === 0 ? (
            <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
              <span className="material-symbols-outlined text-[48px] text-gray-400">contact_support</span>
              <p className="text-xs font-black uppercase text-gray-400">No Inquiries Found</p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                No customer lead inquiries matched your search criteria.
              </p>
            </div>
          ) : (
            <div className={cn("rounded-2xl border overflow-x-auto shadow-xs", panelClass)}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={cn("border-b text-[10px] font-black uppercase tracking-wider", isDark ? "bg-gray-900/80 border-gray-800 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500")}>
                    <th className="p-3.5">Property Listing</th>
                    <th className="p-3.5">Sender</th>
                    <th className="p-3.5">Contact Info</th>
                    <th className="p-3.5">Inquiry Message</th>
                    <th className="p-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y font-semibold", isDark ? "divide-gray-800 text-gray-200" : "divide-gray-100 text-gray-800")}>
                  {filteredInquiries.map((inq) => (
                    <tr key={inq.id} className={cn("transition-colors", isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50/80")}>
                      <td className="p-3.5 font-extrabold text-[#FC7A00] max-w-[200px] truncate">{inq.propertyTitle}</td>
                      <td className="p-3.5 font-bold">{inq.userName}</td>
                      <td className="p-3.5">
                        <p className="font-extrabold font-mono">{inq.userPhone}</p>
                        <p className="text-[10px] text-gray-400 font-mono">{inq.userEmail}</p>
                      </td>
                      <td className="p-3.5 font-medium text-gray-300 max-w-xs line-clamp-2">{inq.message}</td>
                      <td className="p-3.5 text-right font-mono text-[10.5px] text-gray-400 whitespace-nowrap">
                        {inq.createdAt ? new Date(inq.createdAt).toLocaleString() : "N/A"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </CpanelRouteGuard>
  );
}
