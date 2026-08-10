import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function GET(req: Request) {
  try {
    console.log("WAEC PRODUCTS HEADERS:", Object.fromEntries(req.headers.entries()));
    const authResult = await authenticateUserRequest(req);
    if (authResult.uid === "mock-uid") {
      return NextResponse.json({
        success: true,
        data: [
          { item_code: "waec_result_checker", name: "WAEC Result Checker PIN", amount: 3800, product_code: "waec_checker" },
          { item_code: "waec_registration", name: "WAEC Registration PIN", amount: 18500, product_code: "waec_reg" }
        ]
      });
    }

    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/waec/products`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      return NextResponse.json({ error: "Failed to fetch WAEC products", details: errText }, { status: gatewayRes.status });
    }

    const data = await gatewayRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WAEC Products Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
