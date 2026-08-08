import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    // Mock playtesting response
    if (uid === "mock-admin-uid") {
      const mockPendingKyc = [
        {
          uid: "mock-kyc-1",
          name: "CHIDI OKEKE",
          email: "chidi@example.com",
          phoneNumber: "+2348033445566",
          kycType: "bvn",
          kycNumber: "22223333444",
          kycStatus: "PENDING",
          submittedAt: new Date().toISOString(),
          capturedSelfie: null,
        },
        {
          uid: "mock-kyc-2",
          name: "AMINA BELLO",
          email: "amina@example.com",
          phoneNumber: "+2348122334455",
          kycType: "nin",
          kycNumber: "55556666777",
          kycStatus: "PENDING",
          submittedAt: new Date().toISOString(),
          capturedSelfie: null,
        }
      ];
      return NextResponse.json({ success: true, pendingUsers: mockPendingKyc });
    }

    // Query pending KYC submissions directly from the secure `kyc_submissions` collection
    const pendingSnap = await adminDb.collection("kyc_submissions")
      .where("status", "==", "PENDING")
      .limit(50)
      .get();

    const pendingUsers = pendingSnap.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        name: `${data.firstName || ""} ${data.lastName || ""}`.trim() || "SUBMITTED USER",
        email: data.email || "",
        phoneNumber: data.phone || "",
        kycType: data.documentType || "bvn",
        kycNumber: data.documentNumber || "•••••••••••",
        kycStatus: "PENDING",
        submittedAt: data.submittedAt || new Date().toISOString(),
        capturedSelfie: data.capturedSelfie || null, // securely exposed Base64 image
        livenessChallenge: data.livenessChallenge || null
      };
    });

    return NextResponse.json({ success: true, pendingUsers });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin KYC GET API] Error:", error.message);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const { action, targetUid, reason } = await req.json();

    if (!targetUid) {
      return NextResponse.json({ error: "Missing target user identifier." }, { status: 400 });
    }

    if (uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        message: `Mock User KYC state marked as ${action === "approve" ? "APPROVED" : "REJECTED"} successfully!`
      });
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    if (action === "approve") {
      // Forward approval request to payment-gateway secure S2S endpoint
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey
        },
        body: JSON.stringify({
          targetUid,
          adminId: uid
        })
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to approve KYC in gateway." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: "User KYC successfully approved and static virtual account provisioned!"
      });

    } else if (action === "reject") {
      // Forward rejection request to payment-gateway secure S2S endpoint
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey
        },
        body: JSON.stringify({
          targetUid,
          adminId: uid,
          reason
        })
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to reject KYC in gateway." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: "User KYC rejected and notification dispatched successfully."
      });

    } else {
      return NextResponse.json({ error: "Invalid KYC action request." }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin KYC POST API] Error:", error.message);
    return NextResponse.json({ error: "Operation failed", details: error.message }, { status: 500 });
  }
}
