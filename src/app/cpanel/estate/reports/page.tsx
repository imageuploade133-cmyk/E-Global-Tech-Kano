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

export default function CpanelEstateReportsPage() {
  const { isDark, toggleTheme } = useCpanelTheme();
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/properties?reports=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setReports(data.reports);
      } else {
        toast.error("Failed to load property reports.");
      }
    } catch {
      toast.error("Network error fetching reports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filteredReports = reports.filter((rep) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      (rep.propertyTitle && rep.propertyTitle.toLowerCase().includes(q)) ||
      (rep.reason && rep.reason.toLowerCase().includes(q)) ||
      (rep.details && rep.details.toLowerCase().includes(q))
    );
  });

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs h-10 px-3 text-xs outline-none font-semibold truncate w-full";

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
                  <span className="material-symbols-outlined text-red-500 text-[22px]">flag</span>
                  <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Marketplace Flagged Reports</h1>
                </div>
                <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                  Review user reports submitted against suspicious or inaccurate property listings.
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
                onClick={fetchReports}
                className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Metric Header Card */}
          <div className={cn("p-4 rounded-2xl border space-y-1 max-w-sm", panelClass)}>
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[10px] font-black uppercase tracking-wider">Reported Listings</span>
              <span className="material-symbols-outlined text-[18px] text-red-500">report_problem</span>
            </div>
            <p className="font-mono text-xl font-black text-red-500">{reports.length}</p>
            <span className="text-[10px] text-gray-400 block">Flagged items for investigation</span>
          </div>

          {/* Search Filter Header */}
          <div className={cn("p-4 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500 text-[22px]">search</span>
              <h3 className="font-extrabold text-sm uppercase">Reports Directory ({filteredReports.length})</h3>
            </div>

            <div className="relative flex-1 max-w-md">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                search
              </span>
              <input
                type="text"
                placeholder="Search by property title, reason, details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn("pl-9 pr-8", inputClass)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-black dark:hover:text-white border-0"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Directory Table */}
          {isLoading ? (
            <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
              <ButtonSpinner />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Property Reports...</p>
            </div>
          ) : filteredReports.length === 0 ? (
            <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
              <span className="material-symbols-outlined text-[48px] text-emerald-500">verified</span>
              <p className="text-xs font-black uppercase text-gray-400">No Reports Logged</p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                No flagged property reports found.
              </p>
            </div>
          ) : (
            <div className={cn("rounded-2xl border overflow-x-auto shadow-xs", panelClass)}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={cn("border-b text-[10px] font-black uppercase tracking-wider", isDark ? "bg-gray-900/80 border-gray-800 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500")}>
                    <th className="p-3.5">Property Listing</th>
                    <th className="p-3.5">Report Reason</th>
                    <th className="p-3.5">Report Details</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y font-semibold", isDark ? "divide-gray-800 text-gray-200" : "divide-gray-100 text-gray-800")}>
                  {filteredReports.map((rep) => (
                    <tr key={rep.id} className={cn("transition-colors", isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50/80")}>
                      <td className="p-3.5 font-extrabold text-[#FC7A00] max-w-[200px] truncate">{rep.propertyTitle}</td>
                      <td className="p-3.5 font-bold text-red-500">{rep.reason}</td>
                      <td className="p-3.5 font-medium text-gray-300 max-w-xs line-clamp-2">{rep.details || "N/A"}</td>
                      <td className="p-3.5 whitespace-nowrap">
                        <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {rep.status || "PENDING"}
                        </span>
                      </td>
                      <td className="p-3.5 text-right font-mono text-[10.5px] text-gray-400 whitespace-nowrap">
                        {rep.createdAt ? new Date(rep.createdAt).toLocaleString() : "N/A"}
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
