import { adminDb } from "@/lib/firebase-admin";
import { DEFAULT_DISABLED_NOTICE, FeatureToggleKey } from "./feature-toggle";

export async function checkServerFeatureStatus(
  key: FeatureToggleKey
): Promise<{ enabled: boolean; message: string }> {
  try {
    const docSnap = await adminDb.collection("config").doc("feature_toggles").get();
    if (!docSnap.exists) {
      return { enabled: true, message: DEFAULT_DISABLED_NOTICE };
    }

    const toggles = docSnap.data()?.toggles || {};
    const item = toggles[key];

    if (!item) {
      return { enabled: true, message: DEFAULT_DISABLED_NOTICE };
    }

    const enabled = item.enabled !== false;
    const message = (item.disabledNotice || "").trim() || DEFAULT_DISABLED_NOTICE;

    return { enabled, message };
  } catch (err) {
    console.warn(`[checkServerFeatureStatus] Error checking ${key}:`, err);
    return { enabled: true, message: DEFAULT_DISABLED_NOTICE };
  }
}
