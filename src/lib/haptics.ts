/**
 * Triggers the app's native haptic feedback when the wallet is running
 * inside the Flutter WebView. Falls back to browser vibration on web.
 *
 * Haptics are strictly best-effort and can never affect wallet behavior.
 */
export const triggerHaptic = (duration = 60): void => {
  try {
    if (typeof window !== "undefined") {
      const flutterWebView = (window as any).flutter_inappwebview;
      if (flutterWebView && typeof flutterWebView.callHandler === "function") {
        // The Flutter wrapper exposes this handler and maps it to the
        // platform-native haptic channel (Android/iOS).
        void flutterWebView.callHandler("triggerHaptic", duration).catch(() => {
          // Fall through to browser vibration if the native bridge fails.
          try {
            if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
              navigator.vibrate(duration);
            }
          } catch {}
        });
        return;
      }
    }

    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(duration);
    }
  } catch {
    // Haptic feedback is optional and must never affect existing functionality.
  }
};
