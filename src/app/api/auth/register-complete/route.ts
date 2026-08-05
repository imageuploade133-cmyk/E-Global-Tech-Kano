import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

export async function POST(req: Request) {
  let uid = "";
  let idToken = "";

  const authHeader = req.headers.get("Authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    idToken = authHeader.split("Bearer ")[1];
  }

  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  try {
    const body = await req.json();
    const gatewayApiKey = process.env.PAYMENT_GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    // Include uid and authenticate request to payment-gateway using Bearer and API keys
    const response = await fetch(`${GATEWAY_URL}/api/auth/register-complete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": gatewayApiKey,
        "Authorization": idToken ? `Bearer ${idToken}` : "",
      },
      body: JSON.stringify({
        uid,
        ...body,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: result.message || "Failed to finalize registration." }, { status: response.status });
    }

    return NextResponse.json({
      success: true,
      message: result.message || "Registration finalized successfully."
    });

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Register Complete Proxy] Error:", error);
    return NextResponse.json({ error: error.message || "An error occurred writing user registration data." }, { status: 500 });
  }
}
