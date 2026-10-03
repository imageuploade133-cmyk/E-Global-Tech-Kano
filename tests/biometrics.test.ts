import { describe, expect, test } from "bun:test";
import {
  getBiometricType,
  getBiometricLabel,
  isBiometricsSupported,
  authenticateBiometric,
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
  });
});
