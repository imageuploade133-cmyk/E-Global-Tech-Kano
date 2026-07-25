import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function POST(req: Request) {
  try {
    await authenticateUserRequest(req);
    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const body = await req.json();

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";
    const apiKey = process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/cable`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      try {
        const errJson = JSON.parse(errText);
        return NextResponse.json(errJson, { status: gatewayRes.status });
      } catch {
        return NextResponse.json({ error: "Failed to process Cable TV subscription payment", details: errText }, { status: gatewayRes.status });
      }
    }

    const data = await gatewayRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Cable Purchase Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
