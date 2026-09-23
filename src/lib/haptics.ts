/**
 * Triggers immediate native-style haptic feedback when available.
 * Uses the E-Global native WebView bridge first, then browser vibration.
 * Haptics are fire-and-forget so navigation is never delayed.
 */
export const triggerHaptic = (duration = 45): void => {
  if (typeof window === "undefined") return;

  try {
    const bridge = (window as typeof window & {
      flutter_inappwebview?: {
        callHandler?: (name: string, ...args: unknown[]) => Promise<unknown>;
      };
    }).flutter_inappwebview;

    if (typeof bridge?.callHandler === "function") {
      void bridge.callHandler("triggerHaptic").catch(() => {
        if (typeof navigator.vibrate === "function") navigator.vibrate(duration);
      });
      return;
    }

    if (typeof navigator.vibrate === "function") navigator.vibrate(duration);
  } catch {
    // Haptics are optional and must never affect existing behavior.
  }
};
