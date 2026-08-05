import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    await authenticateUserRequest(req);
    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || "";
    const smartCardNo = searchParams.get("smartCardNo") || "";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/cable/validate?provider=${provider}&smartCardNo=${smartCardNo}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      return NextResponse.json({ error: "Failed to validate Smartcard/IUC number", details: errText }, { status: gatewayRes.status });
    }

    const data = await safeParseJson(gatewayRes);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Cable Validate Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
