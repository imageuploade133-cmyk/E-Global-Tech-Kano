import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function GET(req: Request) {
  try {
    await authenticateUserRequest(req);
    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";
    const apiKey = process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/networks`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      return NextResponse.json({ error: "Failed to fetch networks", details: errText }, { status: gatewayRes.status });
    }

    const data = await gatewayRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Networks Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
