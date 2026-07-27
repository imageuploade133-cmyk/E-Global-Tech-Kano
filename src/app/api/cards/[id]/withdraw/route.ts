import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { CardService } from "@/services/card-service";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let uid = "";
  let idToken = "";
  try {
    const authResult = await authenticateUserRequest(req);
    uid = authResult.uid;
    const authHeader = req.headers.get("Authorization") || "";
    idToken = authHeader.startsWith("Bearer ") ? authHeader.split("Bearer ")[1] : "";
  } catch (err: any) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { amount } = body;
    const withdrawAmount = Number(amount);

    if (isNaN(withdrawAmount) || withdrawAmount <= 0) {
      return NextResponse.json({ error: "Invalid amount to withdraw." }, { status: 400 });
    }

    const result = await CardService.withdrawFromCard({
      userId: uid,
      cardId: id,
      amount: withdrawAmount,
      idToken,
      isMock: uid === "mock-uid",
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
