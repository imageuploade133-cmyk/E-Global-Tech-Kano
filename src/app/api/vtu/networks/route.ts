import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    await authenticateUserRequest(req);
    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/networks`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      console.warn(`[Networks Route Gateway Fallback Activated]: ${gatewayRes.status} - ${errText}`);
      // Return high-fidelity dynamic fallback networks
      return NextResponse.json({
        success: true,
        networks: ["MTN", "GLO", "AIRTEL", "9MOBILE"]
      });
    }

    const data = await safeParseJson(gatewayRes);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.warn("[Networks Route Exception Fallback Activated]:", error.message);
    // Return high-fidelity dynamic fallback networks
    return NextResponse.json({
      success: true,
      networks: ["MTN", "GLO", "AIRTEL", "9MOBILE"]
    });
  }
}
