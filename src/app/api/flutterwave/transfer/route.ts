import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";
import { WalletService } from "@/services/wallet-service";
import { logPaymentEvent } from "@/lib/payment-logger";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  const startTime = Date.now();
  let uid = "";

  // 1. Authenticate user
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch (authErr: unknown) {
    const error = authErr as Error;
    console.error("[Transfer Auth Error] Verification failed:", error.message);
    return NextResponse.json({ error: "Unauthorized: Invalid or missing token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      amount,
      account_number,
      accountNumber,
      account_bank,
      accountBank,
      bankCode,
      account_name,
      accountName,
      currency,
      narration,
      reference,
      pin,
    } = body;

    const BANK_CODE_MAPPING: Record<string, string> = {
      // Major Banks
      '1': '044',    // Access Bank
      '2': '023',    // Citi Bank
      '4': '050',    // EcoBank
      '5': '011',    // First Bank
      '6': '214',    // FCMB
      '7': '070',    // Fidelity Bank
      '8': '058',    // GTBank
      '9': '076',    // Polaris Bank
      '10': '221',   // Stanbic IBTC
      '11': '068',   // Standard Chartered
      '12': '232',   // Sterling Bank
      '13': '033',   // UBA
      '14': '032',   // Union Bank
      '15': '035',   // Wema Bank
      '16': '057',   // Zenith Bank
      '17': '215',   // Unity Bank
      '18': '101',   // Providus Bank
      '183': '082',  // Keystone Bank
      '184': '301',  // Jaiz Bank
      '231': '100',  // Suntrust Bank
      '259': '400001', // FSDH Merchant Bank
      '260': '502',  // Rand Merchant Bank

      // Payment Service Providers
      '1435': '100004', // Opay
      '990': '100033',  // Palmpay
      '254': '090267',  // Kuda Bank
      '1864': '090405', // Moniepoint
      '639': '090328',  // Eyowo
      '1434': '100034', // Zenith Eazy Wallet
      '1431': '100052', // Beta-Access Yello
      '1430': '110003', // Interswitch
      '1429': '110005', // 3Line
      '1428': '110006', // Paystack
      '1427': '110008', // Kadick
      '1426': '110010', // Interswitch Financial Inclusion
      '1425': '110011', // Arca Payments
      '1424': '110012', // Cellulant
      '1423': '110013', // QR Payments
      '1422': '110015', // Vas2Nets
      '1421': '110017', // Crowdforce
      '1420': '110018', // Microsystems
      '1419': '110019', // Nibssussd
      '1418': '110021', // Bud Infrastructure
      '1417': '110022', // Koraypay
      '1416': '110023', // Capricorn Digital
      '1415': '110024', // Resident Fintech
      '1414': '110025', // Netapps
      '1413': '110026', // Spay Business
      '1412': '110027', // Yello Digital
      '1411': '110028', // Nomba
      '1410': '110029', // Woven Finance
      '1409': '120002', // HopePSB
      '1408': '120003', // Momo PSB
      '1407': '120004', // Smartcash PSB
      '1406': '120005', // Money Master PSB

      // Microfinance Banks
      '997': '120001', // 9 Payment Service Bank
      '996': '090286', // Safe Haven
      '995': '100035', // M36
      '994': '090420', // Letshego
      '992': '090383', // Manny
      '989': '090366', // Firmus
      '988': '000030', // Parallex Bank
      '987': '060004', // Greenwich Merchant Bank
      '986': '090423', // MAUTECH
      '965': '303',    // ChamsMobile
      '964': '000025', // Titan Trust Bank
      '949': '100007', // Stanbic IBTC @ease
      '948': '100006', // eTranzact
      '947': '100005', // Cellulant
      '946': '100003', // Parkway-ReadyCash
      '945': '100001', // FET

      // Virtual Banks
      '1353': '090435', // Links Microfinance
      '1317': '090470', // Dot Microfinance
      '1154': '090482', // Clearpay
    };

    const trfAmount = Number(amount);
    const trfAccount = account_number || accountNumber;

    const trfBankRaw = bankCode || accountBank || account_bank;
    let trfBank = trfBankRaw;
    if (trfBankRaw && BANK_CODE_MAPPING[String(trfBankRaw).trim()]) {
      trfBank = BANK_CODE_MAPPING[String(trfBankRaw).trim()];
    }

    const trfName = account_name || accountName;
    const trfCurrency = currency || "NGN";
    const trfReference = reference || `trf-${Date.now()}-${uid.slice(-6)}`;

    // Validations
    if (!trfAmount || isNaN(trfAmount) || trfAmount <= 0) {
      return NextResponse.json({ error: "Invalid transfer amount. Must be greater than zero." }, { status: 400 });
    }
    if (!trfAccount || !trfBank || !pin) {
      return NextResponse.json({ error: "Account number, bank, and transaction PIN are required." }, { status: 400 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const isMock = uid === "mock-uid";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

    // 2. Fetch transfer fee dynamically from gateway or fallback to 10.00 NGN
    let fee = 10.00;
    if (!isMock) {
      try {
        const feeRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer-fee?amount=${trfAmount}&currency=${trfCurrency}`, {
          headers: {
            "Authorization": `Bearer ${idToken}`,
            "Content-Type": "application/json",
          },
        });
        const feeData = await feeRes.json();
        if (feeRes.ok && feeData.success) {
          fee = Number(feeData.fee) || 10.00;
        }
      } catch (err: unknown) {
        const error = err as Error;
        console.warn("[Transfer API] Failed to fetch dynamic fee. Using fallback 10 NGN:", error.message);
      }
    }

    const totalDeduction = trfAmount + fee;
    const description = narration || `Direct transfer to ${trfName} (${trfAccount})`;

    // 4. Mock simulation bypass early exit before accessing adminDb
    if (isMock) {
      if (pin !== "1234") {
        return NextResponse.json({ error: "Incorrect PIN. 4 attempts remaining." }, { status: 400 });
      }

      logPaymentEvent({
        category: "Transfer",
        userId: uid,
        tx_ref: trfReference,
        amount: trfAmount,
        currency: trfCurrency,
        message: `Processed successful mock transfer: ${description}`,
        processingTimeMs: Date.now() - startTime,
      });

      return NextResponse.json({
        success: true,
        reference: trfReference,
        message: `Your mock bank transfer has been initiated successfully! ₦${trfAmount.toLocaleString()} is being settled to ${trfName}.`,
      });
    }

    // 3. Atomically verify PIN and debit user balance inside Firestore transaction
    const userRef = adminDb.collection("users").doc(uid);

    const transactionResult = await adminDb.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      if (!userDoc.exists) {
        throw new Error("USER_NOT_FOUND");
      }

      const userData = userDoc.data() || {};
      const pinHash = userData.pinHash;
      const currentPlainPin = userData.pin;
      const lockedUntil = userData.lockedUntil;
      let pinAttempts = Number(userData.pinAttempts) || 0;

      // Lockout check
      if (lockedUntil) {
        const lockTime = new Date(lockedUntil).getTime();
        if (Date.now() < lockTime) {
          const minutesLeft = Math.ceil((lockTime - Date.now()) / (60 * 1000));
          return {
            success: false,
            error: `Too many incorrect PIN attempts. Locked. Please try again in ${minutesLeft} minutes.`,
          };
        }
      }

      let isPinMatch = false;
      if (pinHash) {
        isPinMatch = bcrypt.compareSync(pin, pinHash);
      } else if (currentPlainPin) {
        isPinMatch = (pin === currentPlainPin);
      } else {
        return {
          success: false,
          error: "No transaction PIN has been set up on this account.",
        };
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
            : `Incorrect PIN. ${remaining} attempts remaining.`,
        };
      }

      // PIN matches, reset attempts
      transaction.update(userRef, { pinAttempts: 0, lockedUntil: null });

      // Check balance
      const currentBalance = Number(userData.balance) || 0;
      if (currentBalance < totalDeduction) {
        return {
          success: false,
          error: `Insufficient wallet balance to complete this transfer. Required: ₦${totalDeduction.toLocaleString()}, Available: ₦${currentBalance.toLocaleString()}`,
        };
      }

      // Perform local debit atomically
      await WalletService.debitWallet(transaction, {
        userId: uid,
        amount: totalDeduction,
        currency: trfCurrency,
        reference: trfReference,
        type: "TRANSFER",
        description,
        recipientName: trfName,
        fee,
      });

      return {
        success: true,
      };
    });

    if (!transactionResult.success) {
      return NextResponse.json({ error: transactionResult.error }, { status: 400 });
    }

    // 5. Call Google Cloud Payment Gateway S2S Transfer API
    try {
      console.log(`[Transfer API] Executing real transfer via Payment Gateway: amount=${trfAmount} to ${trfName}`);

      const gatewayPayload = {
        amount: trfAmount,
        account_number: trfAccount,
        account_bank: trfBank,
        beneficiary_name: trfName,
        currency: trfCurrency,
        narration: description,
        reference: trfReference,
      };

      const gatewayRes = await fetch(`${gatewayUrl}/api/flutterwave/transfer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${idToken}`,
        },
        body: JSON.stringify(gatewayPayload),
      });

      const gatewayData = await gatewayRes.json();

      if (gatewayRes.ok && gatewayData.success) {
        logPaymentEvent({
          category: "Transfer",
          userId: uid,
          tx_ref: trfReference,
          amount: trfAmount,
          currency: trfCurrency,
          message: `Successfully processed real transfer via Gateway: ${description}`,
          processingTimeMs: Date.now() - startTime,
        });

        return NextResponse.json({
          success: true,
          reference: trfReference,
          provider_reference: gatewayData.provider_reference || gatewayData.data?.id,
          message: gatewayData.message || `Transfer initiated successfully!`,
        });
      } else {
        throw new Error(gatewayData.error || gatewayData.message || "Payment Gateway rejected the transfer.");
      }

    } catch (apiErr: unknown) {
      const err = apiErr as Error;
      console.error("[Transfer API] Gateway transfer failed. Rolling back local wallet debit:", err.message);

      // Rollback debit atomically inside transaction
      await adminDb.runTransaction(async (rollbackTx) => {
        const userDoc = await rollbackTx.get(userRef);
        if (userDoc.exists) {
          await WalletService.creditWallet(rollbackTx, {
            userId: uid,
            amount: totalDeduction,
            currency: trfCurrency,
            reference: `REFUND-${trfReference}`,
            description: `Refund for failed transfer: ${description}`,
            recipientName: trfName,
          });
        }
      });

      return NextResponse.json({
        error: `Failed to complete outward bank transfer: ${err.message}. Local wallet balance has been successfully refunded.`
      }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Transfer API Exception]:", error.message, error.stack);
    return NextResponse.json({ error: "Internal processing error occurred while executing transfer." }, { status: 500 });
  }
}
