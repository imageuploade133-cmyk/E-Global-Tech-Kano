import { NextResponse } from "next/server";
import { verifyAdminAuth, mintFirebaseIdToken } from "@/lib/admin-auth";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    // Try to get token from header, otherwise programmatically mint a fresh one
    const authHeader = req.headers.get("Authorization") || "";
    let idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";

    if (!idToken && uid) {
      idToken = await mintFirebaseIdToken(uid);
    }

    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const response = await fetch(`${GATEWAY_URL}/api/admin/reconciliation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": gatewayApiKey,
      },
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Reconciliation tool failed" }, { status: response.status });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Reconciliation Exception] Tool execution crashed:", error.message);
    return NextResponse.json({ error: "Reconciliation tool failed", details: error.message }, { status: 500 });
  }
}
