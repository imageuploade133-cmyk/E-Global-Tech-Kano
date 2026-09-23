/**
 * Triggers a short, immediate native-style haptic feedback pulse when supported.
 *
 * In the E-Global native wrapper, prefer the trusted native haptic bridge so
 * Android/iOS use the same stronger feedback as native app controls.
 * In a normal mobile browser, fall back to the Vibration API.
 *
 * This helper is intentionally fire-and-forget and must never delay or affect
 * the action that triggered it.
 */
export const triggerHaptic = (duration = 45): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const webViewBridge = (
      window as typeof window & {
        flutter_inappwebview?: {
          callHandler?: (handlerName: string, ...args: unknown[]) => Promise<unknown>;
        };
      }
    ).flutter_inappwebview;

    if (typeof webViewBridge?.callHandler === "function") {
      void webViewBridge.callHandler("triggerHaptic").catch(() => {
        if (typeof navigator.vibrate === "function") {
          navigator.vibrate(duration);
        }
      });
      return;
    }

    if (typeof navigator.vibrate === "function") {
      navigator.vibrate(duration);
    }
  } catch {
    // Haptic feedback is optional and must never affect existing behavior.
  }
};
