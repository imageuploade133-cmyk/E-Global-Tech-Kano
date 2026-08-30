import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import bcrypt from "bcryptjs";

// Helper to resolve effective rates and swap fees from config/exchange_rates
async function resolveActiveExchangeConfig() {
  let useLiveWorldDollarRate = false;
  let manualDollarRate = 1550;
  let dollarCommissionFee = 15;
  let useLiveWorldXofRate = false;
  let manualXofRate = 2.5;
  let xofCommissionFee = 0.1;

  let swapFees = {
    ngnToUsd: 50,
    usdToNgn: 1.5,
    ngnToXof: 30,
    xofToNgn: 10,
    usdToXof: 2.0,
    xofToUsd: 15,
  };

  let swapRangeTiers: any[] = [];

  try {
    const docSnap = await adminDb.collection("config").doc("exchange_rates").get();
    if (docSnap.exists) {
      const stored = docSnap.data();
      if (stored) {
        useLiveWorldDollarRate = Boolean(stored.useLiveWorldDollarRate);
        manualDollarRate = Math.max(1, Number(stored.manualDollarRate) || 1550);
        dollarCommissionFee = Math.max(0, Number(stored.dollarCommissionFee) || 0);

        useLiveWorldXofRate = Boolean(stored.useLiveWorldXofRate);
        manualXofRate = Math.max(0.01, Number(stored.manualXofRate) || 2.5);
        xofCommissionFee = Math.max(0, Number(stored.xofCommissionFee) || 0);

        if (stored.swapFees) {
          swapFees = {
            ngnToUsd: Math.max(0, Number(stored.swapFees.ngnToUsd) || 0),
            usdToNgn: Math.max(0, Number(stored.swapFees.usdToNgn) || 0),
            ngnToXof: Math.max(0, Number(stored.swapFees.ngnToXof) || 0),
            xofToNgn: Math.max(0, Number(stored.swapFees.xofToNgn) || 0),
            usdToXof: Math.max(0, Number(stored.swapFees.usdToXof) || 0),
            xofToUsd: Math.max(0, Number(stored.swapFees.xofToUsd) || 0),
          };
        }

        if (Array.isArray(stored.swapRangeTiers)) {
          swapRangeTiers = stored.swapRangeTiers;
        }
      }
    }
  } catch (err: any) {
    console.warn("[resolveActiveExchangeConfig] Firestore read warning:", err.message);
  }

  // Resolve USD Rate
  let baseDollarRate = manualDollarRate;
  if (useLiveWorldDollarRate) {
    try {
      const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/USD", { cache: "no-store" });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (liveData?.rates?.NGN) {
          baseDollarRate = Number(liveData.rates.NGN);
        }
      }
    } catch {}
  }
  const effectiveDollarRate = baseDollarRate + dollarCommissionFee;

  // Resolve XOF Rate
  let baseXofRate = manualXofRate;
  if (useLiveWorldXofRate) {
    try {
      const liveRes = await fetch("https://api.exchangerate-api.com/v4/latest/XOF", { cache: "no-store" });
      if (liveRes.ok) {
        const liveData = await liveRes.json();
        if (liveData?.rates?.NGN) {
          baseXofRate = Number(liveData.rates.NGN);
        }
      }
    } catch {}
  }
  const effectiveXofRate = baseXofRate + xofCommissionFee;

  return {
    effectiveDollarRate,
    effectiveXofRate,
    swapFees,
    swapRangeTiers,
  };
}

