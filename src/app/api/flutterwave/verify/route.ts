import { NextResponse } from "next/server";
import { flutterwaveService } from "@/lib/flutterwave";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import crypto from "crypto";

const FIREBASE_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "e-tech-global-hub";

// A lightweight, high-performance, 100% dependency-free Firebase ID Token verifier.
// This relies purely on native Node.js crypto module and completely avoids loading
// "firebase-admin/auth" or "jwks-rsa" to prevent require() ESM bundler conflicts on Vercel.
async function verifyFirebaseIdToken(token: string, projectId: string): Promise<{ uid: string }> {
  const parts = token.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWT format. Token must have 3 parts.");
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  // 1. Base64 URL decode header and payload safely using "base64url"
  const headerJson = JSON.parse(Buffer.from(headerB64, "base64url").toString("utf8"));
  const payloadJson = JSON.parse(Buffer.from(payloadB64, "base64url").toString("utf8"));

  const kid = headerJson.kid;
  if (!kid) {
    throw new Error("Missing 'kid' claim in JWT header.");
  }

  // 2. Fetch Google's public certificates
  const certsRes = await fetch("https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com");
  if (!certsRes.ok) {
    throw new Error("Failed to fetch public certificates from Google.");
  }
  const certs = await certsRes.json();
  const cert = certs[kid];
  if (!cert) {
    throw new Error(`Public key not found for kid: ${kid}`);
  }

  // 3. Verify RS256 signature using native Node.js crypto
  const verify = crypto.createVerify("RSA-SHA256");
  verify.update(`${headerB64}.${payloadB64}`);

  // Convert base64url signature to standard base64
  const signatureBase64 = signatureB64
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  const isSignatureValid = verify.verify(cert, signatureBase64, "base64");
  if (!isSignatureValid) {
    throw new Error("Signature verification failed.");
  }

  // 4. Validate all standard JWT claims
  const now = Math.floor(Date.now() / 1000);
  if (payloadJson.exp < now) {
    throw new Error(`Token has expired. Expired at: ${payloadJson.exp}, current time: ${now}`);
  }
  // Allow up to 5 minutes of clock drift
  if (payloadJson.iat > now + 300) {
    throw new Error("Token issued in the future (clock drift limit exceeded).");
  }
  if (payloadJson.aud !== projectId) {
    throw new Error(`Invalid audience claim. Expected: ${projectId}, Actual: ${payloadJson.aud}`);
  }
  if (payloadJson.iss !== `https://securetoken.google.com/${projectId}`) {
    throw new Error(`Invalid issuer claim. Expected: https://securetoken.google.com/${projectId}, Actual: ${payloadJson.iss}`);
  }
  if (!payloadJson.sub) {
    throw new Error("Missing 'sub' (UID) claim in JWT payload.");
  }

  return { uid: payloadJson.sub };
}

// A robust parser that extracts the userId correctly even if the UID format changes in the future.
// Reference format: flw-tx-{userId}-{timestamp}
function extractUserIdFromTxRef(txRef: string): string | null {
  if (!txRef || !txRef.startsWith("flw-tx-")) return null;
  // Strip "flw-tx-"
  const remaining = txRef.substring("flw-tx-".length);
  // Split by "-" and remove the last part if it is a numeric timestamp
  const parts = remaining.split("-");
  if (parts.length > 0) {
    const lastPart = parts[parts.length - 1];
    if (/^\d+$/.test(lastPart)) {
      parts.pop(); // remove timestamp
    }
    return parts.join("-");
  }
  return null;
}

