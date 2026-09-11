import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { authenticateUserRequest } from "@/lib/auth-util";

// Helper function to auto-clean stale unpaid/abandoned orders older than 24 hours (100% server-side)
async function autoCleanStaleAbandonedOrders() {
  try {
    const twentyFourHoursAgoIso = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const staleOrdersSnap = await adminDb
      .collection("store_orders")
      .where("createdAt", "<", twentyFourHoursAgoIso)
      .get();

    if (!staleOrdersSnap.empty) {
      const batch = adminDb.batch();
      let deleteCount = 0;

      staleOrdersSnap.forEach((doc) => {
        const data = doc.data();
        const st = String(data.status || "").toLowerCase();
        const paySt = String(data.paymentStatus || "").toLowerCase();

        // Delete if unpaid, abandoned, or failed after 24 hours
        if (
          st === "pending payment" ||
          st === "payment failed" ||
          st === "canceled" ||
          st === "cancelled" ||
          paySt === "pending_payment" ||
          paySt === "failed"
        ) {
          batch.delete(doc.ref);
          deleteCount++;
        }
      });

      if (deleteCount > 0) {
        await batch.commit();
        console.log(`[Store Orders Auto-Clean] Auto-deleted ${deleteCount} stale abandoned store orders (>24h old).`);
      }
    }
  } catch (err: any) {
    console.warn("[Store Orders Auto-Clean Warning]:", err.message);
  }
}