// Calculate Swap Fee (checking custom range tiers first, then fallback to pair fee)
function calculateSwapFee(
  from: string,
  to: string,
  amount: number,
  swapFees: Record<string, number>,
  swapRangeTiers: any[]
): number {
  let pairKey = "";
  if (from === "NGN" && to === "USD") pairKey = "ngnToUsd";
  else if (from === "USD" && to === "NGN") pairKey = "usdToNgn";
  else if (from === "NGN" && to === "XOF") pairKey = "ngnToXof";
  else if (from === "XOF" && to === "NGN") pairKey = "xofToNgn";
  else if (from === "USD" && to === "XOF") pairKey = "usdToXof";
  else if (from === "XOF" && to === "USD") pairKey = "xofToUsd";

  if (!pairKey) return 0;

  // 1. Check custom range tier match
  if (Array.isArray(swapRangeTiers)) {
    const matchingTier = swapRangeTiers.find(
      (t: any) => t.pair === pairKey && amount >= Number(t.minAmount) && amount <= Number(t.maxAmount)
    );
    if (matchingTier) {
      return Number(matchingTier.markupFee) || 0;
    }
  }

  // 2. Fallback to standard pair swap fee
  return Number(swapFees[pairKey]) || 0;
}

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");

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

      const allowed = ["NGN", "USD", "XOF"];
      if (!allowed.includes(from) || !allowed.includes(to) || from === to) {
        return NextResponse.json({ error: "Invalid currencies specified. Must swap between NGN, USD, and XOF." }, { status: 400 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount specified. Amount must be a positive number." }, { status: 400 });
      }

      const activeConfig = await resolveActiveExchangeConfig();
      const fee = calculateSwapFee(from, to, amount, activeConfig.swapFees, activeConfig.swapRangeTiers);
      const netAmount = Math.max(0, amount - fee);

      let targetAmount = 0;
      if (from === "NGN" && to === "USD") {
        targetAmount = netAmount / activeConfig.effectiveDollarRate;
      } else if (from === "USD" && to === "NGN") {
        targetAmount = netAmount * activeConfig.effectiveDollarRate;
      } else if (from === "NGN" && to === "XOF") {
        targetAmount = netAmount / activeConfig.effectiveXofRate;
      } else if (from === "XOF" && to === "NGN") {
        targetAmount = netAmount * activeConfig.effectiveXofRate;
      } else if (from === "USD" && to === "XOF") {
        const ngnEquiv = netAmount * activeConfig.effectiveDollarRate;
        targetAmount = ngnEquiv / activeConfig.effectiveXofRate;
      } else if (from === "XOF" && to === "USD") {
        const ngnEquiv = netAmount * activeConfig.effectiveXofRate;
        targetAmount = ngnEquiv / activeConfig.effectiveDollarRate;
      }

      const rate = targetAmount / (amount || 1);

      return NextResponse.json({
        success: true,
        from,
        to,
        amount,
        fee,
        netAmount,
        rate,
        effectiveDollarRate: activeConfig.effectiveDollarRate,
        effectiveXofRate: activeConfig.effectiveXofRate,
        rateFormatted: `₦${activeConfig.effectiveDollarRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} / USD ($1.00)`,
        targetAmount: Number(targetAmount.toFixed(2))
      });
    }

    return NextResponse.json({ error: `Not Found: Endpoint GET /api/wallets/${pathStr} does not exist.` }, { status: 404 });

  } catch (error: any) {
    console.error(`[GET /api/wallets/[...path]] [${reqId}] Unexpected error:`, error);
    return NextResponse.json({
      error: "Internal server error performing wallet path operation.",
      message: error.message
    }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const reqId = `req-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  let body: any = {};

  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");

  try {
    // 3. POST /api/wallets/swap
    if (pathStr === "swap") {
      try {
        body = await req.json();
      } catch {
        return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
      }

      const fromCurrency = (body.fromCurrency || "").toUpperCase();
      const toCurrency = (body.toCurrency || "").toUpperCase();
      const amount = parseFloat(body.amount);
      const pin = body.pin ? String(body.pin).trim() : "";

      const allowed = ["NGN", "USD", "XOF"];
      if (!allowed.includes(fromCurrency) || !allowed.includes(toCurrency) || fromCurrency === toCurrency) {
        return NextResponse.json({ error: "Invalid swap currencies. Must swap NGN, USD, and XOF." }, { status: 400 });
      }
      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Amount must be a positive number." }, { status: 400 });
      }

      const activeConfig = await resolveActiveExchangeConfig();
      const fee = calculateSwapFee(fromCurrency, toCurrency, amount, activeConfig.swapFees, activeConfig.swapRangeTiers);

      if (amount <= fee) {
        return NextResponse.json({
          error: `Swap input amount (${amount}) must be greater than the required swap fee (${fee}).`
        }, { status: 400 });
      }

      // Execute transaction
      const result = await adminDb.runTransaction(async (transaction) => {
        // 1. ALL READS FIRST
        const userRef = adminDb.collection("users").doc(uid);
        const fromWalletRef = adminDb.collection("wallets").doc(`${uid}_${fromCurrency}`);
        const toWalletRef = adminDb.collection("wallets").doc(`${uid}_${toCurrency}`);

        const [userSnap, fromSnap, toSnap] = await Promise.all([
          transaction.get(userRef),
          transaction.get(fromWalletRef),
          transaction.get(toWalletRef),
        ]);

        if (!userSnap.exists) {
          throw new Error("User profile not found.");
        }

        const userData = userSnap.data() || {};
        const isMock = uid === "mock-uid";

        // Transaction PIN Verification
        if (!pin) {
          throw new Error("Transaction PIN is required to authorize currency swap.");
        }

        const pinHash = userData.pinHash;
        const currentPlainPin = userData.pin;
        const lockedUntil = userData.lockedUntil;
        let pinAttempts = Number(userData.pinAttempts) || 0;

        if (lockedUntil) {
          const lockTime = new Date(lockedUntil).getTime();
          if (Date.now() < lockTime) {
            const minutesLeft = Math.ceil((lockTime - Date.now()) / (60 * 1000));
            throw new Error(`Too many incorrect PIN attempts. Account locked for ${minutesLeft} minutes.`);
          }
        }

        let isPinMatch = false;
        if (isMock) {
          isPinMatch = (pin === "1234" || pin === currentPlainPin || (pinHash && bcrypt.compareSync(pin, pinHash)));
        } else if (pinHash) {
          isPinMatch = bcrypt.compareSync(pin, pinHash);
        } else if (currentPlainPin) {
          isPinMatch = (pin === currentPlainPin);
        } else {
          throw new Error("No transaction PIN has been set up on this account.");
        }

        if (!isPinMatch) {
          pinAttempts += 1;
          let lockTimestamp = null;
          if (pinAttempts >= 5) {
            lockTimestamp = new Date(Date.now() + 15 * 60 * 1000).toISOString();
          }
          transaction.update(userRef, {
            pinAttempts,
            lockedUntil: lockTimestamp,
          });

          const remaining = Math.max(0, 5 - pinAttempts);
          return {
            success: false,
            error: pinAttempts >= 5
              ? "Too many incorrect PIN attempts. Account locked for 15 minutes."
              : `Incorrect transaction PIN. ${remaining} attempts remaining.`
          };
        }

        transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

        const fromWalletData = fromSnap.exists ? fromSnap.data() || {} : { balance: 0.00 };
        const toWalletData = toSnap.exists ? toSnap.data() || {} : { balance: 0.00 };

        const sourceBalance = typeof fromWalletData.balance === "number" ? fromWalletData.balance : 0.00;

        const currencySymbol = fromCurrency === "NGN" ? "₦" : (fromCurrency === "USD" ? "$" : "CFA");

        if (sourceBalance < amount) {
          return {
            success: false,
            error: `Insufficient wallet balance in ${fromCurrency} to complete this exchange. Available: ${currencySymbol}${sourceBalance.toLocaleString()}`
          };
        }

        const netAmount = Math.max(0, amount - fee);
        let targetAmountRaw = 0;

        if (fromCurrency === "NGN" && toCurrency === "USD") {
          targetAmountRaw = netAmount / activeConfig.effectiveDollarRate;
        } else if (fromCurrency === "USD" && toCurrency === "NGN") {
          targetAmountRaw = netAmount * activeConfig.effectiveDollarRate;
        } else if (fromCurrency === "NGN" && toCurrency === "XOF") {
          targetAmountRaw = netAmount / activeConfig.effectiveXofRate;
        } else if (fromCurrency === "XOF" && toCurrency === "NGN") {
          targetAmountRaw = netAmount * activeConfig.effectiveXofRate;
        } else if (fromCurrency === "USD" && toCurrency === "XOF") {
          const ngnEquiv = netAmount * activeConfig.effectiveDollarRate;
          targetAmountRaw = ngnEquiv / activeConfig.effectiveXofRate;
        } else if (fromCurrency === "XOF" && toCurrency === "USD") {
          const ngnEquiv = netAmount * activeConfig.effectiveXofRate;
          targetAmountRaw = ngnEquiv / activeConfig.effectiveDollarRate;
        }

        const targetAmount = Number(targetAmountRaw.toFixed(2));
        const rate = targetAmount / (amount || 1);

        // 2. ALL WRITES AFTER READS
        transaction.set(fromWalletRef, {
          userId: uid,
          currency: fromCurrency,
          balance: FieldValue.increment(-amount),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        transaction.set(toWalletRef, {
          userId: uid,
          currency: toCurrency,
          balance: FieldValue.increment(targetAmount),
          updatedAt: new Date().toISOString()
        }, { merge: true });

        if (fromCurrency === "NGN") {
          transaction.update(userRef, { balance: FieldValue.increment(-amount) });
        } else if (toCurrency === "NGN") {
          transaction.update(userRef, { balance: FieldValue.increment(targetAmount) });
        }

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
          description: `Currency Exchange: Swapped ${fromCurrency} ${amount.toLocaleString()} to ${toCurrency}${fee > 0 ? ` (Includes fee: ${fee} ${fromCurrency})` : ""}`,
          recipientName: `${toCurrency} Wallet`,
          status: "SUCCESS",
          date: dateStr,
          time: timeStr,
          fee,
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
          success: true,
          fromAmount: amount,
          fromCurrency,
          toAmount: targetAmount,
          toCurrency,
          fee,
          effectiveDollarRate: activeConfig.effectiveDollarRate,
          effectiveXofRate: activeConfig.effectiveXofRate,
          rateFormatted: `₦${activeConfig.effectiveDollarRate.toLocaleString(undefined, { maximumFractionDigits: 2 })} / USD ($1.00)`,
          rate,
          txRef
        };
      });

      if (!result.success) {
        return NextResponse.json({ error: result.error || "Swap failed" }, { status: 400 });
      }

      const fromCurrency = result.fromCurrency || "";
      const fromAmount = result.fromAmount || 0;
      const toCurrency = result.toCurrency || "";
      const toAmount = result.toAmount || 0;

      return NextResponse.json({
        success: true,
        message: `Successfully exchanged ${fromCurrency} ${fromAmount.toLocaleString()} for ${toCurrency} ${toAmount.toLocaleString()}!`,
        data: result
      });
    }

    return NextResponse.json({ error: `Not Found: Endpoint POST /api/wallets/${pathStr} does not exist.` }, { status: 404 });

  } catch (error: any) {
    console.error(`[POST /api/wallets/[...path]] [${reqId}] Swap exception:`, error);
    return NextResponse.json({
      error: error.message || "Internal server error performing currency exchange swap.",
      message: error.message
    }, { status: 400 });
  }
}
