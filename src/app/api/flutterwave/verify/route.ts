import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const authenticatedUser = await authenticateUserRequest(req);
    if (!authenticatedUser || !authenticatedUser.uid) {
      return NextResponse.json(
        { success: false, error: "Unauthorized: Invalid or missing authentication token." },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const transactionId = body.transactionId || body.transaction_id;
    const txRef = body.txRef || body.tx_ref;

    if (!transactionId && !txRef) {
      return NextResponse.json(
        { success: false, error: "Validation Error: transactionId or txRef is required." },
        { status: 400 }
      );
    }

    // Fast-path Firestore check: If the webhook has already credited the transaction in Firestore, return immediately!
    try {
      const candidateDocs: any[] = [];

      if (txRef) {
        const docId = txRef.startsWith("tx-FUNDING-") ? txRef : `tx-FUNDING-${txRef}`;
        const txDoc = await adminDb.collection("transactions").doc(docId).get();
        if (txDoc.exists) {
          candidateDocs.push(txDoc);
        }
      }

      if (candidateDocs.length === 0 && txRef) {
        const qSnap = await adminDb.collection("transactions")
          .where("reference", "==", String(txRef))
          .limit(1)
          .get();
        if (!qSnap.empty) {
          candidateDocs.push(qSnap.docs[0]);
        }
      }

      if (candidateDocs.length === 0 && transactionId) {
        const qSnap = await adminDb.collection("transactions")
          .where("flwId", "==", String(transactionId))
          .limit(1)
          .get();
        if (!qSnap.empty) {
          candidateDocs.push(qSnap.docs[0]);
        }
      }

      for (const docSnap of candidateDocs) {
        const txData = docSnap.data();
        if (txData?.userId) {
          if (txData.userId !== authenticatedUser.uid) {
            return NextResponse.json(
              { success: false, error: "Forbidden: You do not own this transaction." },
              { status: 403 }
            );
          }

          // Ownership is verified! Check if transaction is already credited/SUCCESS
          if (txData.status === "SUCCESS" || txData.credited === true) {
            const userDoc = await adminDb.collection("users").doc(authenticatedUser.uid).get();
            const currentBal = Number(userDoc.data()?.balance) || 0;
            const confirmedAmount = Number(txData.totalCredited || txData.amount || 0);

            console.log(`[Verify Route Fast-Path] Transaction ${docSnap.id} is already SUCCESS in Firestore. Returning immediate SUCCESS.`);
            return NextResponse.json({
              success: true,
              status: "SUCCESS",
              credited: true,
              alreadyCredited: true,
              fundedAmount: confirmedAmount,
              totalCredited: confirmedAmount,
              amount: confirmedAmount,
              newBalance: currentBal,
              message: "Payment verified and wallet credited successfully."
            });
          }
        }
      }
    } catch (err: any) {
      console.error(`[Verify Route Ownership Check Error]: ${err.message}`);
      return NextResponse.json(
        { success: false, error: "Failed to verify transaction ownership." },
        { status: 500 }
      );
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;
    if (!gatewayApiKey) {
      console.error("[Verify Route Error]: PAYMENT_GATEWAY_API_KEY is not configured on host server.");
      return NextResponse.json(
        { success: false, error: "Server Configuration Error: Payment Gateway API key missing." },
        { status: 500 }
      );
    }

    const gatewayResponse = await fetch(`${GATEWAY_URL}/api/flutterwave/verify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": gatewayApiKey,
        "Authorization": `Bearer ${gatewayApiKey}`
      },
      body: JSON.stringify({
        transaction_id: transactionId,
        tx_ref: txRef
      })
    });

    const data = await gatewayResponse.json().catch(() => ({
      success: false,
      error: "Invalid JSON response from gateway."
    }));

    return NextResponse.json(data, { status: gatewayResponse.status });
  } catch (error: any) {
    console.error("[Verify Route Exception]:", error);
    const status = error.message?.includes("Missing Firebase ID token") || error.message?.includes("Token has expired") || error.message?.includes("Invalid token") ? 401 : 500;
    return NextResponse.json(
      { success: false, error: error.message || "Internal verification proxy failure." },
      { status }
    );
  }
}
