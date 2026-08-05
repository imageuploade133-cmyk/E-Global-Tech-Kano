import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization") || "";
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const response = await fetch(`${GATEWAY_URL}/api/admin/reconciliation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": authHeader,
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
