import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function GET(req: Request) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";
  const { searchParams } = new URL(req.url);
  searchParams.set("userId", uid);

  const targetUrl = `${gatewayUrl}/api/wallets?${searchParams.toString()}`;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const response = await fetch(targetUrl, {
      method: "GET",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Connection failed: ${error.message}` }, { status: 502 });
  }
}
