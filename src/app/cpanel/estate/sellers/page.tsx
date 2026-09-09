"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { EstateSeller } from "@/estate/types";

export default function CpanelEstateSellersPage() {
  const [sellers, setSellers] = useState<EstateSeller[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSellers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/sellers");
      const data = await res.json();
      if (data.success && Array.isArray(data.sellers)) {
        setSellers(data.sellers);
      }
    } catch {
      toast.error("Failed to load seller directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, []);

  const handleAdminSellerAction = async (action: string, sellerUid: string) => {
    try {
      const res = await fetch("/api/estate/admin/sellers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, sellerUid }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Seller status updated.");
        fetchSellers();
      } else {
        toast.error(data.error || "Seller action failed.");
      }
    } catch {
      toast.error("Network error updating seller status.");
    }
  };

  const verifiedCount = sellers.filter((s) => s.isVerified).length;
  const pendingCount = sellers.filter((s) => !s.isVerified).length;

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className="space-y-6 text-black">
        {/* Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-3xs space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Total Registered</span>
            <span className="font-mono font-black text-2xl text-purple-600">{sellers.length}</span>
            <span className="text-[10px] text-gray-400 block">Agents & property partners</span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-3xs space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Verified Agents</span>
            <span className="font-mono font-black text-2xl text-emerald-600">{verifiedCount}</span>
            <span className="text-[10px] text-gray-400 block">ID authenticated partners</span>
          </div>

          <div className="p-5 bg-white rounded-2xl border border-gray-200 shadow-3xs space-y-1">
            <span className="text-[10px] font-black uppercase text-gray-400 block">Pending Verification</span>
            <span className="font-mono font-black text-2xl text-[#FC7A00]">{pendingCount}</span>
            <span className="text-[10px] text-gray-400 block">Verification requested</span>
          </div>
        </div>

        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">badge</span>
              <h1 className="font-black text-xl text-gray-900 uppercase tracking-tight">Sellers & Agents</h1>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Verify property agents, review partner credentials, or manage agent authorization
            </p>
          </div>

          <button
            type="button"
            onClick={fetchSellers}
            className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0"
          >
            Refresh Sellers
          </button>
        </div>

        {/* Sellers Directory Table */}
        {isLoading ? (
          <div className="p-8 text-center text-xs font-bold uppercase text-gray-400 bg-white rounded-2xl border border-gray-200">
            Loading seller agents directory...
          </div>
        ) : sellers.length === 0 ? (
          <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center space-y-1">
            <span className="material-symbols-outlined text-[36px] text-gray-300">badge</span>
            <p className="text-xs font-bold text-gray-500 uppercase">No seller agents registered yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  <th className="p-3.5">Agent / Agency</th>
                  <th className="p-3.5">Contact Details</th>
                  <th className="p-3.5">Office Address</th>
                  <th className="p-3.5">Verification</th>
                  <th className="p-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                {sellers.map((sel) => (
                  <tr key={sel.uid} className="hover:bg-gray-50/80 transition-colors">
                    <td className="p-3.5">
                      <p className="font-extrabold text-black">{sel.displayName}</p>
                      <p className="text-[10px] text-gray-400">{sel.agencyName || "Independent Seller"}</p>
                    </td>
                    <td className="p-3.5">
                      <p className="font-bold text-black">{sel.phone}</p>
                      <p className="text-[10px] text-gray-400">{sel.email}</p>
                    </td>
                    <td className="p-3.5 text-[11px] text-gray-600 truncate max-w-[200px]">
                      {sel.address || "N/A"}
                    </td>
                    <td className="p-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded text-[9px] font-black uppercase ${
                          sel.isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {sel.isVerified ? "Verified Agent" : "Unverified"}
                      </span>
                    </td>
                    <td className="p-3.5 text-right space-x-1.5 whitespace-nowrap">
                      {!sel.isVerified ? (
                        <button
                          type="button"
                          onClick={() => handleAdminSellerAction("verify", sel.uid)}
                          className="px-3 py-1 bg-emerald-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                        >
                          Verify Agent
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleAdminSellerAction("reject", sel.uid)}
                          className="px-3 py-1 bg-red-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                        >
                          Revoke Verification
                        </button>
                      )}
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
