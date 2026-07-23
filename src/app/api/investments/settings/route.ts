import { NextResponse } from "next/server";
import { authenticateUserRequest } from "@/lib/auth-util";
import { InvestmentService } from "@/services/investment-service";

export async function GET(req: Request) {
  try {
    const authResult = await authenticateUserRequest(req);
    if (!authResult.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const settings = await InvestmentService.getSettings();
    return NextResponse.json({ success: true, settings });
  } catch (err: unknown) {
    console.error("[Settings API Error]", (err as Error).message);
    return NextResponse.json({ error: (err as Error).message || "Failed to load settings." }, { status: 500 });
  }
}
