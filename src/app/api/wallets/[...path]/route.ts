import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";

export async function GET(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

  const { searchParams } = new URL(req.url);
  searchParams.set("userId", uid); // Ensure the request is pinned to the authenticated user

  const targetUrl = `${gatewayUrl}/api/wallets/${pathStr}?${searchParams.toString()}`;

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

export async function POST(req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  let uid = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized: Invalid or missing authorization token." }, { status: 401 });
  }

  const { path } = await params;
  const pathStr = path.join("/");
  const gatewayUrl = process.env.PAYMENT_GATEWAY_URL || "https://etechglobalhub.duckdns.org";

  let body: any = {};
  try {
    body = await req.json();
  } catch {
    // Ignore empty body
  }

  body.userId = uid; // Pin the request to the authenticated user for S2S security

  const targetUrl = `${gatewayUrl}/api/wallets/${pathStr}`;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const response = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Authorization": authHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    return NextResponse.json(data, { status: response.status });
  } catch (error: any) {
    return NextResponse.json({ error: `Connection failed: ${error.message}` }, { status: 502 });
  }
}
