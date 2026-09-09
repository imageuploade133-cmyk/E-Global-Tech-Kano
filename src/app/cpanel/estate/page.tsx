"use client";

import React, { useState, useEffect } from "react";
import { toast } from "sonner";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { EstateProperty, EstateSeller } from "@/estate/types";

export default function CpanelEstateManagementPage() {
  const [activeTab, setActiveTab] = useState<
    "DASHBOARD" | "PROPERTIES" | "SELLERS" | "REPORTS"
  >("DASHBOARD");

  const [properties, setProperties] = useState<EstateProperty[]>([]);
  const [sellers, setSellers] = useState<EstateSeller[]>([]);
  const [reports, setReports] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Property Filters
  const [propertyFilter, setPropertyFilter] = useState<string>("PENDING_REVIEW");

  // Rejection modal
  const [selectedRejectProp, setSelectedRejectProp] = useState<EstateProperty | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/estate/admin/properties${propertyFilter ? `?status=${propertyFilter}` : ""}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.properties)) {
        setProperties(data.properties);
      }
    } catch {
      toast.error("Failed to load admin property listings.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSellers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/sellers");
      const data = await res.json();
      if (data.success && Array.isArray(data.sellers)) {
        setSellers(data.sellers);
      }
    } catch {
      toast.error("Failed to load seller agents directory.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "PROPERTIES" || activeTab === "DASHBOARD") {
      fetchProperties();
    }
    if (activeTab === "SELLERS" || activeTab === "DASHBOARD") {
      fetchSellers();
    }
  }, [activeTab, propertyFilter]);

  const handleAdminPropertyAction = async (action: string, propertyId: string, extra = {}) => {
    try {
      const res = await fetch("/api/estate/admin/properties", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, propertyId, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || "Property updated.");
        setSelectedRejectProp(null);
        setRejectionReasonInput("");
        fetchProperties();
      } else {
        toast.error(data.error || "Action failed.");
      }
    } catch {
      toast.error("Network error executing admin action.");
    }
  };

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

  const pendingProperties = properties.filter((p) => p.status === "PENDING_REVIEW");
  const approvedProperties = properties.filter((p) => p.status === "APPROVED" || p.status === "PUBLISHED");

  return (
    <CpanelRouteGuard requiredPermission="estate.view">
      <div className="space-y-6 text-black">
        {/* Header Title */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-gray-200 shadow-xs">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">
                domain
              </span>
              <h1 className="font-black text-xl text-gray-900 uppercase tracking-tight">
                Estate Management Console
              </h1>
            </div>
            <p className="text-xs text-gray-500 font-medium mt-1">
              Audit Property Listings, Approve Sellers/Agents & Monitor Marketplace Reports
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                fetchProperties();
                fetchSellers();
              }}
              className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-0"
            >
              Refresh Data
            </button>
          </div>
        </div>

        {/* CPanel Tab Bar */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 border-b border-gray-200">
          {[
            { id: "DASHBOARD" as const, label: "Overview Metrics", icon: "dashboard" },
            { id: "PROPERTIES" as const, label: "Property Listings", icon: "home_work" },
            { id: "SELLERS" as const, label: "Sellers & Agents", icon: "badge" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 border-0 cursor-pointer transition-all ${
                activeTab === tab.id
                  ? "bg-[#FC7A00] text-white shadow-xs"
                  : "bg-white text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab 1: Overview Metrics */}
        {activeTab === "DASHBOARD" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 bg-white rounded-2xl border border-gray-200 space-y-1 shadow-3xs">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Pending Approvals</span>
                <span className="font-mono font-black text-2xl text-[#FC7A00]">
                  {pendingProperties.length}
                </span>
                <span className="text-[10px] text-gray-400 block">Properties awaiting review</span>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-gray-200 space-y-1 shadow-3xs">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Active Listings</span>
                <span className="font-mono font-black text-2xl text-emerald-600">
                  {approvedProperties.length}
                </span>
                <span className="text-[10px] text-gray-400 block">Published on marketplace</span>
              </div>

              <div className="p-5 bg-white rounded-2xl border border-gray-200 space-y-1 shadow-3xs">
                <span className="text-[10px] font-black uppercase text-gray-400 block">Registered Sellers</span>
                <span className="font-mono font-black text-2xl text-purple-600">
                  {sellers.length}
                </span>
                <span className="text-[10px] text-gray-400 block">Agents & property owners</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Property Listings */}
        {activeTab === "PROPERTIES" && (
          <div className="space-y-4">
            {/* Status Filter */}
            <div className="flex gap-2 border-b border-gray-200 pb-2">
              {[
                { id: "PENDING_REVIEW", label: "Pending Review" },
                { id: "APPROVED", label: "Approved / Published" },
                { id: "REJECTED", label: "Rejected" },
                { id: "DRAFT", label: "Drafts" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setPropertyFilter(st.id)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider border-0 cursor-pointer ${
                    propertyFilter === st.id
                      ? "bg-black text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {st.label}
                </button>
              ))}
            </div>

            {/* Properties Table */}
            {isLoading ? (
              <div className="p-8 text-center text-xs font-bold uppercase text-gray-400">
                Loading property listings...
              </div>
            ) : properties.length === 0 ? (
              <div className="p-8 bg-white rounded-2xl border border-gray-200 text-center space-y-1">
                <span className="material-symbols-outlined text-[36px] text-gray-300">home_work</span>
                <p className="text-xs font-bold text-gray-500 uppercase">No property listings found under this status filter.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                      <th className="p-3">Property</th>
                      <th className="p-3">Type / Purpose</th>
                      <th className="p-3">Price</th>
                      <th className="p-3">Agent / Seller</th>
                      <th className="p-3">Status</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                    {properties.map((prop) => (
                      <tr key={prop.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <p className="font-extrabold text-black line-clamp-1">{prop.title}</p>
                          <p className="text-[10px] text-gray-400">{prop.location?.address}</p>
                        </td>
                        <td className="p-3">
                          <span className="font-bold">{prop.propertyType}</span>
                          <span className="text-[10px] text-[#FC7A00] block uppercase font-black">For {prop.purpose}</span>
                        </td>
                        <td className="p-3 font-mono font-bold text-black">
                          ₦{prop.price?.toLocaleString()}
                        </td>
                        <td className="p-3">
                          <p className="font-bold text-black">{prop.sellerName || "Partner Agent"}</p>
                          <p className="text-[10px] text-gray-400">{prop.sellerPhone}</p>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                            prop.status === "APPROVED" || prop.status === "PUBLISHED"
                              ? "bg-emerald-100 text-emerald-800"
                              : prop.status === "PENDING_REVIEW"
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}>
                            {prop.status}
                          </span>
                        </td>
                        <td className="p-3 text-right space-x-1.5 whitespace-nowrap">
                          {prop.status === "PENDING_REVIEW" && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleAdminPropertyAction("approve", prop.id)}
                                className="px-2.5 py-1 bg-emerald-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedRejectProp(prop)}
                                className="px-2.5 py-1 bg-red-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleAdminPropertyAction("toggle_featured", prop.id)}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-amber-100 text-gray-700 font-bold text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                          >
                            {prop.featured ? "Unfeature" : "Feature"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm("Delete this property listing permanently?")) {
                                handleAdminPropertyAction("delete", prop.id);
                              }
                            }}
                            className="px-2.5 py-1 bg-gray-100 hover:bg-red-100 text-red-600 font-bold text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Tab 3: Sellers Directory */}
        {activeTab === "SELLERS" && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 overflow-x-auto shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-black uppercase text-gray-400 tracking-wider">
                    <th className="p-3">Agent / Agency</th>
                    <th className="p-3">Contact</th>
                    <th className="p-3">Verification</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-semibold text-gray-800">
                  {sellers.map((sel) => (
                    <tr key={sel.uid} className="hover:bg-gray-50">
                      <td className="p-3">
                        <p className="font-extrabold text-black">{sel.displayName}</p>
                        <p className="text-[10px] text-gray-400">{sel.agencyName || "Independent Seller"}</p>
                      </td>
                      <td className="p-3">
                        <p className="font-bold text-black">{sel.phone}</p>
                        <p className="text-[10px] text-gray-400">{sel.email}</p>
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          sel.isVerified ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                        }`}>
                          {sel.isVerified ? "Verified Agent" : "Unverified"}
                        </span>
                      </td>
                      <td className="p-3 text-right space-x-1.5">
                        {!sel.isVerified ? (
                          <button
                            type="button"
                            onClick={() => handleAdminSellerAction("verify", sel.uid)}
                            className="px-2.5 py-1 bg-emerald-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                          >
                            Verify Agent
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAdminSellerAction("reject", sel.uid)}
                            className="px-2.5 py-1 bg-red-600 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                          >
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Rejection Modal Overlay */}
        {selectedRejectProp && (
          <div className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-5 space-y-3 shadow-2xl text-black border-0">
              <h3 className="font-black text-sm uppercase">Reject Property Listing</h3>
              <p className="text-xs text-gray-500">Provide a reason for rejecting &quot;{selectedRejectProp.title}&quot;.</p>
              <textarea
                rows={3}
                value={rejectionReasonInput}
                onChange={(e) => setRejectionReasonInput(e.target.value)}
                placeholder="Reason for rejection..."
                className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedRejectProp(null)}
                  className="w-1/2 py-2.5 bg-gray-100 text-gray-700 font-bold text-xs uppercase rounded-xl border-0"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleAdminPropertyAction("reject", selectedRejectProp.id, {
                      rejectionReason: rejectionReasonInput,
                    })
                  }
                  className="w-1/2 py-2.5 bg-red-600 text-white font-black text-xs uppercase rounded-xl border-0"
                >
                  Confirm Reject
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </CpanelRouteGuard>
  );
}
