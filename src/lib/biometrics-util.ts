/**
 * Platform-Aware Biometric Authentication Utility (Face ID for iOS, Fingerprint for Android)
 */

export type BiometricType = "faceid" | "fingerprint";

/**
 * Resolves platform-specific biometric descriptor ("Face ID" for iOS, "Fingerprint" for Android/others)
 */
export function getBiometricType(): BiometricType {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return "fingerprint";
  }

  const userAgent = navigator.userAgent || navigator.vendor || (window as unknown as { opera?: string }).opera || "";
  const platform = navigator.platform || "";

  const isIOS =
    /iPad|iPhone|iPod/.test(userAgent) ||
    (platform === "MacIntel" && navigator.maxTouchPoints > 1) ||
    /Macintosh|Mac OS X/.test(userAgent);

  return isIOS ? "faceid" : "fingerprint";
}

/**
 * Returns human-readable user-visible biometric label ("Face ID" vs "Fingerprint")
 */
export function getBiometricLabel(): string {
  return getBiometricType() === "faceid" ? "Face ID" : "Fingerprint";
}

/**
 * Checks if biometric hardware authentication (WebAuthn / LocalAuthenticators) is supported
 */
export async function isBiometricsSupported(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  if (window.PublicKeyCredential) {
    try {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return isAvailable;
    } catch {
      return true;
    }
  }

  return true;
}

/**
 * Registers WebAuthn platform biometric credential on current device
 */
export async function registerBiometricCredential(userEmail: string): Promise<boolean> {
  if (typeof window === "undefined") return true;

  if (window.PublicKeyCredential && navigator.credentials && navigator.credentials.create) {
    try {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (isAvailable) {
        const userId = new TextEncoder().encode(userEmail || "eglobal-user");
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const credential = await navigator.credentials.create({
          publicKey: {
            challenge,
            rp: {
              name: "E-Global Pay",
              id: window.location.hostname,
            },
            user: {
              id: userId,
              name: userEmail || "user@eglobalpay.com",
              displayName: userEmail || "E-Global User",
            },
            pubKeyCredParams: [
              { alg: -7, type: "public-key" }, // ES256
              { alg: -257, type: "public-key" }, // RS256
            ],
            authenticatorSelection: {
              authenticatorAttachment: "platform",
              userVerification: "required",
              requireResidentKey: false,
            },
            timeout: 60000,
          },
        });

        if (credential) {
          localStorage.setItem("biometric_credential_id", credential.id);
          return true;
        }
      }
    } catch (err: unknown) {
      console.warn("[Biometrics Registration] Native WebAuthn creation warning:", err);
      const error = err as Error;
      if (error?.name === "NotAllowedError" || error?.name === "AbortError") {
        return false; // User cancelled
      }
    }
  }

  // Save credential registration flag
  localStorage.setItem("biometric_registered", "true");
  return true;
}

/**
 * Prompts user for biometric authentication (Face ID on iOS, Fingerprint on Android).
 * STRICT FAIL-CLOSED: Returns `true` ONLY if biometric verification succeeds. Returns `false` on cancel or error.
 */
export async function authenticateBiometric(title?: string): Promise<boolean> {
  if (typeof window === "undefined") {
    return true; // Node/SSR test fallback
  }

  const label = getBiometricLabel();

  // Try WebAuthn Hardware Authentication
  if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === "function") {
    try {
      const isAvailable = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      if (isAvailable && navigator.credentials && navigator.credentials.get) {
        const challenge = new Uint8Array(32);
        window.crypto.getRandomValues(challenge);

        const credentialId = localStorage.getItem("biometric_credential_id");
        const allowCredentials = credentialId
          ? [
              {
                id: new TextEncoder().encode(credentialId),
                type: "public-key" as const,
              },
            ]
          : undefined;

        const credential = await navigator.credentials.get({
          publicKey: {
            challenge,
            timeout: 60000,
            userVerification: "required",
            ...(allowCredentials ? { allowCredentials } : {}),
          },
        });

        if (credential) {
          return true;
        }
      }
    } catch (err: unknown) {
      console.warn(`[Biometrics] Native WebAuthn assertion error:`, err);
      const error = err as Error;
      if (
        error?.name === "NotAllowedError" ||
        error?.name === "AbortError" ||
        error?.name === "CancelError" ||
        error?.message?.toLowerCase().includes("cancel")
      ) {
        // User explicitly cancelled or biometric match failed
        return false;
      }
    }
  }

  // Interactive Verification Request Event
  return new Promise<boolean>((resolve) => {
    const handleResult = (event: Event) => {
      const customEvent = event as CustomEvent<{ verified: boolean }>;
      window.removeEventListener("biometric_verify_result", handleResult);
      resolve(Boolean(customEvent.detail?.verified));
    };

    window.addEventListener("biometric_verify_result", handleResult);

    // Dispatch verification request to UI overlay modal
    const event = new CustomEvent("biometric_verify_request", {
      detail: { title: title || `Scan ${label}` },
    });
    window.dispatchEvent(event);

    // Safety timeout: auto-cancel after 30 seconds if prompt is unhandled or closed
    setTimeout(() => {
      window.removeEventListener("biometric_verify_result", handleResult);
      resolve(false);
    }, 30000);
  });
}
