import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";

export async function GET(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const { searchParams } = new URL(req.url);
    const provider = searchParams.get("provider") || "";

    if (authResult.uid === "mock-uid") {
      const mockPackages: Record<string, any[]> = {
        "dstv": [
          { item_code: "dstv_padi", name: "DStv Padi", amount: 2500, package_code: "dstv-padi" },
          { item_code: "dstv_yanga", name: "DStv Yanga", amount: 3500, package_code: "dstv-yanga" },
          { item_code: "dstv_compact", name: "DStv Compact", amount: 10500, package_code: "dstv-compact" }
        ],
        "gotv": [
          { item_code: "gotv_smallie", name: "GOtv Smallie", amount: 1100, package_code: "gotv-smallie" },
          { item_code: "gotv_max", name: "GOtv Max", amount: 4850, package_code: "gotv-max" }
        ],
        "startimes": [
          { item_code: "startimes_basic", name: "StarTimes Basic", amount: 2600, package_code: "basic" }
        ]
      };
      return NextResponse.json({
        success: true,
        data: mockPackages[provider.toLowerCase()] || [],
      });
    }

    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";
    const apiKey = process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/cable/packages?provider=${provider}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
      },
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      return NextResponse.json({ error: "Failed to fetch Cable TV packages", details: errText }, { status: gatewayRes.status });
    }

    const data = await safeParseJson(gatewayRes);
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Cable Packages Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
