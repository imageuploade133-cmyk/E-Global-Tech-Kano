"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { CpanelRouteGuard } from "@/components/cpanel/CpanelRouteGuard";
import { EstateProperty } from "@/estate/types";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function CpanelEstatePropertiesPage() {
  const { isDark, toggleTheme } = useCpanelTheme();
  const [properties, setProperties] = useState<EstateProperty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [propertyFilter, setPropertyFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Detailed View Modal Drawer
  const [selectedInspectProp, setSelectedInspectProp] = useState<EstateProperty | null>(null);

  // Rejection modal
  const [selectedRejectProp, setSelectedRejectProp] = useState<EstateProperty | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  // Action loading state
  const [executingActionId, setExecutingActionId] = useState<string | null>(null);

  const fetchProperties = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/estate/admin/properties");
      const data = await res.json();
      if (data.success && Array.isArray(data.properties)) {
        setProperties(data.properties);
      } else {
        toast.error("Failed to load property directory.");
      }
    } catch {
      toast.error("Network error fetching properties.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProperties();
  }, []);

  const handleAdminPropertyAction = async (action: string, propertyId: string, extra = {}) => {
    setExecutingActionId(propertyId);
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
        if (selectedInspectProp && selectedInspectProp.id === propertyId) {
          setSelectedInspectProp(null);
        }
        fetchProperties();
      } else {
        toast.error(data.error || "Action failed.");
      }
    } catch {
      toast.error("Network error executing action.");
    } finally {
      setExecutingActionId(null);
    }
  };

  // Metrics
  const pendingCount = properties.filter((p) => p.status === "PENDING_REVIEW").length;
  const approvedCount = properties.filter((p) => p.status === "APPROVED" || p.status === "PUBLISHED").length;
  const rejectedCount = properties.filter((p) => p.status === "REJECTED").length;
  const draftCount = properties.filter((p) => p.status === "DRAFT").length;

  // Filtered properties
  const filteredProperties = properties.filter((prop) => {
    let matchesStatus = true;
    if (propertyFilter === "PENDING_REVIEW") matchesStatus = prop.status === "PENDING_REVIEW";
    if (propertyFilter === "APPROVED") matchesStatus = prop.status === "APPROVED" || prop.status === "PUBLISHED";
    if (propertyFilter === "REJECTED") matchesStatus = prop.status === "REJECTED";
    if (propertyFilter === "DRAFT") matchesStatus = prop.status === "DRAFT";

    const q = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !q ||
      prop.title.toLowerCase().includes(q) ||
      prop.propertyType.toLowerCase().includes(q) ||
      (prop.location?.address && prop.location.address.toLowerCase().includes(q)) ||
      (prop.sellerName && prop.sellerName.toLowerCase().includes(q));

    return matchesStatus && matchesSearch;
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
                  <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">home_work</span>
                  <h1 className="font-extrabold text-base md:text-lg uppercase tracking-tight">Property Listings Audit</h1>
                </div>
                <p className={cn("text-xs font-medium mt-0.5", isDark ? "text-gray-400" : "text-gray-500")}>
                  Audit property submissions, review seller listings, approve marketplace items, or toggle featured status.
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
                onClick={fetchProperties}
                className="px-4 h-10 bg-[#FC7A00] hover:bg-[#e06600] text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Metric Cards Summary Bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
            <div className={cn("p-4 rounded-2xl border space-y-1", panelClass)}>
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Pending Approvals</span>
                <span className="material-symbols-outlined text-[18px] text-amber-500">pending_actions</span>
              </div>
              <p className="font-mono text-xl font-black text-amber-500">{pendingCount}</p>
              <span className="text-[10px] text-gray-400 block">Listings awaiting review</span>
            </div>

            <div className={cn("p-4 rounded-2xl border space-y-1", panelClass)}>
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Published / Approved</span>
                <span className="material-symbols-outlined text-[18px] text-emerald-500">verified</span>
              </div>
              <p className="font-mono text-xl font-black text-emerald-600">{approvedCount}</p>
              <span className="text-[10px] text-gray-400 block">Live on marketplace</span>
            </div>

            <div className={cn("p-4 rounded-2xl border space-y-1", panelClass)}>
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Rejected Submissions</span>
                <span className="material-symbols-outlined text-[18px] text-red-500">cancel</span>
              </div>
              <p className="font-mono text-xl font-black text-red-500">{rejectedCount}</p>
              <span className="text-[10px] text-gray-400 block">Returned for corrections</span>
            </div>

            <div className={cn("p-4 rounded-2xl border space-y-1", panelClass)}>
              <div className="flex items-center justify-between text-gray-400">
                <span className="text-[10px] font-black uppercase tracking-wider">Total Directory</span>
                <span className="material-symbols-outlined text-[18px] text-purple-500">folder_open</span>
              </div>
              <p className="font-mono text-xl font-black text-purple-600">{properties.length}</p>
              <span className="text-[10px] text-gray-400 block">All listings in scope</span>
            </div>
          </div>

          {/* Search Bar & Status Filter Tabs */}
          <div className={cn("p-4 rounded-2xl border space-y-4", panelClass)}>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px]">filter_list</span>
                <h3 className="font-extrabold text-sm uppercase">Directory Filters</h3>
              </div>

              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-[18px]">
                  search
                </span>
                <input
                  type="text"
                  placeholder="Search by title, location, type, agent..."
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

            {/* Status Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 select-none">
              {[
                { id: "ALL", label: `All Listings (${properties.length})` },
                { id: "PENDING_REVIEW", label: `Pending Review (${pendingCount})` },
                { id: "APPROVED", label: `Approved / Live (${approvedCount})` },
                { id: "REJECTED", label: `Rejected (${rejectedCount})` },
                { id: "DRAFT", label: `Drafts (${draftCount})` },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPropertyFilter(tab.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all cursor-pointer border",
                    propertyFilter === tab.id
                      ? "bg-[#FC7A00] text-white border-[#FC7A00] shadow-2xs"
                      : isDark ? "bg-gray-900 border-gray-800 text-gray-400 hover:bg-gray-800" : "bg-white border-gray-200 text-gray-600 hover:bg-gray-100"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Properties Table */}
          {isLoading ? (
            <div className={cn("p-12 rounded-2xl border text-center flex flex-col items-center justify-center gap-3", panelClass)}>
              <ButtonSpinner />
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Loading Property Directory...</p>
            </div>
          ) : filteredProperties.length === 0 ? (
            <div className={cn("p-12 rounded-2xl border text-center space-y-3", panelClass)}>
              <span className="material-symbols-outlined text-[48px] text-gray-400">home_work</span>
              <p className="text-xs font-black uppercase text-gray-400">No Properties Found</p>
              <p className="text-[11px] text-gray-500 max-w-md mx-auto">
                No property listings matched your current search query or status filter.
              </p>
            </div>
          ) : (
            <div className={cn("rounded-2xl border overflow-x-auto shadow-xs", panelClass)}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className={cn("border-b text-[10px] font-black uppercase tracking-wider", isDark ? "bg-gray-900/80 border-gray-800 text-gray-400" : "bg-gray-50 border-gray-200 text-gray-500")}>
                    <th className="p-3.5">Property Details</th>
                    <th className="p-3.5">Type & Purpose</th>
                    <th className="p-3.5">Price</th>
                    <th className="p-3.5">Agent / Seller</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className={cn("divide-y font-semibold", isDark ? "divide-gray-800 text-gray-200" : "divide-gray-100 text-gray-800")}>
                  {filteredProperties.map((prop) => {
                    const coverImg = prop.images?.[0] || "";
                    const isExecuting = executingActionId === prop.id;

                    return (
                      <tr key={prop.id} className={cn("transition-colors", isDark ? "hover:bg-gray-800/40" : "hover:bg-gray-50/80")}>
                        <td className="p-3.5">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden flex-shrink-0 flex items-center justify-center">
                              {coverImg ? (
                                <img src={coverImg} alt={prop.title} className="w-full h-full object-cover" />
                              ) : (
                                <span className="material-symbols-outlined text-gray-400 text-[20px]">home_work</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="font-extrabold truncate max-w-xs">{prop.title}</p>
                              <p className="text-[10px] text-gray-400 truncate max-w-xs">{prop.location?.address || "Location not set"}</p>
                            </div>
                          </div>
                        </td>

                        <td className="p-3.5">
                          <span className="font-bold block">{prop.propertyType}</span>
                          <span className="text-[9.5px] text-[#FC7A00] uppercase font-black">FOR {prop.purpose}</span>
                        </td>

                        <td className="p-3.5 font-mono font-black text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          ₦{prop.price?.toLocaleString()}
                        </td>

                        <td className="p-3.5">
                          <p className="font-extrabold text-xs">{prop.sellerName || "Partner Agent"}</p>
                          <p className="text-[10px] text-gray-400 font-mono">{prop.sellerPhone}</p>
                        </td>

                        <td className="p-3.5 whitespace-nowrap">
                          <span
                            className={cn(
                              "px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border",
                              prop.status === "APPROVED" || prop.status === "PUBLISHED"
                                ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                : prop.status === "PENDING_REVIEW"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : "bg-red-500/10 text-red-500 border-red-500/20"
                            )}
                          >
                            {prop.status}
                          </span>
                          {prop.featured && (
                            <span className="ml-1 px-2 py-0.5 rounded-lg text-[8.5px] font-black uppercase bg-purple-500/10 text-purple-400 border border-purple-500/20">
                              FEATURED
                            </span>
                          )}
                        </td>

                        <td className="p-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedInspectProp(prop)}
                              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 font-bold text-[9.5px] uppercase rounded-lg cursor-pointer border-0"
                            >
                              Inspect
                            </button>

                            {prop.status === "PENDING_REVIEW" && (
                              <>
                                <button
                                  type="button"
                                  disabled={isExecuting}
                                  onClick={() => handleAdminPropertyAction("approve", prop.id)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0 disabled:opacity-50"
                                >
                                  {isExecuting ? "..." : "Approve"}
                                </button>
                                <button
                                  type="button"
                                  disabled={isExecuting}
                                  onClick={() => setSelectedRejectProp(prop)}
                                  className="px-2.5 py-1 bg-red-600 hover:bg-red-700 text-white font-black text-[9.5px] uppercase rounded-lg cursor-pointer border-0 disabled:opacity-50"
                                >
                                  Reject
                                </button>
                              </>
                            )}

                            <button
                              type="button"
                              disabled={isExecuting}
                              onClick={() => handleAdminPropertyAction("toggle_featured", prop.id)}
                              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold text-[9.5px] uppercase rounded-lg cursor-pointer border-0 disabled:opacity-50"
                            >
                              {prop.featured ? "Unfeature" : "Feature"}
                            </button>

                            <button
                              type="button"
                              disabled={isExecuting}
                              onClick={() => {
                                if (confirm("Delete this property listing permanently?")) {
                                  handleAdminPropertyAction("delete", prop.id);
                                }
                              }}
                              className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-red-500/20 text-red-500 font-bold text-[9.5px] uppercase rounded-lg cursor-pointer border-0 disabled:opacity-50"
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Property Inspection Drawer / Modal */}
          {selectedInspectProp && (
            <div className="fixed inset-0 z-[100000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
              <div className={cn("w-[94vw] sm:w-full max-w-2xl p-5 sm:p-6 rounded-3xl border shadow-2xl space-y-4 my-auto max-h-[90vh] overflow-y-auto custom-scrollbar", panelClass)}>
                <div className="flex items-center justify-between border-b border-gray-200/40 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">visibility</span>
                    <h3 className="font-extrabold text-sm uppercase tracking-wider">Property Inspection Details</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedInspectProp(null)}
                    className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="space-y-4 text-left">
                  {/* Property Image Gallery */}
                  {selectedInspectProp.images && selectedInspectProp.images.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {selectedInspectProp.images.map((img, idx) => (
                        <div key={idx} className="h-28 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 overflow-hidden">
                          <img src={img} alt={`Gallery ${idx}`} className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <h2 className="font-black text-base uppercase text-gray-900 dark:text-white">{selectedInspectProp.title}</h2>
                    <p className="text-xs text-[#FC7A00] font-bold mt-0.5">{selectedInspectProp.location?.address}</p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 text-xs">
                    <div>
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Price</span>
                      <span className="font-mono font-black text-emerald-600">₦{selectedInspectProp.price?.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Type</span>
                      <span className="font-extrabold">{selectedInspectProp.propertyType}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Purpose</span>
                      <span className="font-extrabold text-[#FC7A00]">FOR {selectedInspectProp.purpose}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-gray-400 block">Status</span>
                      <span className="font-extrabold">{selectedInspectProp.status}</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] font-black uppercase text-gray-400 block">Description</span>
                    <p className="text-xs text-gray-600 dark:text-gray-300 font-medium leading-relaxed bg-gray-50 dark:bg-gray-900 p-3 rounded-xl border border-gray-200/40">
                      {selectedInspectProp.description || "No description provided."}
                    </p>
                  </div>

                  <div className="p-3.5 rounded-2xl border border-gray-200/50 bg-gray-50/50 dark:bg-gray-900/50 space-y-2">
                    <span className="text-[10px] font-black uppercase text-gray-400 block">Agent & Seller Information</span>
                    <div className="flex items-center justify-between text-xs font-semibold">
                      <span>{selectedInspectProp.sellerName || "Partner Agent"}</span>
                      <span className="font-mono text-[#FC7A00]">{selectedInspectProp.sellerPhone}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-gray-200/40">
                    {selectedInspectProp.status === "PENDING_REVIEW" && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleAdminPropertyAction("approve", selectedInspectProp.id)}
                          className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                        >
                          Approve Property
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRejectProp(selectedInspectProp);
                          }}
                          className="px-4 h-10 bg-red-600 hover:bg-red-700 text-white text-xs font-bold uppercase rounded-xl cursor-pointer"
                        >
                          Reject Listing
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedInspectProp(null)}
                      className="px-4 h-10 bg-gray-200 dark:bg-gray-800 text-xs font-bold uppercase rounded-xl cursor-pointer"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Rejection Modal Overlay */}
          {selectedRejectProp && (
            <div className="fixed inset-0 z-[100001] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
              <div className={cn("w-full max-w-sm p-5 space-y-3 rounded-3xl border shadow-2xl text-left", panelClass)}>
                <h3 className="font-extrabold text-sm uppercase">Reject Property Listing</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  Provide a reason for rejecting &quot;{selectedRejectProp.title}&quot;.
                </p>
                <textarea
                  rows={3}
                  value={rejectionReasonInput}
                  onChange={(e) => setRejectionReasonInput(e.target.value)}
                  placeholder="Reason for rejection..."
                  className={cn("w-full p-3 rounded-xl text-xs font-semibold outline-none resize-none", inputClass)}
                />
                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRejectProp(null)}
                    className="w-1/2 py-2.5 bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold text-xs uppercase rounded-xl cursor-pointer border-0"
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
                    className="w-1/2 py-2.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase rounded-xl cursor-pointer border-0"
                  >
                    Confirm Reject
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </CpanelRouteGuard>
  );
}
