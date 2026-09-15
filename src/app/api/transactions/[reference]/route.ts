import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(
  req: Request,
  context: { params: Promise<{ reference: string }> }
) {
  try {
    const { reference } = await context.params;
    if (!reference || typeof reference !== "string") {
      return NextResponse.json(
        { error: "Transaction reference is required." },
        { status: 400 }
      );
    }

    // 1. Mandatory Server-Side Authentication
    let uid = "";
    try {
      const authResult = await authenticateUserRequest(req);
      uid = authResult.uid;
    } catch (authErr: any) {
      console.error("[Transactions Route] Authentication failed:", authErr.message);
      return NextResponse.json(
        { error: "Unauthorized: Invalid or missing token." },
        { status: 401 }
      );
    }

    if (!adminDb) {
      return NextResponse.json(
        { error: "Database service unavailable." },
        { status: 500 }
      );
    }

    const cleanRef = reference.trim();

    // 2. Fetch target transaction document from Firestore
    let docData: any = null;
    let docId = "";

    // Try direct document ID lookup
    const directDoc = await adminDb.collection("transactions").doc(cleanRef).get();
    if (directDoc.exists) {
      docData = directDoc.data();
      docId = directDoc.id;
    } else {
      // Try doc ID with 'tx-' prefix
      const txPrefixedDoc = await adminDb.collection("transactions").doc(`tx-${cleanRef}`).get();
      if (txPrefixedDoc.exists) {
        docData = txPrefixedDoc.data();
        docId = txPrefixedDoc.id;
      } else {
        // Query by reference field
        const querySnap = await adminDb
          .collection("transactions")
          .where("reference", "==", cleanRef)
          .limit(1)
          .get();

        if (!querySnap.empty) {
          const matchedDoc = querySnap.docs[0];
          docData = matchedDoc.data();
          docId = matchedDoc.id;
        }
      }
    }

    if (!docData) {
      return NextResponse.json(
        { error: "Transaction not found." },
        { status: 404 }
      );
    }

    // 3. MANDATORY SERVER-SIDE AUTHORIZATION CHECK
    // Verify that the currently authenticated user is authorized to access this transaction
    let isAuthorized = false;

    // Direct owner check
    if (docData.userId && docData.userId === uid) {
      isAuthorized = true;
    }

    // Recipient user check
    if (!isAuthorized && docData.recipientUserId && docData.recipientUserId === uid) {
      isAuthorized = true;
    }

    // Metadata sender / recipient checks
    const meta = docData.metadata || {};
    if (!isAuthorized && (meta.recipientUserId === uid || meta.senderUserId === uid || meta.userId === uid)) {
      isAuthorized = true;
    }

    // Secondary phone number or account check against user profile
    if (!isAuthorized) {
      try {
        const userDoc = await adminDb.collection("users").doc(uid).get();
        if (userDoc.exists) {
          const uData = userDoc.data() || {};
          const userPhone = (uData.phoneNumber || uData.phone || "").replace(/\D/g, "");
          const txPhone = (docData.phoneNumber || docData.customerId || "").replace(/\D/g, "");
          if (userPhone && txPhone && userPhone.length >= 7 && txPhone.length >= 7 && userPhone.slice(-10) === txPhone.slice(-10)) {
            isAuthorized = true;
          }
        }
      } catch (uErr) {
        console.warn("[Transactions Route] Failed to check user profile secondary authorization:", uErr);
      }
    }

    if (!isAuthorized) {
      console.warn(`[Transactions Authorization Denied] User uid=${uid} attempted to access transaction ${cleanRef} belonging to userId=${docData.userId}`);
      return NextResponse.json(
        { error: "You are not authorized to view this transaction." },
        { status: 403 }
      );
    }

    // 4. Return canonical authorized transaction record
    const formattedTransaction = {
      ...docData,
      id: docId,
      reference: docData.reference || cleanRef,
      type: docData.type || "DEPOSIT",
      amount: Number(docData.amount) || 0,
      currency: docData.currency || "NGN",
      description: docData.description || "",
      recipientName: docData.recipientName || "",
      bankName: docData.bankName || "",
      status: docData.status || "PENDING",
      date: docData.date || "",
      time: docData.time || "",
      fee: Number(docData.fee) || 0,
      vat: Number(docData.vat) || 0,
      markup: Number(docData.markup) || 0,
      totalDebited: docData.totalDebited !== undefined && docData.totalDebited !== null ? Number(docData.totalDebited) : undefined,
      totalCredited: docData.totalCredited !== undefined && docData.totalCredited !== null ? Number(docData.totalCredited) : undefined,
    };

    return NextResponse.json({
      success: true,
      transaction: formattedTransaction,
    });
  } catch (err: any) {
    console.error("[Transactions Route Exception]:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch transaction details." },
      { status: 500 }
    );
  }
}
