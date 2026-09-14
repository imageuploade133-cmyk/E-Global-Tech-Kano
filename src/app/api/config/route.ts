import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { getGlobalMinTransferAmount } from "@/lib/global-limits-util";

export async function GET() {
  try {
    const globalMinTransfer = await getGlobalMinTransferAmount();
    const [docSnap, togglesSnap] = await Promise.all([
      adminDb.collection("config").doc("app").get(),
      adminDb.collection("config").doc("feature_toggles").get(),
    ]);

    if (docSnap.exists || togglesSnap.exists) {
      const data = docSnap.exists ? docSnap.data() : {};
      const togglesData = togglesSnap.exists ? togglesSnap.data() : {};

      // Only expose non-privileged visual branding & feature toggle information to public route
      const publicConfig = {
        logoUrl: data?.logoUrl || "https://i.ibb.co/WWjZrtC7/E-Tech.png",
        supportPhone1: data?.supportPhone1 || "+234 800 345 6225",
        supportPhone2: data?.supportPhone2 || "+234 901 234 5678",
        supportEmail: data?.supportEmail || "support@e-globaltechhub.com",
        appVersion: data?.appVersion || "1.0.0",
        minTransferAmount: globalMinTransfer,
        globalMinTransferAmount: globalMinTransfer,
        newDeviceDetectorEnabled: data?.newDeviceDetectorEnabled !== false,
        bannerOverlayFadeEnabled: data?.bannerOverlayFadeEnabled !== false,
        bannerSlideIntervalSeconds: data?.bannerSlideIntervalSeconds || 5,
        bannerBorderEnabled: data?.bannerBorderEnabled !== false,
        bannerBorderColor: data?.bannerBorderColor || "#e5e7eb",
        bannerBackgroundColor: data?.bannerBackgroundColor || "#111827",
        bannerImageMode: data?.bannerImageMode || "cover",
        bannerSlideEffect: data?.bannerSlideEffect || "fade",
        bannerImagePosition: data?.bannerImagePosition || "center",
        bannerHeightMobile: data?.bannerHeightMobile || 150,
        bannerHeightDesktop: data?.bannerHeightDesktop || 220,
        statementWatermarkUrl: data?.statementWatermarkUrl || "",
        statementWatermarkSize: data?.statementWatermarkSize || 100,
        statementWatermarkOpacity: data?.statementWatermarkOpacity ?? 0.15,
        featureToggles: togglesData?.toggles || data?.featureToggles || undefined,
      };
      return NextResponse.json({ success: true, config: publicConfig });
    }
    return NextResponse.json({ success: false, error: "Config document not found." }, { status: 404 });
  } catch (err: any) {
    console.warn("[Public Config API] Database connection offline or credentials missing. Falling back to default visual configuration.");
    // Return robust default visual config fallback
    const defaultPublicConfig = {
      logoUrl: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
      supportPhone1: "+234 800 345 6225",
      supportPhone2: "+234 901 234 5678",
      supportEmail: "support@e-globaltechhub.com",
      appVersion: "1.0.0",
      newDeviceDetectorEnabled: true,
      bannerOverlayFadeEnabled: true,
      bannerSlideIntervalSeconds: 5,
      bannerBorderEnabled: true,
      bannerBorderColor: "#e5e7eb",
      bannerBackgroundColor: "#111827",
      bannerImageMode: "cover",
      bannerSlideEffect: "fade",
      bannerImagePosition: "center",
      bannerHeightMobile: 150,
      bannerHeightDesktop: 220,
      statementWatermarkUrl: "",
      statementWatermarkSize: 100,
      statementWatermarkOpacity: 0.15
    };
    return NextResponse.json({ success: true, config: defaultPublicConfig });
  }
}
