import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "store.view");
    if (!perm.authorized) {
      return perm.response!;
    }

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status") || "ALL";
    const searchQuery = (searchParams.get("search") || "").toLowerCase().trim();
    const limitNum = Math.min(100, Math.max(10, Number(searchParams.get("limit")) || 50));

    // Fetch order list efficiently
    let query: FirebaseFirestore.Query = adminDb.collection("store_orders");

    if (statusFilter !== "ALL") {
      query = query.where("status", "==", statusFilter);
    }

    const snapshot = await query.get();

    const orders: any[] = [];
    let totalRevenue = 0;
    let pendingCount = 0;
    let deliveredCount = 0;
    let refundedCount = 0;

    snapshot.forEach((doc) => {
      const data = doc.data();
      const amt = Number(data.totalAmount) || 0;
      totalRevenue += amt;

      const st = String(data.status || "Pending").toLowerCase();
      if (st === "pending") pendingCount++;
      else if (st === "delivered") deliveredCount++;
      else if (st === "refunded" || st === "canceled" || st === "cancelled") refundedCount++;

      // Apply search query filter across customer fields
      if (searchQuery) {
        const nameMatch = (data.customerName || "").toLowerCase().includes(searchQuery);
        const emailMatch = (data.customerEmail || "").toLowerCase().includes(searchQuery);
        const phoneMatch = (data.customerPhone || "").toLowerCase().includes(searchQuery);
        const idMatch = (data.id || "").toLowerCase().includes(searchQuery);
        const addressMatch = (data.deliveryAddress || "").toLowerCase().includes(searchQuery);

        if (nameMatch || emailMatch || phoneMatch || idMatch || addressMatch) {
          orders.push(data);
        }
      } else {
        orders.push(data);
      }
    });

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const totalCount = orders.length;
    const paginatedOrders = orders.slice(0, limitNum);

    return NextResponse.json({
      success: true,
      orders: paginatedOrders,
      metrics: {
        totalOrders: snapshot.size,
        totalRevenue,
        pendingCount,
        deliveredCount,
        refundedCount,
      },
      count: totalCount,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store Orders GET Error]:", error.message);
    return NextResponse.json({ error: "Failed to fetch store orders", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "store.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    const body = await req.json();
    const { action, orderId, newStatus, adminNotes } = body;

    // Single order deletion
    if (action === "delete_order") {
      if (!orderId) {
        return NextResponse.json({ error: "Missing orderId parameter." }, { status: 400 });
      }
      const orderRef = adminDb.collection("store_orders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        return NextResponse.json({ error: "Order not found." }, { status: 404 });
      }

      await orderRef.delete();
      return NextResponse.json({
        success: true,
        message: `Order ${orderId} has been deleted successfully!`,
      });
    }

    // Bulk purge abandoned, failed, or canceled orders
    if (action === "purge_failed_orders") {
      const ordersSnap = await adminDb.collection("store_orders").get();
      let purgedCount = 0;
      const batch = adminDb.batch();

      ordersSnap.forEach((doc) => {
        const data = doc.data();
        const st = String(data.status || "").toLowerCase();
        const paySt = String(data.paymentStatus || "").toLowerCase();

        if (
          st === "payment failed" ||
          st === "pending payment" ||
          st === "canceled" ||
          st === "cancelled" ||
          paySt === "failed" ||
          paySt === "pending_payment"
        ) {
          batch.delete(doc.ref);
          purgedCount++;
        }
      });

      if (purgedCount > 0) {
        await batch.commit();
      }

      return NextResponse.json({
        success: true,
        message: `Purged ${purgedCount} failed, abandoned, and canceled store order records from system storage!`,
        purgedCount,
      });
    }

    if (action !== "update_status" || !orderId || !newStatus) {
      return NextResponse.json({ error: "Missing required parameters (action, orderId, newStatus)." }, { status: 400 });
    }

    const orderRef = adminDb.collection("store_orders").doc(orderId);
    const orderSnap = await orderRef.get();

    if (!orderSnap.exists) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const orderData = orderSnap.data() || {};
    const oldStatus = orderData.status;
    const now = new Date().toISOString();

    const isRefundAction = (newStatus === "Refunded" || newStatus === "Canceled") && (oldStatus !== "Refunded" && oldStatus !== "Canceled");

    if (isRefundAction) {
      const userId = orderData.userId;
      const refundAmount = Number(orderData.totalAmount) || 0;

      if (userId && refundAmount > 0) {
        const walletRef = adminDb.collection("wallets").doc(`${userId}_NGN`);
        const userRef = adminDb.collection("users").doc(userId);

        await adminDb.runTransaction(async (transaction) => {
          const wSnap = await transaction.get(walletRef);
          if (wSnap.exists) {
            const currentBal = Number(wSnap.data()?.balance) || 0;
            const newBal = currentBal + refundAmount;

            // 1. Update wallet balance in wallets collection
            transaction.update(walletRef, {
              balance: newBal,
              updatedAt: now,
            });

            // 2. ALSO update user balance in users collection so app-wide available balance increases immediately
            const userSnap = await transaction.get(userRef);
            if (userSnap.exists) {
              transaction.update(userRef, {
                balance: newBal,
                updatedAt: now,
              });
            }

            // 3. Write structured refund ledger entry for normalization & receipts
            const txRef = adminDb.collection("transactions").doc();
            transaction.set(txRef, {
              id: txRef.id,
              userId,
              type: "STORE_ORDER_REFUND",
              category: "REFUND",
              direction: "CREDIT",
              title: "Order Cancel & Refund",
              description: `Order Cancel & Refund - Order ID: ${orderId}`,
              amount: refundAmount,
              totalCredited: refundAmount,
              totalDebited: refundAmount,
              totalDeducted: refundAmount,
              totalRefunded: refundAmount,
              fee: 0,
              vat: 0,
              markup: 0,
              currency: "NGN",
              balanceBefore: currentBal,
              balanceAfter: newBal,
              status: "SUCCESS",
              reference: `REFUND-${orderId}`,
              orderId: orderId,
              canceledOrderId: orderId,
              recipientName: "E-Tech Store",
              beneficiaryName: "E-Tech Store",
              items: Array.isArray(orderData.items) ? orderData.items : [],
              narration: `Order Cancel & Refund for Store Order ${orderId}`,
              createdAt: now,
              updatedAt: now,
            });
          }
        });
      }
    }

    // Update order status
    const updatePayload: Record<string, any> = {
      status: newStatus,
      updatedAt: now,
    };

    if (adminNotes !== undefined) {
      updatePayload.adminNotes = String(adminNotes).trim();
    }

    await orderRef.update(updatePayload);

    return NextResponse.json({
      success: true,
      message: isRefundAction
        ? `Order status updated to "${newStatus}" and ₦${Number(orderData.totalAmount || 0).toLocaleString()} was refunded to customer wallet!`
        : `Order status updated to "${newStatus}"!`,
      orderId,
      status: newStatus,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Store Orders POST Error]:", error.message);
    return NextResponse.json({ error: "Failed to update order status", details: error.message }, { status: 500 });
  }
}