export async function POST(req: Request) {
  try {
    let uid = "";
    let userEmail = "";
    try {
      const authUser = await authenticateUserRequest(req);
      uid = authUser.uid;
      userEmail = authUser.email || "";
    } catch {
      return NextResponse.json({ error: "Unauthorized: Please sign in to place an order." }, { status: 401 });
    }

    // Trigger non-blocking 24h stale order cleanup routine
    autoCleanStaleAbandonedOrders().catch(() => {});

    const body = await req.json();
    const { items, customerName, customerEmail, customerPhone, deliveryAddress, paymentMethod = "WALLET_NGN" } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "Order items list cannot be empty." }, { status: 400 });
    }

    if (!customerName || !customerPhone || !deliveryAddress) {
      return NextResponse.json({ error: "Missing required customer delivery information (name, phone, address)." }, { status: 400 });
    }

    // Fetch database single source of truth from config/store_data for 100% server-side price & stock verification
    const storeDataRef = adminDb.collection("config").doc("store_data");
    const storeDataSnap = await storeDataRef.get();

    if (!storeDataSnap.exists) {
      return NextResponse.json({ error: "Store catalog database is unavailable." }, { status: 500 });
    }

    const currentStoreItems: any[] = Array.isArray(storeDataSnap.data()?.items)
      ? [...(storeDataSnap.data()?.items)]
      : [];

    let totalAmount = 0;
    const orderItems: any[] = [];

    // Process each ordered item and enforce server-authoritative promotional prices & stock limits
    for (const reqItem of items) {
      const targetStoreItem = currentStoreItems.find((i: any) => i.id === reqItem.id);
      if (!targetStoreItem) {
        return NextResponse.json({ error: `Invalid item "${reqItem.title || reqItem.id}": Item does not exist in store catalog.` }, { status: 400 });
      }

      if (targetStoreItem.isHidden === true) {
        return NextResponse.json({ error: `Sorry, "${targetStoreItem.title}" is no longer available.` }, { status: 400 });
      }

      if (targetStoreItem.inStock === false) {
        return NextResponse.json({ error: `Sorry, "${targetStoreItem.title}" is currently out of stock.` }, { status: 400 });
      }

      const quantity = Math.max(1, Number(reqItem.quantity) || 1);

      if (!targetStoreItem.unlimitedStock && typeof targetStoreItem.stockQuantity === "number") {
        if (targetStoreItem.stockQuantity <= 0) {
          return NextResponse.json({ error: `Sorry, "${targetStoreItem.title}" is currently out of stock.` }, { status: 400 });
        }
        if (quantity > targetStoreItem.stockQuantity) {
          return NextResponse.json({
            error: `Insufficient stock for "${targetStoreItem.title}". Only ${targetStoreItem.stockQuantity} unit(s) available.`,
          }, { status: 400 });
        }
      }

      // Calculate server-authoritative effective selling price (honoring discounts/promos)
      const basePrice = Number(targetStoreItem.price) || 0;
      const promoPrice = typeof targetStoreItem.discountPrice === "number" && targetStoreItem.discountPrice > 0
        ? targetStoreItem.discountPrice
        : typeof targetStoreItem.promoPrice === "number" && targetStoreItem.promoPrice > 0
        ? targetStoreItem.promoPrice
        : null;

      const serverEffectivePrice = promoPrice !== null && promoPrice < basePrice ? promoPrice : basePrice;

      if (serverEffectivePrice <= 0) {
        return NextResponse.json({ error: `Invalid server price for "${targetStoreItem.title}".` }, { status: 400 });
      }

      const itemTotal = serverEffectivePrice * quantity;
      totalAmount += itemTotal;

      orderItems.push({
        id: targetStoreItem.id,
        title: String(targetStoreItem.title).trim(),
        price: serverEffectivePrice,
        originalListPrice: basePrice,
        quantity,
        imageUrl: String(targetStoreItem.coverImageUrl || targetStoreItem.imageUrl || "").trim(),
        category: String(targetStoreItem.category || "General").trim(),
      });
    }

    if (totalAmount <= 0) {
      return NextResponse.json({ error: "Invalid total order amount." }, { status: 400 });
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
    const now = new Date().toISOString();
    const isCardCheckout = paymentMethod === "CARD_CHECKOUT";

    const paymentChannel = isCardCheckout ? "Checkout with Card Payment" : "Main NGN Wallet";
    const initialPaymentStatus = isCardCheckout ? "PENDING_PAYMENT" : "PAID";
    const initialOrderStatus = isCardCheckout ? "Pending Payment" : "Pending";
    const paymentVerificationRef = isCardCheckout
      ? `CARD-PAY-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`
      : `WLT-PAY-${orderId}`;

    const newOrder = {
      id: orderId,
      userId: uid,
      customerName: String(customerName).trim(),
      customerEmail: String(customerEmail || userEmail).trim(),
      customerPhone: String(customerPhone).trim(),
      deliveryAddress: String(deliveryAddress).trim(),
      items: orderItems,
      totalAmount,
      currency: "NGN",
      status: initialOrderStatus,
      adminNotes: "",
      paymentMethod: isCardCheckout ? "CARD_CHECKOUT" : "WALLET_NGN",
      paymentChannel,
      paymentStatus: initialPaymentStatus,
      paymentVerificationRef,
      createdAt: now,
      updatedAt: now,
    };

    if (isCardCheckout) {
      const gatewayUrl = (process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org").replace(/\/$/, "");
      const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

      const txRef = `TX-STORE-${orderId}`;
      const requestHost = req.headers.get("host") || "";
      const protocol = req.headers.get("x-forwarded-proto") || (requestHost.includes("localhost") ? "http" : "https");
      const defaultOrigin = requestHost ? `${protocol}://${requestHost}` : "https://e-global-197077.vercel.app";
      const originUrl = req.headers.get("origin") || req.headers.get("referer") || defaultOrigin;
      const redirectUrl = `${originUrl.replace(/\/$/, "")}/api/store/orders/verify?orderId=${orderId}&tx_ref=${txRef}`;

      let paymentUrl = "";
      let flwErrorMessage = "";

      // 1. Primary: Request backend VM proxy S2S payment initialization via secure VM .env configuration
      try {
        const vmProxyRes = await fetch(`${gatewayUrl}/api/flutterwave/proxy`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": gatewayApiKey,
            "Authorization": `Bearer ${gatewayApiKey}`,
          },
          body: JSON.stringify({
            method: "POST",
            endpoint: "/payments",
            body: {
              tx_ref: txRef,
              amount: totalAmount,
              currency: "NGN",
              redirect_url: redirectUrl,
              meta: {
                orderId,
                userId: uid,
                customerPhone,
              },
              customer: {
                email: customerEmail || userEmail || "customer@e-tech-store.com",
                phonenumber: customerPhone,
                name: customerName,
              },
              customizations: {
                title: "E-Tech Store Order Payment",
                description: `Payment for Order ${orderId}`,
                logo: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
              },
            },
          }),
        });

        const vmProxyData = await vmProxyRes.json().catch(() => ({}));
        if (vmProxyRes.ok && vmProxyData.status === "success" && vmProxyData.data?.link) {
          paymentUrl = vmProxyData.data.link;
        } else if (vmProxyRes.ok && vmProxyData.link) {
          paymentUrl = vmProxyData.link;
        } else if (vmProxyData.message) {
          flwErrorMessage = vmProxyData.message;
        }
      } catch (err: any) {
        console.warn("[Store Order POST] VM proxy call exception:", err.message);
      }

      // 2. Secondary: Fallback to backend VM /api/flutterwave/initialize endpoint
      if (!paymentUrl) {
        try {
          const vmInitRes = await fetch(`${gatewayUrl}/api/flutterwave/initialize`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": gatewayApiKey,
              "Authorization": `Bearer ${gatewayApiKey}`,
            },
            body: JSON.stringify({
              amount: totalAmount,
              currency: "NGN",
              email: customerEmail || userEmail || "customer@e-tech-store.com",
              name: customerName,
              userId: uid,
              redirectUrl,
              phone: customerPhone,
            }),
          });

          const vmInitData = await vmInitRes.json().catch(() => ({}));
          if (vmInitRes.ok && vmInitData.data?.link) {
            paymentUrl = vmInitData.data.link;
          } else if (vmInitRes.ok && vmInitData.link) {
            paymentUrl = vmInitData.link;
          } else if (!flwErrorMessage && vmInitData.message) {
            flwErrorMessage = vmInitData.message;
          }
        } catch (err: any) {
          console.warn("[Store Order POST] VM initialize exception:", err.message);
        }
      }

      // 3. Fallback: Check local env / Firestore config if direct key exists locally
      if (!paymentUrl) {
        let flutterwaveSecretKey = process.env.FLW_SECRET_KEY || process.env.FLUTTERWAVE_SECRET_KEY || "";
        if (!flutterwaveSecretKey) {
          try {
            const configDoc = await adminDb.collection("config").doc("app_config").get();
            if (configDoc.exists) {
              const cfg = configDoc.data() || {};
              flutterwaveSecretKey = cfg.flutterwaveSecretKey || cfg.flwSecretKey || cfg.flw_secret_key || cfg.flutterwave_secret_key || "";
            }
            if (!flutterwaveSecretKey) {
              const appDoc = await adminDb.collection("config").doc("app").get();
              if (appDoc.exists) {
                const cfg = appDoc.data() || {};
                flutterwaveSecretKey = cfg.flutterwaveSecretKey || cfg.flwSecretKey || cfg.flw_secret_key || cfg.flutterwave_secret_key || "";
              }
            }
          } catch (err: any) {
            console.warn("[Store Order POST] Local config lookup warning:", err.message);
          }
        }

        if (flutterwaveSecretKey) {
          try {
            const flwRes = await fetch("https://api.flutterwave.com/v3/payments", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${flutterwaveSecretKey}`,
              },
              body: JSON.stringify({
                tx_ref: txRef,
                amount: totalAmount,
                currency: "NGN",
                redirect_url: redirectUrl,
                meta: {
                  orderId,
                  userId: uid,
                  customerPhone,
                },
                customer: {
                  email: customerEmail || userEmail || "customer@e-tech-store.com",
                  phonenumber: customerPhone,
                  name: customerName,
                },
                customizations: {
                  title: "E-Tech Store Order Payment",
                  description: `Payment for Order ${orderId}`,
                  logo: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
                },
              }),
            });

            const flwData = await flwRes.json();
            if (flwRes.ok && flwData.status === "success" && flwData.data?.link) {
              paymentUrl = flwData.data.link;
            } else if (!flwErrorMessage) {
              flwErrorMessage = flwData.message || flwData.error;
            }
          } catch (flwErr: any) {
            if (!flwErrorMessage) flwErrorMessage = flwErr.message;
          }
        }
      }

      if (!paymentUrl) {
        return NextResponse.json({
          error: flwErrorMessage || "Unable to generate card payment checkout link. Please try again or pay with Main Wallet.",
        }, { status: 502 });
      }

      // Save order record as Pending Payment and decrement stock
      const orderRef = adminDb.collection("store_orders").doc(orderId);
      await orderRef.set({
        ...newOrder,
        txRef,
        paymentUrl,
      });

      // Deduct stock for items with limited stock quantity
      if (currentStoreItems.length > 0) {
        let stockUpdated = false;
        for (const oItem of orderItems) {
          const idx = currentStoreItems.findIndex((i: any) => i.id === oItem.id);
          if (idx > -1) {
            const itemObj = currentStoreItems[idx];
            if (!itemObj.unlimitedStock && typeof itemObj.stockQuantity === "number") {
              const newQty = Math.max(0, itemObj.stockQuantity - oItem.quantity);
              currentStoreItems[idx] = {
                ...itemObj,
                stockQuantity: newQty,
                inStock: newQty > 0,
              };
              stockUpdated = true;
            }
          }
        }
        if (stockUpdated) {
          await storeDataRef.update({ items: currentStoreItems, updatedAt: now });
        }
      }

      return NextResponse.json({
        success: true,
        message: "Card checkout link generated! Redirecting to Flutterwave...",
        order: newOrder,
        paymentUrl,
        paymentLink: paymentUrl,
        requiresPaymentRedirect: true,
      });

    } else {
      // Wallet NGN Payment: Validate wallet & deduct balance atomically
      const walletRef = adminDb.collection("wallets").doc(`${uid}_NGN`);
      const walletSnap = await walletRef.get();

      if (!walletSnap.exists) {
        return NextResponse.json({ error: "NGN wallet not found." }, { status: 404 });
      }

      const walletData = walletSnap.data() || {};
      const currentBalance = Number(walletData.balance) || 0;

      if (currentBalance < totalAmount) {
        return NextResponse.json({
          error: `Insufficient wallet balance. Total is ₦${totalAmount.toLocaleString()}, but balance is ₦${currentBalance.toLocaleString()}. You can switch to 'Checkout with Card Payment' to complete your order.`,
        }, { status: 400 });
      }

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

        // Update wallet balance in wallets collection
        transaction.update(walletRef, {
          balance: newBalance,
          updatedAt: now,
        });

        // Also update user balance in users collection for 100% app-wide balance synchronization
        const userRef = adminDb.collection("users").doc(uid);
        transaction.update(userRef, {
          balance: newBalance,
          updatedAt: now,
        });

        // Write wallet ledger transaction with complete order and item metadata
        const txRef = adminDb.collection("transactions").doc();
        const txId = txRef.id;
        transaction.set(txRef, {
          id: txId,
          userId: uid,
          type: "STORE_PURCHASE",
          category: "DEBIT",
          direction: "DEBIT",
          title: "Store Order",
          description: `Store Order ${orderId} (${orderItems.length} items)`,
          amount: totalAmount,
          totalDebited: totalAmount,
          fee: 0,
          vat: 0,
          currency: "NGN",
          balanceBefore: freshBal,
          balanceAfter: newBalance,
          status: "SUCCESS",
          reference: orderId,
          orderId: orderId,
          transactionId: txId,
          paymentStatus: "PAID",
          orderStatus: "Pending",
          items: orderItems,
          recipientName: "E-Tech Store",
          narration: `Store Order ${orderId} (${orderItems.length} items)`,
          createdAt: now,
          updatedAt: now,
        });

        // Write store order with associated transactionId
        const orderRef = adminDb.collection("store_orders").doc(orderId);
        transaction.set(orderRef, {
          ...newOrder,
          transactionId: txId,
        });

        // Deduct stock inside transaction
        if (currentStoreItems.length > 0) {
          let stockUpdated = false;
          for (const oItem of orderItems) {
            const idx = currentStoreItems.findIndex((i: any) => i.id === oItem.id);
            if (idx > -1) {
              const itemObj = currentStoreItems[idx];
              if (!itemObj.unlimitedStock && typeof itemObj.stockQuantity === "number") {
                const newQty = Math.max(0, itemObj.stockQuantity - oItem.quantity);
                currentStoreItems[idx] = {
                  ...itemObj,
                  stockQuantity: newQty,
                  inStock: newQty > 0,
                };
                stockUpdated = true;
              }
            }
          }
          if (stockUpdated) {
            transaction.update(storeDataRef, { items: currentStoreItems, updatedAt: now });
          }
        }
      });

      return NextResponse.json({
        success: true,
        message: "Store order placed successfully!",
        order: newOrder,
      });
    }
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

    // Trigger non-blocking 24h stale order cleanup routine
    autoCleanStaleAbandonedOrders().catch(() => {});

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
