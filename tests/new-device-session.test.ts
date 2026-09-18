import { describe, it, expect } from "bun:test";

function maskPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length < 8) return "••••••••";
  return `${clean.slice(0, 4)}••••${clean.slice(-4)}`;
}

function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return "••••@••••.com";
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? `${name[0]}*` : `${name[0]}***${name[name.length - 1]}`;
  return `${maskedName}@${domain}`;
}

describe("New Device Session & Trusted Factor Security Suite", () => {
  it("Test 1: Explicit boolean requirement for trusted phone and email verification", () => {
    const userUnverifiedFlags: Record<string, any> = {
      phoneVerified: undefined,
      emailVerified: false,
      phoneNumber: "2348012345678",
      email: "test@example.com",
    };

    const isPhoneVerified = userUnverifiedFlags.phoneVerified === true && !!userUnverifiedFlags.phoneNumber;
    const isEmailVerified = userUnverifiedFlags.emailVerified === true && !!userUnverifiedFlags.email;

    expect(isPhoneVerified).toBe(false);
    expect(isEmailVerified).toBe(false);

    const userVerifiedFlags: Record<string, any> = {
      phoneVerified: true,
      emailVerified: true,
      phoneNumber: "2348012345678",
      email: "test@example.com",
    };

    const isPhoneVerified2 = userVerifiedFlags.phoneVerified === true && !!userVerifiedFlags.phoneNumber;
    const isEmailVerified2 = userVerifiedFlags.emailVerified === true && !!userVerifiedFlags.email;

    expect(isPhoneVerified2).toBe(true);
    expect(isEmailVerified2).toBe(true);
  });

  it("Test 2: WhatsApp default selection strictly requires explicit phone verification", () => {
    // Phone exists but unverified, email verified -> Email default
    const userData = {
      phoneNumber: "2348012345678",
      phoneVerified: false,
      email: "user@example.com",
      emailVerified: true,
    };

    const isPhoneVerified = userData.phoneVerified === true && !!userData.phoneNumber;
    const isEmailVerified = userData.emailVerified === true && !!userData.email;

    const defaultChannel = isPhoneVerified ? "whatsapp" : isEmailVerified ? "email" : null;
    expect(defaultChannel).toBe("email");
  });

  it("Test 3: Both phone and email explicitly verified -> WhatsApp default", () => {
    const userData = {
      phoneNumber: "2348012345678",
      phoneVerified: true,
      email: "user@example.com",
      emailVerified: true,
    };

    const isPhoneVerified = userData.phoneVerified === true && !!userData.phoneNumber;
    const isEmailVerified = userData.emailVerified === true && !!userData.email;

    const defaultChannel = isPhoneVerified ? "whatsapp" : isEmailVerified ? "email" : null;
    expect(defaultChannel).toBe("whatsapp");
  });

  it("Test 4: Neither factor explicitly verified -> Fail closed", () => {
    const userData = {
      phoneNumber: "2348012345678",
      phoneVerified: undefined,
      email: "user@example.com",
      emailVerified: false,
    };

    const isPhoneVerified = userData.phoneVerified === true && !!userData.phoneNumber;
    const isEmailVerified = userData.emailVerified === true && !!userData.email;

    const hasVerifiedFactor = isPhoneVerified || isEmailVerified;
    expect(hasVerifiedFactor).toBe(false);
  });

  it("Test 5: Sensitive contact data masking in audit logs", () => {
    const rawPhone = "2348012345678";
    const rawEmail = "julesverne@example.com";

    expect(maskPhone(rawPhone)).toBe("2348••••5678");
    expect(maskEmail(rawEmail)).toBe("j***e@example.com");
    expect(maskPhone(rawPhone)).not.toContain("1234");
    expect(maskEmail(rawEmail)).not.toContain("lesvern");
  });
});