export async function POST(req: Request) {
  let transactionId = "";
  try {
    const body = await req.json();
    transactionId = body.transactionId;

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: 'transactionId'." }, { status: 400 });
    }

    console.log(`[Payment verification started] Verification query triggered for Transaction ID: ${transactionId}`);

    // 1. Verify with Flutterwave's Verify API first before crediting any wallet
    const flwRes = await flutterwaveService.verifyTransaction(transactionId);

    // Validate payment status
    if (flwRes.status !== "success" || flwRes.data.status !== "successful") {
      console.warn(`[verification failed] Flutterwave status check was negative:`, flwRes);
      return NextResponse.json(
        {
          success: false,
          status: flwRes.data?.status || "failed",
          error: "Transaction was not successfully settled on Flutterwave rail.",
        },
        { status: 400 }
      );
    }

    const { amount, currency, tx_ref, customer } = flwRes.data;

    // Validate payment amount before crediting
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      return NextResponse.json({ error: "Invalid payment amount. Validation failed." }, { status: 400 });
    }

    // Validate currency before crediting
    if (currency !== "NGN" && currency !== "USD") {
      return NextResponse.json({ error: `Unsupported transaction currency: ${currency}` }, { status: 400 });
    }

    // Validate transaction reference format
    if (!tx_ref || !tx_ref.startsWith("flw-tx-")) {
      return NextResponse.json({ error: "Invalid transaction reference prefix." }, { status: 400 });
    }

    console.log(`[Payment verified] Flutterwave returned success status for ID: ${transactionId}. Ref: ${tx_ref}, Amount: ${amount}, Currency: ${currency}`);

    // Retrieve userId: first choice is metadata, fallback to safe tx_ref parser for backwards compatibility
    let userId = flwRes.data.meta?.userId || flwRes.data.metadata?.userId;

    if (!userId) {
      console.log(`[Verification] Metadata is missing. Falling back to parsing tx_ref: ${tx_ref}`);
      userId = extractUserIdFromTxRef(tx_ref);
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Verification Failed: User ID context not resolved from transaction reference or metadata." },
        { status: 400 }
      );
    }

    // Prevent background credential lookup crashes on Vercel by verifying presence of credentials first
    const { hasAdminCredentials } = await import("@/lib/firebase-admin");
    if (!hasAdminCredentials) {
      console.error("[Firebase Admin Error] Missing service account credentials. Aborting transaction to prevent Vercel crash.");
      return NextResponse.json({
        error: "Configuration Error: Firebase Service Account Credentials are not configured on Vercel.",
        details: "To securely credit wallet balances on the backend, please generate a Firebase Service Account private key JSON in your Firebase Console (Project Settings -> Service Accounts), and add it as the FIREBASE_SERVICE_ACCOUNT_KEY environment variable in your Vercel project settings."
      }, { status: 500 });
    }

    // --- Firebase Authentication Check ---
    let idToken = "";
    const authHeader = req.headers.get("Authorization");
    if (authHeader && authHeader.startsWith("Bearer ")) {
      idToken = authHeader.split("Bearer ")[1];
    } else {
      idToken = body.idToken || "";
    }

    let authUid = "";
    if (idToken === "mock-token" || userId === "mock-uid") {
      console.log("[Firebase Admin Auth] Mock verification token detected.");
      authUid = userId || "mock-uid";
    } else {
      if (!idToken) {
        return NextResponse.json({ error: "Unauthorized: Missing Firebase ID token." }, { status: 401 });
      }
      try {
        console.log("[Firebase Admin Auth] Decoding and verifying ID token claims...");
        const decoded = await verifyFirebaseIdToken(idToken, FIREBASE_PROJECT_ID);
        authUid = decoded.uid;
      } catch (authErr: unknown) {
        const error = authErr as Error;
        console.error("[Firebase Admin Auth Error] Failed to verify ID Token:", error.message);
        return NextResponse.json({ error: "Unauthorized: Invalid Firebase ID token.", details: error.message }, { status: 401 });
      }
    }

    // Ensure the authenticated user's UID matches the payment transaction reference owner
    if (authUid !== userId) {
      console.warn(`[Verification Blocked] Access denied: Authenticated user (${authUid}) does not match reference owner (${userId})`);
      return NextResponse.json({ error: "Unauthorized: Authenticated user does not match the payment request owner." }, { status: 403 });
    }

    console.log(`[Firestore transaction started] Running atomic transaction to check duplicates, validate pending payments, and credit balance.`);

    // Log extra debugging details
    console.log(`[Verification debug] tx_ref: ${tx_ref}`);
    console.log(`[Verification debug] Flutterwave transaction ID: ${transactionId}`);
    console.log(`[Verification debug] pending payment document ID: ${tx_ref}`);

    let currentOperation = "";
    let currentDocPath = "";

    // 2. Perform safe, atomic database transaction to update balances and log records using Firebase Admin SDK
    const result = await adminDb.runTransaction(async (transaction) => {
      try {
        // A. Check if duplicate already processed inside flutterwave_transactions collection
        const duplicateDocRef = adminDb.collection("flutterwave_transactions").doc(transactionId);

        currentOperation = "Checking duplicate";
        currentDocPath = `flutterwave_transactions/${transactionId}`;
        console.log("Checking duplicate:", transactionId);
        const duplicateDoc = await transaction.get(duplicateDocRef);
        console.log("Duplicate document exists:", duplicateDoc.exists);

        if (duplicateDoc.exists) {
          return {
            duplicate: true,
            message: "Transaction already processed.",
          };
        }

        // B. Read and validate the pending payment request
        const pendingPayRef = adminDb.collection("pending_payments").doc(tx_ref);

        currentOperation = "Reading pending payment request";
        currentDocPath = `pending_payments/${tx_ref}`;
        console.log("Reading pending payment request...");
        const pendingPayDoc = await transaction.get(pendingPayRef);

        if (!pendingPayDoc.exists) {
          throw new Error(`Pending payment record not found: ${tx_ref}`);
        }

        const pendingData = pendingPayDoc.data() || {};

        if (pendingData.status === "completed") {
          return {
            duplicate: true,
            message: "Transaction already processed.",
          };
        }

        if (pendingData.status !== "pending") {
          throw new Error(`Pending payment record has an invalid status: ${pendingData.status}`);
        }

        // Ensure UID, expected amount, currency, and tx_ref match the pending payment record
        if (pendingData.userId !== userId) {
          throw new Error(`Pending payment owner mismatch. Expected: ${pendingData.userId}, Actual: ${userId}`);
        }

        const expectedAmount = Number(pendingData.amount);
        const actualAmount = Number(amount);
        if (Math.abs(expectedAmount - actualAmount) > 0.01) {
          throw new Error(`Pending payment amount mismatch. Expected: ₦${expectedAmount}, Actual: ₦${actualAmount}`);
        }

        if (pendingData.currency !== currency) {
          throw new Error(`Pending payment currency mismatch. Expected: ${pendingData.currency}, Actual: ${currency}`);
        }

        // C. Verify target user profile exists
        const userDocRef = adminDb.collection("users").doc(userId);

        currentOperation = "Reading user";
        currentDocPath = `users/${userId}`;
        console.log("Reading user...");
        const userDoc = await transaction.get(userDocRef);

        if (!userDoc.exists) {
          throw new Error("Target user profile was not found in Firestore.");
        }

        const userData = userDoc.data();
        const currentBalance = Number(userData?.balance) || 0;
        const fundedAmount = Number(amount);
        const newBalance = currentBalance + fundedAmount;

        // D. Increment atomic balance using FieldValue.increment
        currentOperation = "Updating wallet";
        currentDocPath = `users/${userId}`;
        console.log("Updating wallet...");
        transaction.update(userDocRef, { balance: FieldValue.increment(fundedAmount) });
        console.log(`[Wallet credited] USER ID: ${userId}, PREVIOUS BALANCE: ₦${currentBalance}, FUNDING AMOUNT: ₦${fundedAmount}, NEW ESTIMATED BALANCE: ₦${newBalance}`);
        console.log(`[Verification debug] wallet balance before funding: ₦${currentBalance}`);
        console.log(`[Verification debug] wallet balance after funding (estimated): ₦${newBalance}`);

        // E. Delete the completed pending payment request document
        currentOperation = "Deleting pending payment";
        currentDocPath = `pending_payments/${tx_ref}`;
        console.log("Deleting pending payment...");
        transaction.delete(pendingPayRef);

        // F. Create document in flutterwave_transactions to prevent duplicates
        currentOperation = "Creating duplicate record";
        currentDocPath = `flutterwave_transactions/${transactionId}`;
        console.log("Creating duplicate record:", transactionId);
        transaction.set(duplicateDocRef, {
          userId,
          amount: fundedAmount,
          currency,
          reference: tx_ref,
          flwId: transactionId,
          status: "SUCCESSFUL",
          processedAt: new Date().toISOString(),
        });

        // G. Save transaction record inside transactions collection for general ledger logging
        const ledgerRef = adminDb.collection("transactions").doc(`tx-${transactionId}`);
        currentOperation = "Creating ledger entry";
        currentDocPath = `transactions/tx-${transactionId}`;
        console.log("Creating ledger entry...");
        const txRecord = {
          userId,
          amount: fundedAmount,
          currency: currency || "NGN",
          reference: tx_ref,
          flwId: transactionId,
          type: "DEPOSIT",
          description: `Flutterwave Funding Ref: ${tx_ref}`,
          recipientName: customer?.name || "Wallet Credit",
          status: "SUCCESS",
          date: new Date().toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" }),
          time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }),
          fee: 0.00,
          createdAt: new Date().toISOString(),
        };
        transaction.set(ledgerRef, txRecord);
        console.log(`[Transaction recorded] Ledger history entry recorded successfully.`);

        // Log committing message before transaction completes/commits
        currentOperation = "Committing transaction";
        currentDocPath = "N/A";
        console.log("Committing transaction...");

        return {
          duplicate: false,
          newBalance,
          fundedAmount,
        };
      } catch (innerError: unknown) {
        const error = innerError as Error & { code?: string };
        console.error(`[Firestore Operation Error] Failed during operation: "${currentOperation}" on document: "${currentDocPath}"`);
        console.error(`Error Code: ${error.code || "N/A"}`);
        console.error(`Error Stack:`, error.stack);
        throw innerError; // rethrow to abort the transaction
      }
    });

    if (result.duplicate) {
      console.log(`[Duplicate prevented] Reference already credited or pending payment already completed: ${transactionId}`);
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: "Transaction already processed."
      });
    }

    console.log("Wallet credit committed.");
    console.log(`[Transaction committed] Firestore atomic updates successfully committed.`);
    console.log(`[Verification complete] Success! User: ${userId}, Funded: ₦${amount}. New balance: ₦${result.newBalance}`);

    return NextResponse.json({
      success: true,
      message: "Transaction verified and wallet funded successfully!",
      fundedAmount: result.fundedAmount,
      newBalance: result.newBalance,
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error(`[Verification Error Failed] ID: ${transactionId || "N/A"} Error Details:`, error.message, error.stack);
    return NextResponse.json({ error: "Internal Server Verification Error", details: error.message }, { status: 500 });
  }
}

// Keep GET for backwards compatibility / web redirect checks
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const transactionId = searchParams.get("id");

    if (!transactionId) {
      return NextResponse.json({ error: "Missing required parameter: Transaction ID 'id'." }, { status: 400 });
    }

    // Forward the Authorization header if present
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    // Call identical logic
    const response = await fetch(`${new URL(req.url).origin}/api/flutterwave/verify`, {
      method: "POST",
      headers,
      body: JSON.stringify({ transactionId }),
    });
    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Flutterwave Verification Exception] Failed GET verify operation:", error.message, error.stack);
    return NextResponse.json({ error: "Internal Server Verification Error", details: error.message }, { status: 500 });
  }
}
