import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

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
      console.log(`[GET /api/wallets] [${reqId}] Synchronizing user profile legacy balance to NGN wallet balance: ${ngnBalance}`);
      await userRef.update({ balance: ngnBalance });
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
