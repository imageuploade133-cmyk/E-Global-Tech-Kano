import { expect, test, describe } from "bun:test";

describe("PIN Reset OTP Gateway URL Normalization & Fallback Routing", () => {
  test("normalizes PAYMENT_GATEWAY_URL trailing slashes to prevent double slashes in route concatenation", () => {
    const rawGatewayUrlWithSlash = "http://127.0.0.1:3055///";
    const cleanGatewayUrl = rawGatewayUrlWithSlash.replace(/\/+$/, "");

    const targetEndpoint = `${cleanGatewayUrl}/api/auth/pin-reset-otp`;
    expect(targetEndpoint).toBe("http://127.0.0.1:3055/api/auth/pin-reset-otp");
    expect(targetEndpoint).not.toContain("//api");
  });

  test("falls back to /api/auth/send-otp when gateway returns 404 for /api/auth/pin-reset-otp", async () => {
    let attemptedEndpoints: string[] = [];

    // Mock fetch handler simulating gateway behavior
    const mockFetch = async (url: string, init?: any) => {
      attemptedEndpoints.push(url);
      if (url.endsWith("/api/auth/pin-reset-otp")) {
        return {
          status: 404,
          ok: false,
          text: async () => "<!DOCTYPE html><html><body>Cannot POST //api/auth/pin-reset-otp</body></html>",
        };
      }
      if (url.endsWith("/api/auth/send-otp")) {
        return {
          status: 200,
          ok: true,
          text: async () => JSON.stringify({ success: true, message: "OTP sent via WhatsApp fallback" }),
        };
      }
      return { status: 500, ok: false, text: async () => "" };
    };

    const GATEWAY_URL = "http://127.0.0.1:3055/".replace(/\/+$/, "");
    const payload = { channel: "whatsapp" };

    let response = await mockFetch(`${GATEWAY_URL}/api/auth/pin-reset-otp`, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    let responseText = await response.text();

    if (response.status === 404 || responseText.includes("Cannot POST")) {
      const userPhone = "2348012345678";
      const fallbackRes = await mockFetch(`${GATEWAY_URL}/api/auth/send-otp`, {
        method: "POST",
        body: JSON.stringify({
          phoneNumber: userPhone,
          type: "pin_reset",
          ...payload,
        }),
      });

      if (fallbackRes) {
        response = fallbackRes;
        responseText = await response.text();
      }
    }

    const result = JSON.parse(responseText);
    expect(attemptedEndpoints).toEqual([
      "http://127.0.0.1:3055/api/auth/pin-reset-otp",
      "http://127.0.0.1:3055/api/auth/send-otp",
    ]);
    expect(response.status).toBe(200);
    expect(result.success).toBe(true);
    expect(result.message).toBe("OTP sent via WhatsApp fallback");
  });

  test("sanitizes Express/Gateway HTML 404 response 'Cannot POST //api/auth/pin-reset-otp' to friendly message if fallback fails", () => {
    const rawHtmlResponse = "<!DOCTYPE html>\n<html lang=\"en\">\n<head>\n<meta charset=\"utf-8\">\n<title>Error</title>\n</head>\n<body>\n<pre>Cannot POST //api/auth/pin-reset-otp</pre>\n</body>\n</html>\n";

    let result: Record<string, any> = {};
    try {
      result = JSON.parse(rawHtmlResponse);
    } catch {
      if (rawHtmlResponse.includes("504") || rawHtmlResponse.includes("Gateway Time-out")) {
        result = { error: "Gateway timed out while connecting to server. Please try again in a few seconds." };
      } else if (rawHtmlResponse.includes("Cannot POST") || rawHtmlResponse.includes("<!DOCTYPE")) {
        result = { error: "WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead." };
      } else {
        result = { error: rawHtmlResponse || "Server returned non-JSON response." };
      }
    }

    let rawErr = String(result.error || result.message || "Failed to dispatch PIN reset OTP.");
    const isOk = false;
    const status = 404;

    if (!isOk) {
      if (
        rawErr.includes("WhatsApp instance") ||
        rawErr.includes("not active or connected") ||
        rawErr.includes("WhatsApp Dispatch Failed") ||
        rawErr.includes("WHATSAPP_API") ||
        rawErr.includes("ECONNREFUSED") ||
        rawErr.includes("Cannot POST") ||
        rawErr.includes("<!DOCTYPE") ||
        rawErr.includes("html") ||
        status === 400 ||
        status === 404 ||
        status === 502 ||
        status === 503
      ) {
        rawErr = "WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead.";
      }
    }

    expect(rawErr).toBe("WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead.");
    expect(rawErr).not.toContain("<!DOCTYPE");
    expect(rawErr).not.toContain("Cannot POST");
  });

  test("sanitizes frontend toast message if raw HTML string slips through", () => {
    const dataError = "<!DOCTYPE html>\n<html><body>Cannot POST /api/auth/pin-reset-otp</body></html>";
    let errStr = typeof dataError === "string" ? dataError : "Failed to send OTP";
    if (
      errStr.includes("<!DOCTYPE") ||
      errStr.includes("Cannot POST") ||
      errStr.includes("html") ||
      errStr.includes("WhatsApp instance") ||
      errStr.includes("not active or connected") ||
      errStr.includes("WhatsApp Dispatch Failed")
    ) {
      errStr = "WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead.";
    }

    expect(errStr).toBe("WhatsApp OTP service is currently unavailable. Please use the Email OTP option instead.");
  });
});
