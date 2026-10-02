import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { WalletService } from "@/services/wallet-service";
import { NotificationService } from "@/services/notification-service";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallets.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const { searchParams } = new URL(req.url);
    const query = searchParams.get("query")?.trim() || "";

    // 1. Fetch recent admin deposits audit log
    const depositsSnap = await adminDb
      .collection("transactions")
      .where("type", "in", ["DEPOSIT", "ADMIN_DEPOSIT", "WALLET_FUNDING"])
      .orderBy("createdAt", "desc")
      .limit(30)
      .get();

    const depositLogs = depositsSnap.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    // 2. Search users if query provided
    let searchResults: any[] = [];
    if (query) {
      const qLower = query.toLowerCase();

      // Search users collection by email, name, or phone prefix
      const usersSnap = await adminDb.collection("users").limit(20).get();

      const matchedDocs = usersSnap.docs.filter((doc) => {
        const data = doc.data();
        const uid = doc.id.toLowerCase();
        const email = (data.email || "").toLowerCase();
        const name = (data.name || "").toLowerCase();
        const phone = (data.phoneNumber || "").toLowerCase();
        const vaNumber = (data.virtualAccountNumber || "").toLowerCase();

        return (
          uid.includes(qLower) ||
          email.includes(qLower) ||
          name.includes(qLower) ||
          phone.includes(qLower) ||
          vaNumber.includes(qLower)
        );
      });

      // For each matched user, load their multi-currency wallet balances
      searchResults = await Promise.all(
        matchedDocs.map(async (doc) => {
          const uData = doc.data();
          const uid = doc.id;

          // Fetch NGN, USD, EUR, GBP wallet balances
          const currencies = ["NGN", "USD", "EUR", "GBP"];
          const balances: Record<string, number> = {};

          await Promise.all(
            currencies.map(async (curr) => {
              try {
                const wSnap = await adminDb!.collection("wallets").doc(`${uid}_${curr}`).get();
                if (wSnap.exists) {
                  balances[curr] = Number(wSnap.data()?.balance) || 0;
                } else if (curr === "NGN") {
                  balances[curr] = Number(uData.balance) || 0;
                } else {
                  balances[curr] = 0;
                }
              } catch {
                balances[curr] = 0;
              }
            })
          );

          return {
            uid,
            name: uData.name || uData.displayName || "E-Global Customer",
            email: uData.email || "",
            phoneNumber: uData.phoneNumber || uData.phone || "",
            photoURL: uData.photoURL || null,
            virtualAccountNumber: uData.virtualAccountNumber || null,
            virtualAccountBankName: uData.virtualAccountBankName || null,
            balances,
          };
        })
      );
    }

    return NextResponse.json({
      success: true,
      searchResults,
      depositLogs,
    });
  } catch (err: any) {
    console.error("[Admin Deposit GET] Error:", err.message);
    return NextResponse.json({ error: "Failed to load deposit data", details: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "wallets.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
    }

    const body = (await req.json()) || {};
    const { targetUid, currency = "NGN", amount, narration } = body;

    if (!targetUid || typeof targetUid !== "string") {
      return NextResponse.json({ error: "Target customer UID is required." }, { status: 400 });
    }

    const numAmount = Number(amount);
    if (!numAmount || isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: "Valid positive deposit amount is required." }, { status: 400 });
    }

    // Verify target user document exists
    const userDoc = await adminDb.collection("users").doc(targetUid).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: "Target customer profile doc not found." }, { status: 404 });
    }

    const userData = userDoc.data() || {};
    const adminEmail = perm.auth?.email || "admin@system";
    const ref = `ADMIN-DEP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const depositNarration = narration?.trim() || `Administrative Credit Deposit by ${adminEmail}`;

    // Execute atomic credit deposit via WalletService inside runTransaction
    const creditResult = await adminDb.runTransaction(async (transaction) => {
      return await WalletService.creditWallet(transaction, {
        userId: targetUid,
        amount: numAmount,
        currency,
        reference: ref,
        description: depositNarration,
        recipientName: userData.name || targetUid,
        type: "DEPOSIT",
        category: "DEPOSIT",
        direction: "CREDIT",
        totalCredited: numAmount,
      });
    });

    // Save detailed admin audit record
    await adminDb.collection("transactions").doc(ref).set({
      id: ref,
      reference: ref,
      userId: targetUid,
      type: "DEPOSIT",
      category: "DEPOSIT",
      direction: "CREDIT",
      status: "SUCCESS",
      amount: numAmount,
      totalCredited: numAmount,
      currency,
      description: depositNarration,
      adminEmail,
      isAdminDeposit: true,
      metadata: {
        adminEmail,
        depositedAt: new Date().toISOString(),
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    // Dispatch FCM Push Notification to target customer
    const currSym = currency === "USD" ? "$" : currency === "EUR" ? "€" : currency === "GBP" ? "£" : "₦";
    await NotificationService.sendPushNotification(targetUid, {
      title: "Account Credited 💰",
      body: `Your ${currency} wallet has been credited with ${currSym}${numAmount.toLocaleString("en-NG", { minimumFractionDigits: 2 })}.`,
      type: "transaction",
      reference: ref,
      txRef: ref,
      amount: numAmount,
    });

    return NextResponse.json({
      success: true,
      message: `Successfully deposited ${currSym}${numAmount.toLocaleString()} into ${userData.name || targetUid}'s ${currency} wallet!`,
      reference: ref,
      newBalance: creditResult.newBalance,
    });
  } catch (err: any) {
    console.error("[Admin Deposit POST] Error:", err.message);
    return NextResponse.json({ error: "Deposit execution failed", details: err.message }, { status: 500 });
  }
}
