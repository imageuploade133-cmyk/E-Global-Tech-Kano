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

    // Fail-closed ownership verification: check Firestore transaction ledger for matching UID
    try {
      let isOwnerVerified = false;

      if (txRef) {
        const docId = txRef.startsWith("tx-FUNDING-") ? txRef : `tx-FUNDING-${txRef}`;
        const txDoc = await adminDb.collection("transactions").doc(docId).get();
        if (txDoc.exists) {
          const txData = txDoc.data();
          if (txData?.userId && txData.userId !== authenticatedUser.uid) {
            return NextResponse.json(
              { success: false, error: "Forbidden: You do not own this transaction." },
              { status: 403 }
            );
          }
          if (txData?.userId === authenticatedUser.uid) {
            isOwnerVerified = true;
          }
        }
      }

      if (!isOwnerVerified && transactionId) {
        const querySnap = await adminDb.collection("transactions")
          .where("flwId", "==", String(transactionId))
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const txData = querySnap.docs[0].data();
          if (txData?.userId && txData.userId !== authenticatedUser.uid) {
            return NextResponse.json(
              { success: false, error: "Forbidden: You do not own this transaction." },
              { status: 403 }
            );
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
