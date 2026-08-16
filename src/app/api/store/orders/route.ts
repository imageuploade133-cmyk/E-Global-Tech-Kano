import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function POST(req: Request) {
  try {
    let uid = "";
    try {
      const authUser = await authenticateUserRequest(req);
      uid = authUser.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized: Please sign in to place an order." }, { status: 401 });
    }
    const body = await req.json();
    const { items, customerName, customerEmail, customerPhone, deliveryAddress, paymentMethod = "WALLET_NGN" } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order items list cannot be empty." }, { status: 400 });
    }

    if (!customerName || !customerPhone || !deliveryAddress) {
      return NextResponse.json({ error: "Missing required customer delivery information (name, phone, address)." }, { status: 400 });
    }

    // Calculate total order amount
    let totalAmount = 0;
    const orderItems = items.map((i: any) => {
      const price = Number(i.price) || 0;
      const quantity = Math.max(1, Number(i.quantity) || 1);
      totalAmount += price * quantity;
      return {
        id: i.id || `item_${Date.now()}`,
        title: String(i.title || "Store Item").trim(),
        price,
        quantity,
        imageUrl: String(i.imageUrl || "").trim(),
        category: String(i.category || "General").trim(),
      };
    });

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Invalid total order amount." }, { status: 400 });
    }

    // Deduct totalAmount atomically from user's NGN wallet
    const walletRef = adminDb.collection("wallets").doc(`${uid}_NGN`);
    const walletSnap = await walletRef.get();

    if (!walletSnap.exists) {
      return NextResponse.json({ error: "NGN wallet not found." }, { status: 404 });
    }

    const walletData = walletSnap.data() || {};
    const currentBalance = Number(walletData.balance) || 0;

    if (currentBalance < totalAmount) {
      return NextResponse.json({
        error: `Insufficient wallet balance. Total is ₦${totalAmount.toLocaleString()}, but balance is ₦${currentBalance.toLocaleString()}.`,
      }, { status: 400 });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const now = new Date().toISOString();

    const newOrder = {
      id: orderId,
      userId: uid,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail || "").trim(),
      customerPhone: String(customerPhone).trim(),
      deliveryAddress: String(deliveryAddress).trim(),
      items: orderItems,
      totalAmount,
      currency: "NGN",
      status: "Pending",
      adminNotes: "",
      paymentMethod,
      createdAt: now,
      updatedAt: now,
    };

    // Perform atomic transaction: deduct balance, write ledger transaction, save order
    await adminDb.runTransaction(async (transaction) => {
      const freshWalletSnap = await transaction.get(walletRef);
      if (!freshWalletSnap.exists) {
        throw new Error("Wallet record not found.");
      }
      const freshBal = Number(freshWalletSnap.data()?.balance) || 0;
      if (freshBal < totalAmount) {
        throw new Error("Insufficient wallet balance for store order.");
      }

      const newBalance = freshBal - totalAmount;

      // Update wallet balance
      transaction.update(walletRef, {
        balance: newBalance,
        updatedAt: now,
      });

      // Write wallet ledger transaction
      const txRef = adminDb.collection("transactions").doc();
      transaction.set(txRef, {
        id: txRef.id,
        userId: uid,
        type: "STORE_PURCHASE",
        amount: totalAmount,
        currency: "NGN",
        balanceBefore: freshBal,
        balanceAfter: newBalance,
        status: "SUCCESS",
        reference: orderId,
        narration: `Store Order ${orderId} (${orderItems.length} items)`,
        createdAt: now,
      });

      // Write store order
      const orderRef = adminDb.collection("store_orders").doc(orderId);
      transaction.set(orderRef, newOrder);
    });

    return NextResponse.json({
      success: true,
      message: "Store order placed successfully!",
      order: newOrder,
    });
  } catch (err: any) {
    console.error("[Store Order POST Exception]:", err.message);
    return NextResponse.json({ error: err.message || "Failed to place store order" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    let uid = "";
    try {
      const authUser = await authenticateUserRequest(req);
      uid = authUser.uid;
    } catch {
      return NextResponse.json({ error: "Unauthorized access." }, { status: 401 });
    }
    const ordersSnap = await adminDb
      .collection("store_orders")
      .where("userId", "==", uid)
      .get();

    const orders: any[] = [];
    ordersSnap.forEach((doc) => {
      orders.push(doc.data());
    });

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      success: true,
      orders,
      count: orders.length,
    });
  } catch (err: any) {
    console.error("[Store Orders GET Exception]:", err.message);
    return NextResponse.json({ success: true, orders: [], count: 0 });
  }
}
