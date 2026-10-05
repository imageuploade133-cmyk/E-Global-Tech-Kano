import { describe, expect, test } from "bun:test";
import {
  getBiometricType,
  getBiometricLabel,
  isBiometricsSupported,
  authenticateBiometric,
  authenticateBiometricDetailed,
  parseBiometricResponse,
  base64ToUint8Array,
  uint8ArrayToBase64,
} from "../src/lib/biometrics-util";

describe("Platform-Aware Biometrics Suite", () => {
  test("1. Resolves biometric label based on platform descriptor", () => {
    const type = getBiometricType();
    const label = getBiometricLabel();

    expect(["faceid", "fingerprint"]).toContain(type);
    expect(["Face ID", "Fingerprint"]).toContain(label);
  });

  test("2. Biometrics support check evaluates without throwing", async () => {
    const supported = await isBiometricsSupported();
    expect(typeof supported).toBe("boolean");
  });

  test("3. Authenticate biometric fallback succeeds in node/simulation environment", async () => {
    const result = await authenticateBiometric("Test Prompt");
    expect(result).toBe(true);
    const detailed = await authenticateBiometricDetailed("Test Prompt");
    expect(detailed.success).toBe(true);
  });

  test("4. Parses biometric responses from native bridges correctly", () => {
    expect(parseBiometricResponse(true).success).toBe(true);
    expect(parseBiometricResponse(false).success).toBe(false);
    expect(parseBiometricResponse({ success: true }).success).toBe(true);
    expect(parseBiometricResponse({ success: false, error: "User cancelled" }).success).toBe(false);
    expect(parseBiometricResponse({ verified: true }).success).toBe(true);
    expect(parseBiometricResponse({ verified: false }).success).toBe(false);
  });

  test("5. Encodes and decodes base64url Uint8Array byte arrays bi-directionally", () => {
    const original = new Uint8Array([72, 101, 108, 108, 111, 32, 66, 105, 111]);
    const encoded = uint8ArrayToBase64(original);
    const decoded = base64ToUint8Array(encoded);
    expect(decoded).toEqual(original);
  });
});
