import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";

export async function GET(req: Request) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  const startTime = Date.now();
  console.log(`[GET /api/wallets] [${reqId}] Received get-wallets request`);

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    console.error(`[GET /api/wallets] [${reqId}] Auth failure: ${err.message}`);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    // --- SELF-HEALING AUTO-REFUND ENGINE ---
    try {
      const failedTxQuery = await adminDb.collection("transactions")
        .where("userId", "==", uid)
        .where("status", "==", "FAILED")
        .get();

      const failedTxs = failedTxQuery.docs.map(doc => ({ id: doc.id, ...doc.data() }) as any);
      const debitTypes = ["TRANSFER", "WITHDRAWAL", "AIRTIME", "DATA", "BILLS", "INVESTMENT", "SWAP_DEBIT"];

      for (const tx of failedTxs) {
        if (!debitTypes.includes(tx.type)) continue;
        if (!tx.reference) continue;

        const refundRefId = `tx-REFUND-${tx.reference}`;
        const refundDocRef = adminDb.collection("transactions").doc(refundRefId);
        const refundDoc = await refundDocRef.get();

        // Check if refund already processed
        if (refundDoc.exists) continue;

        // Double-check with a query just in case of different ID format
        const refundQuery = await adminDb.collection("transactions")
          .where("userId", "==", uid)
          .where("reference", "==", `REFUND-${tx.reference}`)
          .get();

        if (!refundQuery.empty) continue;

        // Process the refund atomically
        console.log(`[Auto-Refund Engine] [${reqId}] Found unrefunded failed transaction [${tx.reference}] of amount ₦${tx.amount}. Executing refund...`);

        const txCurrency = tx.currency || "NGN";

        await adminDb.runTransaction(async (refundTransaction) => {
          const uRef = adminDb.collection("users").doc(uid);
          const wRef = adminDb.collection("wallets").doc(`${uid}_${txCurrency}`);

          const [uSnap, wSnap] = await Promise.all([
            refundTransaction.get(uRef),
            refundTransaction.get(wRef)
          ]);

          if (!uSnap.exists) return;

          const uData = uSnap.data() || {};
          const wBalance = wSnap.exists ? (Number(wSnap.data()?.balance) || 0) : 0;

          await WalletService.creditWallet(refundTransaction, {
            userId: uid,
            amount: Number(tx.amount),
            currency: txCurrency,
            reference: `REFUND-${tx.reference}`,
            docId: refundRefId,
            description: `Auto-Refund for failed ${tx.type.toLowerCase()}: ${tx.description || ""}`,
            recipientName: tx.recipientName || "System Refund",
            preLoadedUser: {
              ref: uRef,
              data: uData,
              balance: Number(uData.balance) || 0
            },
            preLoadedWallet: {
              ref: wRef,
              data: wSnap.exists ? wSnap.data() || {} : {},
              balance: wBalance
            }
          });
        });

        console.log(`[Auto-Refund Engine] [${reqId}] Successfully processed refund for reference [${tx.reference}]`);
      }
    } catch (refundErr: any) {
      console.error(`[Auto-Refund Engine Error] [${reqId}] Execution failed:`, refundErr.message);
    }

    // 1. Get user profile as base
    const userRef = adminDb.collection("users").doc(uid);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      console.warn(`[GET /api/wallets] [${reqId}] User profile not found for uid: ${uid}`);
      return NextResponse.json({ error: "User profile not found." }, { status: 404 });
    }

    const userData = userSnap.data() || {};
    const legacyBalance = typeof userData.balance === "number" ? userData.balance : 10000.00;

    // 2. Fetch NGN and USD wallets concurrently
    const ngnWalletRef = adminDb.collection("wallets").doc(`${uid}_NGN`);
    const usdWalletRef = adminDb.collection("wallets").doc(`${uid}_USD`);

    const [ngnSnap, usdSnap] = await Promise.all([
      ngnWalletRef.get(),
      usdWalletRef.get()
    ]);

    let ngnBalance = legacyBalance;
    let ngnUpdatedAt = new Date().toISOString();
    let usdBalance = 0.00;
    let usdUpdatedAt = new Date().toISOString();

    // 3. Defensive initialization for NGN wallet
    if (!ngnSnap.exists) {
      console.log(`[GET /api/wallets] [${reqId}] Initializing missing NGN wallet document for uid: ${uid}`);
      await ngnWalletRef.set({
        userId: uid,
        currency: "NGN",
        balance: legacyBalance,
        updatedAt: ngnUpdatedAt
      }, { merge: true });
    } else {
      const ngnData = ngnSnap.data() || {};
      ngnBalance = typeof ngnData.balance === "number" ? ngnData.balance : legacyBalance;
      ngnUpdatedAt = ngnData.updatedAt || ngnUpdatedAt;
    }

    // 4. Defensive initialization for USD wallet
    if (!usdSnap.exists) {
      console.log(`[GET /api/wallets] [${reqId}] Initializing missing USD wallet document for uid: ${uid}`);
      await usdWalletRef.set({
        userId: uid,
        currency: "USD",
        balance: 0.00,
        updatedAt: usdUpdatedAt
      }, { merge: true });
    } else {
      const usdData = usdSnap.data() || {};
      usdBalance = typeof usdData.balance === "number" ? usdData.balance : 0.00;
      usdUpdatedAt = usdData.updatedAt || usdUpdatedAt;
    }

    // 5. Keep legacy balance synchronized with NGN balance
    if (userData.balance !== ngnBalance) {
      console.log(`[GET /api/wallets] [${reqId}] Balance mismatch detected: Profile legacy balance is ₦${userData.balance}, NGN Wallet balance is ₦${ngnBalance}`);

      // If profile balance was updated externally (e.g., via deposit webhook, manual top-up, or admin action),
      // we must update/credit the NGN wallet balance to match it, rather than rolling back the profile balance.
      console.log(`[GET /api/wallets] [${reqId}] Synchronizing NGN wallet balance to match profile balance: ₦${userData.balance}`);
      await ngnWalletRef.set({
        balance: userData.balance,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      ngnBalance = userData.balance;
    }

    console.log(`[GET /api/wallets] [${reqId}] Wallet balances retrieved in ${Date.now() - startTime}ms. NGN: ₦${ngnBalance}, USD: $${usdBalance}`);

    return NextResponse.json({
      success: true,
      wallets: {
        NGN: {
          userId: uid,
          currency: "NGN",
          balance: ngnBalance,
          updatedAt: ngnUpdatedAt
        },
        USD: {
          userId: uid,
          currency: "USD",
          balance: usdBalance,
          updatedAt: usdUpdatedAt
        }
      }
    });

  } catch (error: any) {
    console.error(`[GET /api/wallets] [${reqId}] Unexpected exception:`, error);
    return NextResponse.json({
      error: "Internal server error retrieving wallet balances.",
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}
