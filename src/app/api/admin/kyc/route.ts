import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function GET(req: Request) {
  try {
    const { isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "mock-admin-token";

    // Forward the GET request directly to Payment Gateway to retrieve real PENDING KYC list
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";
    const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/pending`, {
      method: "GET",
      headers: {
        "x-api-key": gatewayApiKey,
        "Authorization": `Bearer ${idToken}`
      }
    });

    const result = await response.json();
    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Failed to query kyc queue from gateway." }, { status: response.status });
    }

    return NextResponse.json({ success: true, pendingUsers: result.pendingUsers });
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

    const { action, targetUid, reason, provider } = await req.json();

    if (!targetUid) {
      return NextResponse.json({ error: "Missing target user identifier." }, { status: 400 });
    }

    if (uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        message: `Mock User KYC state marked as ${action === "approve" ? "APPROVED" : "REJECTED"} successfully!`
      });
    }

    const authHeader = req.headers.get("Authorization") || "";
    const idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    if (action === "verify") {
      // Forward verify request to payment-gateway secure human-only endpoint with strict Bearer Authorization header
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/${targetUid}/verify`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey,
          "Authorization": `Bearer ${idToken}`
        }
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to execute identity verification in gateway." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: "User identity verification completed successfully."
      });

    } else if (action === "approve") {
      if (!provider || (provider !== "flutterwave" && provider !== "squad")) {
        return NextResponse.json({ error: "A valid provider ('flutterwave' or 'squad') must be explicitly selected." }, { status: 400 });
      }

      // Forward approval request to payment-gateway secure human-only endpoint with strict Bearer Authorization header and explicit provider in body
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/${targetUid}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey,
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ provider })
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to approve KYC in gateway." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: `User KYC successfully approved and static virtual account provisioned via ${provider}!`
      });

    } else if (action === "reject") {
      // Forward rejection request to payment-gateway secure human-only endpoint with strict Bearer Authorization header
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/${targetUid}/reject`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey,
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ reason })
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to reject KYC in gateway." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: "User KYC rejected and notification dispatched successfully."
      });

    } else if (action === "retry") {
      if (!provider || (provider !== "flutterwave" && provider !== "squad")) {
        return NextResponse.json({ error: "A valid provider ('flutterwave' or 'squad') must be explicitly selected for retry." }, { status: 400 });
      }

      // Forward retry provisioning request to payment-gateway
      const response = await fetch(`${GATEWAY_URL}/api/admin/kyc/${targetUid}/retry-provisioning`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": gatewayApiKey,
          "Authorization": `Bearer ${idToken}`
        },
        body: JSON.stringify({ provider })
      });

      const result = await response.json();
      if (!response.ok) {
        return NextResponse.json({ error: result.message || "Failed to retry virtual account provisioning." }, { status: response.status });
      }

      return NextResponse.json({
        success: true,
        message: `Virtual account successfully provisioned on retry via ${provider}!`
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
