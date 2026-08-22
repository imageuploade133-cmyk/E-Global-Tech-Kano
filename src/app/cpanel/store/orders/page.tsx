"use client";
import { useCpanelTheme } from "@/lib/CpanelThemeContext";



import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function ButtonSpinner() {
  return (
    <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export interface StoreOrder {
  id: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  deliveryAddress: string;
  items: Array<{
    id: string;
    title: string;
    price: number;
    quantity: number;
    imageUrl?: string;
    category?: string;
  }>;
  totalAmount: number;
  currency: string;
  status: string;
  adminNotes?: string;
  paymentMethod?: string;
  createdAt: string;
  updatedAt: string;
}

export default function CpanelStoreOrdersPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useCpanelTheme();
  const [isLoadingSession, setIsLoadingSession] = useState(true);

  // Orders & Metrics State
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [availableStatuses, setAvailableStatuses] = useState<string[]>([
    "Pending",
    "Processing",
    "Shipped",
    "Delivered",
    "Refunded",
    "Canceled",
  ]);
  const [metrics, setMetrics] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    pendingCount: 0,
    deliveredCount: 0,
    refundedCount: 0,
  });
  const [isLoadingOrders, setIsLoadingCategories] = useState(true);

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("ALL");

  // Selected Order Modal State
  const [activeOrder, setActiveProductOrder] = useState<StoreOrder | null>(null);
  const [newStatus, setNewStatus] = useState("Pending");
  const [adminNotes, setAdminNotes] = useState("");
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);


  // Check Admin Unlock Session via /api/admin/auth/session
  useEffect(() => {
    async function checkSession() {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      if (isMock) {
        setIsLoadingSession(false);
        return;
      }
      try {
        const res = await fetch("/api/admin/auth/session");
        const data = await res.json();
        if (!res.ok || !data.success) {
          toast.error("Security Session Expired. Please authenticate in CPanel.");
          router.push("/cpanel");
          return;
        }
      } catch (err) {
        console.error("Session check failed:", err);
      } finally {
        setIsLoadingSession(false);
      }
    }
    checkSession();
  }, [router]);

  // Fetch Store Config for custom status list
  useEffect(() => {
    async function fetchConfigSettings() {
      try {
        const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
        const authHeader: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};
        const res = await fetch("/api/admin/store", { headers: authHeader });
        const data = await res.json();
        if (data.success && data.settings?.orderStatuses) {
          setAvailableStatuses(data.settings.orderStatuses);
        }
      } catch (err) {
        console.warn("Failed to load custom order statuses:", err);
      }
    }
    if (!isLoadingSession) {
      fetchConfigSettings();
    }
  }, [isLoadingSession]);

  // Fetch Admin Orders
  const fetchOrders = async () => {
    setIsLoadingCategories(true);
    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const authHeader: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const params = new URLSearchParams();
      if (selectedStatusFilter !== "ALL") params.append("status", selectedStatusFilter);
      if (searchQuery.trim()) params.append("search", searchQuery.trim());

      const res = await fetch(`/api/admin/store/orders?${params.toString()}`, { headers: authHeader });
      const data = await res.json();

      if (data.success && Array.isArray(data.orders)) {
        setOrders(data.orders);
        if (data.metrics) setMetrics(data.metrics);
      } else {
        toast.error(data.error || "Failed to load store orders.");
      }
    } catch (err: any) {
      toast.error(err.message || "Network error loading store orders.");
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (!isLoadingSession) {
      fetchOrders();
    }
  }, [isLoadingSession, selectedStatusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders();
  };

  const openInspectModal = (order: StoreOrder) => {
    setActiveProductOrder(order);
    setNewStatus(order.status || "Pending");
    setAdminNotes(order.adminNotes || "");
  };

  const handleUpdateOrderStatus = async (e?: React.FormEvent, quickStatus?: string) => {
    if (e) e.preventDefault();
    if (!activeOrder) return;

    const targetStatus = quickStatus || newStatus;

    setIsUpdatingStatus(true);
    toast.loading(`Updating order ${activeOrder.id} to "${targetStatus}"...`, { id: "update-order" });

    try {
      const isMock = typeof window !== "undefined" && (window.location.search.includes("mock=true") || sessionStorage.getItem("admin_session_unlocked") === "true");
      const authHeader: Record<string, string> = isMock ? { Authorization: "Bearer mock-admin-token" } : {};

      const res = await fetch("/api/admin/store/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader },
        body: JSON.stringify({
          action: "update_status",
          orderId: activeOrder.id,
          newStatus: targetStatus,
          adminNotes,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast.success(data.message || "Order status updated successfully!", { id: "update-order", duration: 5000 });
        setActiveProductOrder(null);
        fetchOrders();
      } else {
        toast.error(data.error || "Failed to update order status.", { id: "update-order" });
      }
    } catch (err: any) {
      toast.error(err.message || "Network error updating order.", { id: "update-order" });
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const st = (status || "").toLowerCase();
    if (st === "delivered") {
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300";
    }
    if (st === "pending") {
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300";
    }
    if (st === "processing" || st === "shipped") {
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border-blue-300";
    }
    if (st === "refunded" || st === "canceled") {
      return "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300";
    }
    return "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border-purple-300";
  };

  const bgClass = isDark ? "bg-[#0c0f17] text-white" : "bg-gray-50 text-gray-900";
  const panelClass = isDark
    ? "bg-[#111827] border-gray-800/80 text-white shadow-2xs"
    : "bg-white border-gray-200/90 text-gray-900 shadow-3xs";
  const inputClass = isDark
    ? "bg-[#111827] border border-gray-700 text-white placeholder-gray-500 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full"
    : "bg-[#F9FAFB] border border-gray-300 text-gray-900 placeholder-gray-400 focus:border-[#FC7A00] focus:ring-1 focus:ring-[#FC7A00] rounded-xl transition-all shadow-3xs max-w-full h-10 px-3 text-xs outline-none font-semibold truncate w-full";

  if (isLoadingSession) {
    return (
      <div className={cn("min-h-screen flex items-center justify-center p-6", bgClass)}>
        <div className="flex flex-col items-center gap-3">
          <ButtonSpinner />
          <p className="text-xs font-bold uppercase tracking-widest text-gray-400">Verifying Admin Access...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen p-4 md:p-8 font-hanken transition-colors duration-300", bgClass)}>
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Top Navigation Bar */}
        <div className={cn("p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4", panelClass)}>
          <div className="flex items-center gap-3">
            <Link
              href="/cpanel/store"
              className={cn("w-10 h-10 rounded-xl border flex items-center justify-center transition-all", isDark ? "bg-gray-900 border-gray-800 text-white hover:bg-gray-800" : "bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100")}
              title="Return to Storefront Manager"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">shopping_bag</span>
                <h1 className="text-xl font-black uppercase tracking-tight text-[#FC7A00]">
                  Store Orders Dispatch Console
                </h1>
              </div>
              <p className="text-xs font-medium text-gray-400 mt-0.5">
                Inspect customer orders, track fulfillment status, write admin dispatch notes & issue instant wallet refunds
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/cpanel/store"
              className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 font-bold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex items-center gap-2"
            >
              <span className="material-symbols-outlined text-[18px]">storefront</span>
              Store Manager
            </Link>

            <button
              type="button"
              onClick={fetchOrders}
              className="px-4 py-2.5 rounded-xl bg-[#FC7A00] text-white font-black text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-2 shadow-sm"
            >
              <span className="material-symbols-outlined text-[18px]">refresh</span>
              Refresh Orders
            </button>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className={cn("p-4 rounded-2xl border flex flex-col justify-between", panelClass)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Store Revenue</span>
              <span className="material-symbols-outlined text-emerald-500 text-[20px]">payments</span>
            </div>
            <p className="text-xl font-black tracking-tight text-emerald-600 mt-2">
              ₦{metrics.totalRevenue.toLocaleString()}
            </p>
          </div>

          <div className={cn("p-4 rounded-2xl border flex flex-col justify-between", panelClass)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Total Orders</span>
              <span className="material-symbols-outlined text-[#FC7A00] text-[20px]">receipt_long</span>
            </div>
            <p className="text-xl font-black tracking-tight text-black dark:text-white mt-2">
              {metrics.totalOrders}
            </p>
          </div>

          <div className={cn("p-4 rounded-2xl border flex flex-col justify-between", panelClass)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Pending Fulfillment</span>
              <span className="material-symbols-outlined text-amber-500 text-[20px]">pending</span>
            </div>
            <p className="text-xl font-black tracking-tight text-amber-600 mt-2">
              {metrics.pendingCount}
            </p>
          </div>

          <div className={cn("p-4 rounded-2xl border flex flex-col justify-between", panelClass)}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Delivered & Closed</span>
              <span className="material-symbols-outlined text-emerald-500 text-[20px]">task_alt</span>
            </div>
            <p className="text-xl font-black tracking-tight text-emerald-600 mt-2">
              {metrics.deliveredCount}
            </p>
          </div>
        </div>

        {/* Filter Tabs & Customer Search Bar */}
        <div className={cn("p-4 rounded-2xl border space-y-4", panelClass)}>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
            <button
              type="button"
              onClick={() => setSelectedStatusFilter("ALL")}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all",
                selectedStatusFilter === "ALL"
                  ? "bg-[#FC7A00] text-white shadow-xs"
                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
              )}
            >
              All Orders ({metrics.totalOrders})
            </button>

            {availableStatuses.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStatusFilter(st)}
                className={cn(
                  "px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider whitespace-nowrap transition-all",
                  selectedStatusFilter === st
                    ? "bg-[#FC7A00] text-white shadow-xs"
                    : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300 hover:bg-gray-200"
                )}
              >
                {st}
              </button>
            ))}
          </div>

          <form onSubmit={handleSearchSubmit} className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 text-[20px]">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by customer name, phone, email, order ID, or address..."
                className={cn("w-full pl-10 pr-4 py-2.5 rounded-xl border text-xs font-semibold outline-none transition-all", inputClass)}
              />
            </div>
            <button
              type="submit"
              className="px-5 py-2.5 rounded-xl bg-[#FC7A00] text-white font-black text-xs uppercase tracking-wider hover:opacity-90"
            >
              Search
            </button>
          </form>
        </div>

        {/* Orders Table Display */}
        {isLoadingOrders ? (
          <div className={cn("p-12 rounded-2xl border flex flex-col items-center justify-center gap-3", panelClass)}>
            <ButtonSpinner />
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Loading Store Orders Ledger...</p>
          </div>
        ) : orders.length === 0 ? (
          <div className={cn("p-12 rounded-2xl border flex flex-col items-center justify-center text-center gap-3", panelClass)}>
            <span className="material-symbols-outlined text-[48px] text-gray-300">shopping_cart_checkout</span>
            <p className="text-sm font-extrabold text-gray-500">No store orders found matching current filters.</p>
          </div>
        ) : (
          <div className={cn("rounded-2xl border overflow-hidden", panelClass)}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 dark:bg-gray-900/80 text-gray-500 dark:text-gray-400 uppercase font-black tracking-wider text-[10px] border-b border-gray-200 dark:border-gray-800">
                  <tr>
                    <th className="p-4">Order ID & Date</th>
                    <th className="p-4">Customer Details</th>
                    <th className="p-4">Items Summary</th>
                    <th className="p-4">Total Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800/80 font-medium">
                  {orders.map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-900/40 transition-colors">
                      <td className="p-4 whitespace-nowrap">
                        <span className="font-mono font-black text-[#FC7A00] block">{order.id}</span>
                        <span className="text-[10px] text-gray-400 font-semibold">
                          {new Date(order.createdAt).toLocaleString()}
                        </span>
                      </td>

                      <td className="p-4">
                        <div className="font-extrabold text-black dark:text-white">{order.customerName}</div>
                        <div className="text-[11px] text-gray-400 font-mono">{order.customerPhone}</div>
                        <div className="text-[10px] text-gray-500 truncate max-w-xs">{order.deliveryAddress}</div>
                      </td>

                      <td className="p-4">
                        <span className="font-bold text-gray-700 dark:text-gray-300">
                          {order.items?.length || 0} Item(s)
                        </span>
                        <p className="text-[10px] text-gray-400 truncate max-w-xs">
                          {order.items?.map((i) => `${i.title} (x${i.quantity})`).join(", ")}
                        </p>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className="font-extrabold text-emerald-600 text-sm">
                          ₦{order.totalAmount?.toLocaleString()}
                        </span>
                      </td>

                      <td className="p-4 whitespace-nowrap">
                        <span className={cn("px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border", getStatusBadge(order.status))}>
                          {order.status}
                        </span>
                      </td>

                      <td className="p-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => openInspectModal(order)}
                          className="px-3 py-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 hover:bg-[#FC7A00] hover:text-white text-gray-700 dark:text-gray-200 font-bold text-[11px] transition-all flex items-center gap-1 ml-auto"
                        >
                          <span className="material-symbols-outlined text-[16px]">visibility</span>
                          Inspect & Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>

      {/* Inspect & Manage Order Details Modal */}
      {activeOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className={cn("w-full max-w-2xl p-6 rounded-3xl border shadow-2xl space-y-5 my-8", panelClass)}>
            <div className="flex items-center justify-between border-b border-gray-100 dark:border-gray-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[#FC7A00] text-[24px]">local_shipping</span>
                  <h2 className="text-base font-black uppercase tracking-tight">
                    Order Dispatch Inspector: <span className="font-mono text-[#FC7A00]">{activeOrder.id}</span>
                  </h2>
                </div>
                <p className="text-[11px] font-bold text-gray-400 mt-0.5">
                  Placed on {new Date(activeOrder.createdAt).toLocaleString()}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setActiveProductOrder(null)}
                className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-800 flex items-center justify-center text-gray-400 hover:text-black dark:hover:text-white"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Customer & Address Details */}
            <div className="p-4 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-[#FC7A00] block">Customer Delivery Profile</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-gray-400 block text-[10px]">Name:</span>
                  <strong className="font-black text-black dark:text-white">{activeOrder.customerName}</strong>
                </div>

                <div>
                  <span className="text-gray-400 block text-[10px]">Phone Number:</span>
                  <strong className="font-mono font-black text-black dark:text-white">{activeOrder.customerPhone}</strong>
                </div>

                {activeOrder.customerEmail && (
                  <div>
                    <span className="text-gray-400 block text-[10px]">Email Address:</span>
                    <strong className="font-mono text-gray-700 dark:text-gray-300">{activeOrder.customerEmail}</strong>
                  </div>
                )}

                <div>
                  <span className="text-gray-400 block text-[10px]">Payment Method:</span>
                  <strong className="text-emerald-600 font-black">{activeOrder.paymentMethod || "WALLET_NGN"}</strong>
                </div>

                <div className="col-span-1 md:col-span-2 border-t border-gray-200 dark:border-gray-800 pt-2">
                  <span className="text-gray-400 block text-[10px]">Delivery Address:</span>
                  <p className="font-bold text-gray-800 dark:text-gray-200 mt-0.5">{activeOrder.deliveryAddress}</p>
                </div>
              </div>
            </div>

            {/* Purchased Items List */}
            <div className="space-y-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-gray-400 block">Purchased Items Breakdown</span>
              <div className="divide-y divide-gray-100 dark:divide-gray-800 border border-gray-200 dark:border-gray-800 rounded-2xl overflow-hidden">
                {activeOrder.items?.map((item, idx) => (
                  <div key={idx} className="p-3 bg-white dark:bg-gray-900 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      {item.imageUrl && (
                        <img src={item.imageUrl} alt={item.title} className="w-10 h-10 object-contain rounded-lg border p-1" />
                      )}
                      <div>
                        <h4 className="font-black text-xs text-black dark:text-white">{item.title}</h4>
                        <span className="text-[10px] text-gray-400">Qty: x{item.quantity} • ₦{item.price.toLocaleString()} each</span>
                      </div>
                    </div>
                    <strong className="font-black text-xs text-emerald-600">₦{(item.price * item.quantity).toLocaleString()}</strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Order Status & Admin Notes Form */}
            <form onSubmit={(e) => handleUpdateOrderStatus(e)} className="space-y-4 pt-2">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Order Processing Status
                  </label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none cursor-pointer", inputClass)}
                  >
                    {availableStatuses.map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                    Order Total Amount
                  </label>
                  <div className="px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-900 text-sm font-black text-emerald-600">
                    ₦{activeOrder.totalAmount?.toLocaleString()} NGN
                  </div>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-gray-400 block mb-1">
                  Admin Dispatch & Fulfillment Notes
                </label>
                <textarea
                  rows={2}
                  value={adminNotes}
                  onChange={(e) => setAdminNotes(e.target.value)}
                  placeholder="e.g. Dispatched via Logistics Courier Tracking #98234..."
                  className={cn("w-full px-3.5 py-2.5 rounded-xl border text-xs font-bold outline-none resize-none", inputClass)}
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateOrderStatus(undefined, "Delivered")}
                    className="px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">check_circle</span>
                    Mark Delivered
                  </button>

                  <button
                    type="button"
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      if (confirm(`Are you sure you want to Cancel & Refund ₦${activeOrder.totalAmount.toLocaleString()} to customer's wallet?`)) {
                        handleUpdateOrderStatus(undefined, "Refunded");
                      }
                    }}
                    className="px-3 py-2 rounded-xl bg-rose-600 text-white font-bold text-xs uppercase tracking-wider hover:opacity-90 transition-all flex items-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-[16px]">undo</span>
                    Refund & Cancel
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={isUpdatingStatus}
                  className="px-5 py-2.5 rounded-xl bg-[#FC7A00] text-white font-black text-xs uppercase tracking-wider hover:opacity-95 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isUpdatingStatus && <ButtonSpinner />}
                  Save Status & Notes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}