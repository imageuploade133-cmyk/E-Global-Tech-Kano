/**
 * Triggers a short optional haptic feedback pulse for supported devices.
 *
 * Safe for server-rendered modules because browser APIs are accessed only
 * when the function is called in a user interaction handler.
 */
export const triggerHaptic = (duration = 10): void => {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }

  try {
    navigator.vibrate(duration);
  } catch {
    // Haptic feedback is optional and must never affect existing behavior.
  }
};
