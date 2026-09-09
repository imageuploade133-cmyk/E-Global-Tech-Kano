"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";

export default function CpanelEstateReportsPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/properties?reports=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.reports)) {
        setReports(data.reports);
      }
    } catch {
      toast.error("Failed to load property reports.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className="space-y-6 text-black">
        {/* Metric Header Card */}
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-3xs space-y-1">
          <span className="text-[10px] font-black uppercase text-gray-400 block">Reported Listings</span>
          <span className="font-mono font-black text-2xl text-red-600">{reports.length}</span>
          <span className="text-[10px] text-gray-400 block">Flagged listings requiring admin investigation</span>
        </div>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-red-600 text-[24px]">flag</span>
              <h1 className="font-black text-xl text-gray-900 uppercase tracking-tight">Marketplace Reports</h1>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Review flagged listings and user reports submitted against suspicious or inaccurate properties
            </p>
          </div>

          <button
            type="button"
            onClick={fetchReports}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0"
          >
            Refresh Reports
          </button>
        </div>

        {/* Reports Directory Table */}
        {isLoading ? (
          <div className="p-8 text-center text-xs font-bold uppercase text-gray-400 bg-white rounded-2xl border border-gray-200">
            Loading property reports...
          </div>
        ) : reports.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center space-y-1">
            <span className="material-symbols-outlined text-[36px] text-gray-300">verified</span>
            <p className="text-xs font-bold text-gray-500 uppercase">No property reports logged. All clear!</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="p-3.5">Property</th>
                  <th className="p-3.5">Report Reason</th>
                  <th className="p-3.5">Details</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Reported At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                {reports.map((rep) => (
                  <tr key={rep.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 font-extrabold text-black">{rep.propertyTitle}</td>
                    <td className="p-3.5 font-bold text-red-600">{rep.reason}</td>
                    <td className="p-3.5 font-medium text-gray-700 line-clamp-2">{rep.details || "N/A"}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                        {rep.status || "PENDING"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-[10.5px] text-gray-400">
                      {new Date(rep.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </CpanelRouteGuard>
  );
}
