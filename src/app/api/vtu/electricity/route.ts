import { NextResponse } from "next/server";
import { authenticateUserRequest, verifyUserKycApproved } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";

function sanitizeBillErrorMessage(rawMessage: string, defaultType: string = "electricity"): string {
  const msg = String(rawMessage || "").toLowerCase();

  if (
    msg.includes("insufficient_balance") ||
    msg.includes("insufficient balance") ||
    msg.includes("clubkonnect") ||
    msg.includes("flutterwave") ||
    msg.includes("rejected request") ||
    msg.includes("provider") ||
    msg.includes("gateway")
  ) {
    return `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} payment network issue. Please try again later.`;
  }

  return rawMessage || `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} payment network issue. Please try again later.`;
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    const isApproved = await verifyUserKycApproved(uid);
    if (!isApproved) {
      return NextResponse.json({ error: "Forbidden: Account verification is required to perform financial transactions." }, { status: 403 });
    }

    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "mock-token";

    const body = await req.json();

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY || "default_gateway_secure_key_12345";

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/electricity`, {
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
        const rawErr = errJson.message || errJson.error || errJson.details || "Electricity payment failed";
        return NextResponse.json({ ...errJson, message: sanitizeBillErrorMessage(rawErr, "electricity"), error: sanitizeBillErrorMessage(rawErr, "electricity") }, { status: gatewayRes.status });
      } catch {
        return NextResponse.json({ error: sanitizeBillErrorMessage(errText, "electricity") }, { status: gatewayRes.status });
      }
    }

    const data = await safeParseJson(gatewayRes);
    if (data && data.success === false) {
      const rawMsg = data.message || data.error || "Electricity payment failed";
      data.message = sanitizeBillErrorMessage(rawMsg, "electricity");
      data.error = sanitizeBillErrorMessage(rawMsg, "electricity");
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Electricity Route Error]:", error.message);
    return NextResponse.json({ error: sanitizeBillErrorMessage(error.message, "electricity") }, { status: 500 });
  }
}
