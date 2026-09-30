import { NextResponse } from "next/server";
import { authenticateUserRequest, verifyUserKycApproved } from "@/lib/auth-util";
import { safeParseJson } from "@/lib/utils";

function sanitizeBillErrorMessage(rawMessage: string, defaultType: string = "airtime"): string {
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
    return `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} purchase network issue. Please try again later.`;
  }

  return rawMessage || `${defaultType.charAt(0).toUpperCase() + defaultType.slice(1)} purchase network issue. Please try again later.`;
}

export async function POST(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    const uid = authResult.uid;

    const isApproved = await verifyUserKycApproved(uid);
    if (!isApproved) {
      return NextResponse.json({ error: "Forbidden: Account verification is required to perform financial transactions." }, { status: 403 });
    }

    const idToken = req.headers.get("Authorization")?.split("Bearer ")[1] || "";
    const sessionId = req.headers.get("X-Session-ID") || req.headers.get("x-session-id") || "";

    const body = await req.json();

    const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";
    const apiKey = process.env.PAYMENT_GATEWAY_API_KEY || process.env.GATEWAY_API_KEY;

    const gatewayRes = await fetch(`${gatewayUrl}/api/vtu/airtime`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`,
        "x-api-key": apiKey,
        ...(sessionId ? { "X-Session-ID": sessionId } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!gatewayRes.ok) {
      const errText = await gatewayRes.text();
      try {
        const errJson = JSON.parse(errText);
        const rawErr = errJson.message || errJson.error || errJson.details || "Airtime purchase failed";
        return NextResponse.json({ ...errJson, message: sanitizeBillErrorMessage(rawErr, "airtime"), error: sanitizeBillErrorMessage(rawErr, "airtime") }, { status: gatewayRes.status });
      } catch {
        return NextResponse.json({ error: sanitizeBillErrorMessage(errText, "airtime") }, { status: gatewayRes.status });
      }
    }

    const data = await safeParseJson(gatewayRes);
    if (data && data.success === false) {
      const rawMsg = data.message || data.error || "Airtime purchase failed";
      data.message = sanitizeBillErrorMessage(rawMsg, "airtime");
      data.error = sanitizeBillErrorMessage(rawMsg, "airtime");
    }
    return NextResponse.json(data);
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Airtime Route Error]:", error.message);
    return NextResponse.json({ error: sanitizeBillErrorMessage(error.message, "airtime") }, { status: 500 });
  }
}
