import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export interface EstateSettingsData {
  autoApproveListings: boolean;
  requireAgentKYC: boolean;
  maxActiveListingsPerAgent: number;
  platformCommissionPercent: number;
  enableVoiceNotes: boolean;
  enableAutoResponses: boolean;
  chatSecurityNoticeUser: string;
  chatSecurityNoticeAgent: string;
  updatedAt?: string;
}

const DEFAULT_ESTATE_SETTINGS: EstateSettingsData = {
  autoApproveListings: false,
  requireAgentKYC: true,
  maxActiveListingsPerAgent: 20,
  platformCommissionPercent: 2.5,
  enableVoiceNotes: true,
  enableAutoResponses: true,
  chatSecurityNoticeUser:
    "Do NOT deposit or transfer funds directly to an agent's personal bank account. Fund your E-Global Wallet account and transfer directly to the agent's wallet account.",
  chatSecurityNoticeAgent:
    "Do NOT request or instruct customers to transfer funds directly to your external personal bank account. Provide ONLY your E-Global Wallet Account to receive funds.",
};

// GET /api/estate/admin/settings - Read administrative marketplace settings
export async function GET(req: Request) {
  try {
    const authResult = await requireAdminPermission(req, "estate.view");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const docSnap = await adminDb.collection("config").doc("estate_settings").get();
    if (!docSnap.exists) {
      return NextResponse.json({ success: true, settings: DEFAULT_ESTATE_SETTINGS });
    }

    const data = docSnap.data() || {};
    return NextResponse.json({
      success: true,
      settings: {
        ...DEFAULT_ESTATE_SETTINGS,
        ...data,
      },
    });
  } catch (err: any) {
    console.error("[GET /api/estate/admin/settings Error]:", err.message);
    return NextResponse.json(
      { error: "Failed to fetch property marketplace settings." },
      { status: 500 }
    );
  }
}

// POST /api/estate/admin/settings - Save administrative marketplace settings
export async function POST(req: Request) {
  try {
    const authResult = await requireAdminPermission(req, "estate.manage");
    if (!authResult.authorized) {
      return authResult.response!;
    }

    const body = await req.json();
    const nowIso = new Date().toISOString();

    const updatedSettings: EstateSettingsData = {
      autoApproveListings: Boolean(body.autoApproveListings),
      requireAgentKYC: Boolean(body.requireAgentKYC),
      maxActiveListingsPerAgent: Math.max(1, Number(body.maxActiveListingsPerAgent) || 20),
      platformCommissionPercent: Math.max(0, Number(body.platformCommissionPercent) || 0),
      enableVoiceNotes: Boolean(body.enableVoiceNotes !== false),
      enableAutoResponses: Boolean(body.enableAutoResponses !== false),
      chatSecurityNoticeUser: String(
        body.chatSecurityNoticeUser || DEFAULT_ESTATE_SETTINGS.chatSecurityNoticeUser
      ).trim(),
      chatSecurityNoticeAgent: String(
        body.chatSecurityNoticeAgent || DEFAULT_ESTATE_SETTINGS.chatSecurityNoticeAgent
      ).trim(),
      updatedAt: nowIso,
    };

    await adminDb.collection("config").doc("estate_settings").set(updatedSettings, { merge: true });

    return NextResponse.json({
      success: true,
      message: "Property marketplace settings saved successfully.",
      settings: updatedSettings,
    });
  } catch (err: any) {
    console.error("[POST /api/estate/admin/settings Error]:", err.message);
    return NextResponse.json(
      { error: "Failed to update property marketplace settings." },
      { status: 500 }
    );
  }
}
