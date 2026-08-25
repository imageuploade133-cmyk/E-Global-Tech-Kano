import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { callWhatsappBackend, getWhatsappServerConfig, logWhatsappAdminAudit } from "@/lib/whatsapp-service";

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "whatsapp.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }
    const admin = perm.auth;

    const body = await req.json();
    const { phoneNumber, message, type } = body;

    if (!phoneNumber) {
      return NextResponse.json({ error: "Phone number is required." }, { status: 400 });
    }

    const cleanNum = phoneNumber.trim().replace(/\D/g, "");
    if (cleanNum.length < 10) {
      return NextResponse.json({ error: "Please enter a valid phone number (at least 10 digits)." }, { status: 400 });
    }

    // Format full recipient phone number with country code if missing
    const fullNum = cleanNum.length === 10 || cleanNum.startsWith("0")
      ? `234${cleanNum.startsWith("0") ? cleanNum.slice(1) : cleanNum}`
      : cleanNum;

    let textToSend = "";
    if (type === "test_otp") {
      const sampleOtp = Math.floor(100000 + Math.random() * 900000).toString();
      textToSend = `[E-Tech Security] Your test verification OTP code is ${sampleOtp}. Valid for 5 minutes. Do not share this code with anyone.`;
    } else {
      if (!message || !message.trim()) {
        return NextResponse.json({ error: "Message content is required for custom WhatsApp messages." }, { status: 400 });
      }
      textToSend = message.trim();
    }

    const config = await getWhatsappServerConfig();
    const instId = config.instanceId || "default";

    const payload = {
      instanceId: instId,
      number: fullNum,
      phoneNumber: fullNum,
      recipient: fullNum,
      phone: fullNum,
      to: fullNum,
      remoteJid: `${fullNum}@s.whatsapp.net`,
      text: textToSend,
      message: textToSend,
      body: textToSend,
      caption: textToSend,
    };

    // Candidates of WhatsAPI Multi-Device Gateway endpoints
    const candidateEndpoints = [
      `/send/text`,
      `/sendText`,
      `/message/sendText/${instId}`,
      `/instances/${instId}/messages/send`,
      `/instances/${instId}/messages`,
      `/instances/${instId}/send-text`,
      `/message/sendText`,
      `/message/send`,
    ];

    let backendRes: any = { ok: false, status: 404, error: "No endpoint succeeded" };

    for (const endpoint of candidateEndpoints) {
      backendRes = await callWhatsappBackend(endpoint, "POST", payload, 3500);
      if (backendRes.ok) {
        break;
      }
    }

    await logWhatsappAdminAudit(admin.uid, admin.email || "", "TEST_WHATSAPP_DISPATCH", {
      phoneNumber: fullNum,
      type: type || "custom",
      success: backendRes.ok,
      status: backendRes.status,
    });

    if (backendRes.ok) {
      return NextResponse.json({
        success: true,
        message: `WhatsApp message dispatched successfully to +${fullNum}!`,
        sentText: textToSend,
        recipient: `+${fullNum}`,
        timestamp: new Date().toISOString(),
      });
    }

    return NextResponse.json({
      error: backendRes.error || "Failed to deliver WhatsApp message via VM gateway.",
      details: backendRes.data || { note: "Tried standard Baileys/Evolution WhatsApp endpoints." },
    }, { status: backendRes.status && backendRes.status >= 400 && backendRes.status < 500 ? backendRes.status : 502 });

  } catch (err: any) {
    console.error("[WhatsApp Test Send POST Exception]:", err.message);
    return NextResponse.json({ error: "Failed to dispatch test WhatsApp message.", details: err.message }, { status: 500 });
  }
}
