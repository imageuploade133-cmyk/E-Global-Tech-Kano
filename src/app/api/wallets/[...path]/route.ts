import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  const startTime = Date.now();

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    console.error(`[GET /api/wallets/[...path]] [${reqId}] Auth failure: ${err.message}`);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  console.log(`[GET /api/wallets/[...path]] [${reqId}] Path: "${pathStr}", uid: "${uid}"`);

  try {
    // 1. GET /api/wallets/accounts
    if (pathStr === "accounts") {
      const userRef = adminDb.collection("users").doc(uid);
      const userSnap = await userRef.get();
      if (!userSnap.exists) {
        return NextResponse.json({ error: "User profile not found." }, { status: 404 });
      }
      const userData = userSnap.data() || {};
      const fullName = userData.fullName || userData.displayName || `${userData.firstName} ${userData.lastName}` || "Captain User";

      const ngnAccRef = adminDb.collection("wallet_accounts").doc(uid);
      const usdAccRef = adminDb.collection("wallet_accounts").doc(`${uid}_USD`);

      const [ngnAccSnap, usdAccSnap] = await Promise.all([
        ngnAccRef.get(),
        usdAccRef.get()
      ]);

      let ngnAccount = ngnAccSnap.exists ? ngnAccSnap.data() : null;
      let usdAccount = usdAccSnap.exists ? usdAccSnap.data() : null;

      // Defensive fallbacks if missing
      if (!ngnAccount) {
        ngnAccount = {
          userId: uid,
          accountNumber: "9921473281",
          bankName: "Wema Bank",
          accountName: `${fullName} - E-Tech`,
          currency: "NGN",
          isPermanent: true,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await ngnAccRef.set(ngnAccount, { merge: true });
      }

      if (!usdAccount) {
        usdAccount = {
          userId: uid,
          accountNumber: "2209418374",
          bankName: "Silicon Valley Bank",
          accountName: `${fullName} - E-Tech`,
          routingNumber: "021000021",
          swiftCode: "SVBKNM2E",
          currency: "USD",
          isPermanent: true,
          status: "active",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        await usdAccRef.set(usdAccount, { merge: true });
      }

      console.log(`[GET /api/wallets/accounts] [${reqId}] Returned account details in ${Date.now() - startTime}ms`);
      return NextResponse.json({
        success: true,
        accounts: {
          NGN: ngnAccount,
          USD: usdAccount
        }
      });
    }

    // 2. GET /api/wallets/rates
    if (pathStr === "rates") {
      const { searchParams } = new URL(req.url);
      const from = (searchParams.get("from") || "").toUpperCase();
      const to = (searchParams.get("to") || "").toUpperCase();
      const amount = parseFloat(searchParams.get("amount") || "0");

      if (from !== "NGN" && from !== "USD" || to !== "NGN" && to !== "USD" || from === to) {
        return NextResponse.json({ error: "Invalid currencies specified. Must swap between NGN and USD." }, { status: 400 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount specified. Amount must be a positive number." }, { status: 400 });
      }

      // Fetch rates setting
      const ratesRef = adminDb.collection("settings").doc("exchange_rates");
      const ratesSnap = await ratesRef.get();
      let usdToNgn = 1500.00; // default exchange rate (1 USD = 1500 NGN)

      if (ratesSnap.exists) {
        const ratesData = ratesSnap.data() || {};
        usdToNgn = typeof ratesData.usd_to_ngn === "number" ? ratesData.usd_to_ngn : 1500.00;
      } else {
        // Seed rates on-the-fly
        await ratesRef.set({ usd_to_ngn: usdToNgn }, { merge: true });
      }

      const rate = from === "USD" ? usdToNgn : (1 / usdToNgn);
      const targetAmount = amount * rate;

      console.log(`[GET /api/wallets/rates] [${reqId}] Exchange computation: ${amount} ${from} @ ${rate.toFixed(6)} -> ${targetAmount.toFixed(2)} ${to}`);
      return NextResponse.json({
        success: true,
        from,
        to,
        amount,
        rate,
        targetAmount
      });
    }

    return NextResponse.json({ error: `Not Found: Endpoint GET /api/wallets/${pathStr} does not exist.` }, { status: 404 });

  } catch (error: any) {
    console.error(`[GET /api/wallets/[...path]] [${reqId}] Unexpected error:`, error);
    return NextResponse.json({
      error: "Internal server error performing wallet path operation.",
      message: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  const startTime = Date.now();

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    console.error(`[POST /api/wallets/[...path]] [${reqId}] Auth failure: ${err.message}`);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  console.log(`[POST /api/wallets/[...path]] [${reqId}] Path: "${pathStr}", uid: "${uid}"`);

  try {
    // 3. POST /api/wallets/swap
    if (pathStr === "swap") {
      let body: any = {};
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }

      const fromCurrency = (body.fromCurrency || "").toUpperCase();
      const toCurrency = (body.toCurrency || "").toUpperCase();
      const amount = parseFloat(body.amount);

      if (fromCurrency !== "NGN" && fromCurrency !== "USD" || toCurrency !== "NGN" && toCurrency !== "USD" || fromCurrency === toCurrency) {
        return NextResponse.json({ error: "Invalid swap currencies. Must swap NGN and USD concurrently." }, { status: 400 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }

      // Execute transaction
      const result = await adminDb.runTransaction(async (transaction) => {
        // 1. ALL READS FIRST
        const userRef = adminDb.collection("users").doc(uid);
        const fromWalletRef = adminDb.collection("wallets").doc(`${uid}_${fromCurrency}`);
        const toWalletRef = adminDb.collection("wallets").doc(`${uid}_${toCurrency}`);
        const ratesRef = adminDb.collection("settings").doc("exchange_rates");

        const [userSnap, fromSnap, toSnap, ratesSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(fromWalletRef),
          transaction.get(toWalletRef),
          transaction.get(ratesRef)
        ]);

        if (!userSnap.exists) {
          throw new Error("User profile not found.");
        }

        const userData = userSnap.data() || {};
        const fromWalletData = fromSnap.exists ? fromSnap.data() || {} : { balance: 0.00 };
        const toWalletData = toSnap.exists ? toSnap.data() || {} : { balance: 0.00 };

        const sourceBalance = typeof fromWalletData.balance === "number" ? fromWalletData.balance : 0.00;
        const targetBalance = typeof toWalletData.balance === "number" ? toWalletData.balance : 0.00;

        if (sourceBalance < amount) {
          throw new Error(`Insufficient wallet balance in ${fromCurrency} to complete this exchange. Available: ${fromCurrency === "NGN" ? "₦" : "$"}${sourceBalance.toLocaleString()}`);
        }

        let usdToNgn = 1500.00;
        if (ratesSnap.exists) {
          const ratesData = ratesSnap.data() || {};
          usdToNgn = typeof ratesData.usd_to_ngn === "number" ? ratesData.usd_to_ngn : 1500.00;
        }

        const rate = fromCurrency === "USD" ? usdToNgn : (1 / usdToNgn);
        const targetAmount = Number((amount * rate).toFixed(2)); // Round to 2 decimal places

        // 2. ALL WRITES AFTER READS
        const newSourceBalance = sourceBalance - amount;
        const newTargetBalance = targetBalance + targetAmount;

        // Update Source Wallet
        transaction.set(fromWalletRef, {
          userId: uid,
          currency: fromCurrency,
          balance: FieldValue.increment(-amount),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Update Target Wallet
        transaction.set(toWalletRef, {
          userId: uid,
          currency: toCurrency,
          balance: FieldValue.increment(targetAmount),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        // Synchronize legacy user profile balance if NGN is affected
        if (fromCurrency === "NGN") {
          transaction.update(userRef, {
            balance: FieldValue.increment(-amount)
          });
        } else if (toCurrency === "NGN") {
          transaction.update(userRef, {
            balance: FieldValue.increment(targetAmount)
          });
        }

        // Write Audit Ledger Transactions
        const txRef = `swap-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
        const debitTxRef = adminDb.collection("transactions").doc(`tx-debit-${txRef}`);
        const creditTxRef = adminDb.collection("transactions").doc(`tx-credit-${txRef}`);

        const dateStr = new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
        const timeStr = new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

        const debitRecord = {
          userId: uid,
          amount: amount,
          currency: fromCurrency,
          reference: txRef,
          type: "SWAP_DEBIT",
          description: `Currency Exchange: Swapped ${fromCurrency} ${amount.toLocaleString()} to ${toCurrency}`,
          recipientName: `${toCurrency} Wallet`,
          status: "SUCCESS",
          date: dateStr,
          time: timeStr,
          fee: 0,
          createdAt: new Date().toISOString()
        };

        const creditRecord = {
          userId: uid,
          amount: targetAmount,
          currency: toCurrency,
          reference: txRef,
          type: "SWAP_CREDIT",
          description: `Currency Exchange: Received ${toCurrency} ${targetAmount.toLocaleString()} from ${fromCurrency}`,
          recipientName: `${toCurrency} Wallet`,
          status: "SUCCESS",
          date: dateStr,
          time: timeStr,
          fee: 0,
          createdAt: new Date().toISOString()
        };

        transaction.set(debitTxRef, debitRecord);
        transaction.set(creditTxRef, creditRecord);

        return {
          fromAmount: amount,
          fromCurrency,
          toAmount: targetAmount,
          toCurrency,
          rate,
          txRef
        };
      });

      console.log(`[POST /api/wallets/swap] [${reqId}] Successfully completed swap inside transaction in ${Date.now() - startTime}ms. Ref: ${result.txRef}`);
      return NextResponse.json({
        success: true,
        message: `Successfully exchanged ${result.fromCurrency} ${result.fromAmount.toLocaleString()} for ${result.toCurrency} ${result.toAmount.toLocaleString()}!`,
        data: result
      });
    }

    return NextResponse.json({ error: `Not Found: Endpoint POST /api/wallets/${pathStr} does not exist.` }, { status: 404 });

  } catch (error: any) {
    console.error(`[POST /api/wallets/[...path]] [${reqId}] Swap exception:`, error);
    return NextResponse.json({
      error: error.message || "Internal server error performing currency exchange swap.",
      message: error.message,
      stack: error.stack
    }, { status: 400 });
  }
}
