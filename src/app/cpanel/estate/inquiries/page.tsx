"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";

export default function CpanelEstateInquiriesPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchInquiries = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/properties?inquiries=true");
      const data = await res.json();
      if (data.success && Array.isArray(data.inquiries)) {
        setInquiries(data.inquiries);
      }
    } catch {
      toast.error("Failed to load property inquiries.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className="space-y-6 text-black">
        {/* Metric Header Card */}
        <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-3xs space-y-1">
          <span className="text-[10px] font-black uppercase text-gray-400 block">Total Inquiries</span>
          <span className="font-mono font-black text-2xl text-[#FC7A00]">{inquiries.length}</span>
          <span className="text-[10px] text-gray-400 block">Messages sent by potential buyers & tenants</span>
        </div>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">contact_support</span>
              <h1 className="font-black text-xl text-gray-900 uppercase tracking-tight">Customer Inquiries</h1>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Inspect buyer and tenant messages sent to property agents across the marketplace
            </p>
          </div>

          <button
            type="button"
            onClick={fetchInquiries}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0"
          >
            Refresh Inquiries
          </button>
        </div>

        {/* Inquiries Directory Table */}
        {isLoading ? (
          <div className="p-8 text-center text-xs font-bold uppercase text-gray-400 bg-white rounded-2xl border border-gray-200">
            Loading customer inquiries...
          </div>
        ) : inquiries.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center space-y-1">
            <span className="material-symbols-outlined text-[36px] text-gray-300">contact_support</span>
            <p className="text-xs font-bold text-gray-500 uppercase">No property inquiries logged yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="p-3.5">Property</th>
                  <th className="p-3.5">Sender</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5">Inquiry Message</th>
                  <th className="p-3.5 text-right">Sent At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                {inquiries.map((inq) => (
                  <tr key={inq.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5 font-extrabold text-black">{inq.propertyTitle}</td>
                    <td className="p-3.5 font-bold text-black">{inq.userName}</td>
                    <td className="p-3.5">
                      <p className="font-bold text-black">{inq.userPhone}</p>
                      <p className="text-[10px] text-gray-400">{inq.userEmail}</p>
                    </td>
                    <td className="p-3.5 font-medium text-gray-700 line-clamp-2">{inq.message}</td>
                    <td className="p-3.5 text-right font-mono text-[10.5px] text-gray-400">
                      {new Date(inq.createdAt).toLocaleString()}
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
