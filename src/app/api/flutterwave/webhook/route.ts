import { NextResponse } from "next/server";

const GATEWAY_URL = process.env.PAYMENT_GATEWAY_URL || "http://127.0.0.1:3055";

export async function POST(req: Request) {
  const reqId = `wh-proxy-${Date.now()}-${Math.random().toString(36).slice(-4)}`;
  console.log(`[Webhook Proxy] [${reqId}] Received incoming Flutterwave webhook`);

  try {
    const signature = req.headers.get("verif-hash") || "";
    const contentType = req.headers.get("content-type") || "application/json";

    // Read raw body to preserve original formatting and signature integrity
    const rawBody = await req.text();
    console.log(`[Webhook Proxy] [${reqId}] Signature: "${signature}" | Body Length: ${rawBody.length}`);

    // Trim trailing slash to prevent double-slash (//) routing issues on certain Nginx configurations
    const cleanGatewayUrl = GATEWAY_URL.endsWith("/") ? GATEWAY_URL.slice(0, -1) : GATEWAY_URL;

    // Forward immediately S2S to payment-gateway backend
    const response = await fetch(`${cleanGatewayUrl}/api/flutterwave/webhook`, {
      method: "POST",
      headers: {
        "Content-Type": contentType,
        "verif-hash": signature,
      },
      body: rawBody,
    });

    const responseText = await response.text();
    console.log(`[Webhook Proxy] [${reqId}] Backend responded with status: ${response.status}`);

    // Return exact status and response back to Flutterwave
    return new NextResponse(responseText, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
      },
    });

  } catch (err: any) {
    console.error(`[Webhook Proxy Exception] [${reqId}] Failed to forward webhook:`, err.message);
    return NextResponse.json({
      success: false,
      message: "Webhook forwarding failed.",
      error: err.message,
    }, { status: 500 });
  }
}
