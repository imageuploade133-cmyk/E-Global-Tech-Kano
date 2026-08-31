import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { NotificationService } from "@/services/notification-service";

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "deposit.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }
    const { uid } = perm.auth;

    const { targetUid, amount, currency } = await req.json();

    // 2. Validate inputs rigorously
    if (!targetUid) {
      return NextResponse.json({ error: "Missing target user identifier." }, { status: 400 });
    }

    const parsedAmount = Number(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json({ error: "Deposit amount must be a valid positive number." }, { status: 400 });
    }

    const allowedCurrencies = ["NGN", "USD", "EUR", "GBP", "GHS", "KES", "XOF", "XAF", "CAD", "ZAR", "TZS", "UGX", "RWF", "ZMW"];
    if (!currency || !allowedCurrencies.includes(currency)) {
      return NextResponse.json({ error: `Invalid currency. Allowed: ${allowedCurrencies.join(", ")}` }, { status: 400 });
    }

    if (uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        message: `Mock User account credited with ${currency} ${parsedAmount.toLocaleString()} successfully!`
      });
    }

    // 3. Atomically perform wallet & legacy profile update
    const userRef = adminDb.collection("users").doc(targetUid);
    const walletRef = adminDb.collection("wallets").doc(`${targetUid}_${currency}`);

    const result = await adminDb.runTransaction(async (transaction) => {
      const [userSnap, walletSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(walletRef)
      ]);

      if (!userSnap.exists) {
        throw new Error("Target user account profile not found in database.");
      }

      const userData = userSnap.data() || {};
      const currentLegacyBalance = Number(userData.balance) || 0;

      let currentWalletBalance = 0;
      if (walletSnap.exists) {
        currentWalletBalance = Number(walletSnap.data()?.balance) || 0;
      }

      const newWalletBalance = currentWalletBalance + parsedAmount;

      // Update wallet balance
      transaction.set(walletRef, {
        userId: targetUid,
        currency: currency,
        balance: newWalletBalance,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // If currency is NGN, update the legacy balance on user profile
      if (currency === "NGN") {
        const newLegacyBalance = currentLegacyBalance + parsedAmount;
        transaction.update(userRef, {
          balance: newLegacyBalance
        });
      }

      // Generate a highly secure reference number
      const secureRef = `ADMIN-CR-${Date.now()}-${Math.random().toString(36).slice(-4).toUpperCase()}`;
      const txDocRef = adminDb.collection("transactions").doc(`tx-${secureRef}`);

      // Write transaction history ledger record
      transaction.set(txDocRef, {
        userId: targetUid,
        amount: parsedAmount,
        currency: currency,
        type: "DEPOSIT",
        status: "SUCCESSFUL",
        description: `Cash Deposit (${currency})`,
        reference: secureRef,
        recipientName: "Cash Deposit",
        createdAt: new Date().toISOString()
      });

      return {
        secureRef,
        newBalance: newWalletBalance
      };
    });

    // 4. Dispatch high-fidelity push notifications safely in the background
    try {
      const currencySymbol = currency === "NGN" ? "₦" : currency === "USD" ? "$" : "CFA";
      await NotificationService.sendPushNotification(targetUid, {
        title: "Cash Deposit Received",
        body: `Your wallet has been credited with ${currencySymbol}${parsedAmount.toLocaleString()} via Cash Deposit.`,
        type: "transaction",
        url: "/history",
        amount: parsedAmount,
        currency: currency || "NGN",
        reference: result.secureRef,
        recipientName: "Main Wallet",
        bankName: "Cash Deposit",
        channel: "Cash Deposit",
      });
    } catch (notifErr: any) {
      console.error("[Admin Deposit Notif Error]:", notifErr.message);
    }

    return NextResponse.json({
      success: true,
      message: `Successfully credited ${currency} ${parsedAmount.toLocaleString()} to user account.`,
      reference: result.secureRef,
      newBalance: result.newBalance
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Deposit POST API] Secure Deposit Failed:", error.message);
    return NextResponse.json({ error: error.message || "Secured deposit operation failed." }, { status: 500 });
  }
}
