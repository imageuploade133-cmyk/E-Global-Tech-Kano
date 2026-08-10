import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";

export async function GET() {
  try {
    const docSnap = await adminDb.collection("config").doc("app").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      // Only expose non-privileged visual branding information to public route
      const publicConfig = {
        logoUrl: data?.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        supportPhone1: data?.supportPhone1 || "+234 800 345 6225",
        supportPhone2: data?.supportPhone2 || "+234 901 234 5678",
        supportEmail: data?.supportEmail || "support@e-globaltechhub.com",
        appVersion: data?.appVersion || "1.0.0",
        newDeviceDetectorEnabled: data?.newDeviceDetectorEnabled !== false
      };
      return NextResponse.json({ success: true, config: publicConfig });
    }
    return NextResponse.json({ success: false, error: "Config document not found." }, { status: 404 });
  } catch (err: any) {
    console.error("[Public Config API] Error:", err.message);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
