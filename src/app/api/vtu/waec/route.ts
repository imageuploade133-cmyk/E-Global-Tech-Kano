import { NextResponse } from "next/server";
import { authenticateUserRequest, verifyUserKycApproved } from "@/lib/auth-util";

export async function POST(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    const isApproved = await verifyUserKycApproved(uid);
    if (!isApproved) {
      return NextResponse.json({ error: "Forbidden: Account verification is required to perform financial transactions." }, { status: 403 });
    }

    // Mock-playtesting offline bypass
    if (uid === "mock-uid" || uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        message: "WAEC Pin Purchase Successful (Mock Mode)",
        pins: [
          { pin: "554488223311", serial: "WR20269988" }
        ],
        reference: "mock-waec-ref-998877",
      });
    }

    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const body = await req.json();

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/waec`, {
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
        return NextResponse.json({ error: "Failed to process WAEC pin purchase", details: errText }, { status: gatewayRes.status });
      }
    }

    const data = await gatewayRes.json();
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[WAEC Purchase Route Error]:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
