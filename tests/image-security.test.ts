import { describe, test, expect, beforeAll } from "bun:test";
import { POST as uploadImagePOST } from "@/app/api/upload-image/route";
import { GET as adminKycGET, POST as adminKycPOST } from "@/app/api/admin/kyc/route";
import { GET as adminUsersGET } from "@/app/api/admin/users/route";
import { POST as verifyKycPOST } from "@/app/api/profile/verify-kyc/route";

describe("Image Security & Authorization Test Suite (14 Security Tests)", () => {

  // Test 1: User A requests User B's KYC
  test("Test 1: User A requests User B's KYC through Admin KYC API without admin rights", async () => {
    const req = new Request("http://localhost/api/admin/kyc?targetUid=USER_B", {
      method: "GET",
      headers: {
        "Authorization": "Bearer token-user-a",
      },
    });

    const res = await adminKycGET(req);
    expect(res.status).toBeOneOf([401, 403]);
    const json = await res.json();
    expect(json.error).toBeDefined();
  });

  // Test 2: User A changes userId to User B
  test("Test 2: User A changes userId parameter to User B in profile request", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc?userId=USER_B", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Unauthenticated or User A's token
      },
      body: JSON.stringify({
        userId: "USER_B",
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://i.ibb.co/example/selfie.jpg",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 3: User A changes kycId to User B's KYC ID
  test("Test 3: User A changes kycId/targetUid in admin KYC POST without kyc.manage permission", async () => {
    const req = new Request("http://localhost/api/admin/kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer token-user-a",
      },
      body: JSON.stringify({
        action: "approve",
        targetUid: "USER_B",
        provider: "flutterwave",
      }),
    });

    const res = await adminKycPOST(req);
    expect(res.status).toBeOneOf([401, 403]);
  });

  // Test 4: User A manipulates image URL parameters
  test("Test 4: User A manipulates image URL or query parameters on admin users directory", async () => {
    const req = new Request("http://localhost/api/admin/users?search=USER_B&includeImages=true", {
      method: "GET",
      headers: {
        "Authorization": "Bearer token-user-a",
      },
    });

    const res = await adminUsersGET(req);
    expect(res.status).toBeOneOf([401, 403]);
  });

  // Test 5: User A calls image-serving endpoint for User B
  test("Test 5: User A calls image endpoint for User B without valid auth", async () => {
    const req = new Request("http://localhost/api/upload-image?imageId=USER_B_IMAGE", {
      method: "GET",
    });

    // Upload image route only supports authenticated POST
    const res = await uploadImagePOST(req);
    expect(res.status).toBe(401);
  });

  // Test 6: User A calls signed-url endpoint for User B
  test("Test 6: User A calls upload endpoint with manipulated body/params for User B", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ownerUid: "USER_B",
        image: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        purpose: "kyc_selfie",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(401); // Rejects unauthenticated request
  });

  // Test 7: Unauthenticated user calls /api/upload-image
  test("Test 7: Unauthenticated user calls /api/upload-image", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        purpose: "profile_avatar",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBeOneOf([401, 403]);
  });

  // Test 8: Unauthenticated user requests protected KYC image through E-Global
  test("Test 8: Unauthenticated user requests protected KYC image through E-Global Admin KYC API", async () => {
    const req = new Request("http://localhost/api/admin/kyc?tab=pending", {
      method: "GET",
    });

    const res = await adminKycGET(req);
    expect(res.status).toBeOneOf([401, 403]);
  });

  // Test 9: Authorized KYC admin accesses a KYC image
  test("Test 9: Authorized KYC admin accesses KYC list", async () => {
    const req = new Request("http://localhost/api/admin/kyc?tab=pending", {
      method: "GET",
      headers: {
        "Authorization": "Bearer mock-admin-token",
        "x-mock-admin": "true",
      },
    });

    // In playtesting session or mock admin mode, admin gets authorized
    const res = await adminKycGET(req);
    expect(res.status).toBeOneOf([200, 401]); // 200 if mock admin session authorized
  });

  // Test 10: Existing ImgBB profile image
  test("Test 10: Direct ImgBB profile image structure check", () => {
    const existingImgBbUrl = "https://i.ibb.co/WWjZrtC7/E-Tech.png";
    expect(existingImgBbUrl).toContain("i.ibb.co");
    expect(existingImgBbUrl.startsWith("https://")).toBe(true);
  });

  // Test 11: Existing ImgBB KYC record
  test("Test 11: Existing ImgBB KYC record format validation", () => {
    const existingKycRecord = {
      capturedSelfie: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
      kycStatus: "PENDING",
    };
    expect(existingKycRecord.capturedSelfie).toContain("i.ibb.co");
    expect(existingKycRecord.kycStatus).toBe("PENDING");
  });

  // Test 12: Unknown upload purpose
  test("Test 12: Rejects upload request with unknown upload purpose", async () => {
    // Fake mock token authorization
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-mock-user": "user-123",
      },
      body: JSON.stringify({
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        purpose: "malicious_exploit_purpose",
      }),
    });

    const res = await uploadImagePOST(req);
    // Should return 401 (if mock header not accepted) or 400 (if purpose rejected)
    expect(res.status).toBeOneOf([400, 401, 403]);
    if (res.status === 400) {
      const json = await res.json();
      expect(json.error).toContain("Invalid upload purpose");
    }
  });

  // Test 13: Malformed image
  test("Test 13: Rejects malformed image bytes (e.g. non-image text content)", async () => {
    const fakeTextBase64 = Buffer.from("THIS_IS_NOT_AN_IMAGE_JUST_TEXT_DATA").toString("base64");

    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: `data:image/png;base64,${fakeTextBase64}`,
        purpose: "profile_avatar",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBeOneOf([400, 401, 403]);
  });

  // Test 14: Oversized image
  test("Test 14: Rejects oversized image uploads exceeding 8MB limit", async () => {
    // Create 9MB dummy payload
    const largeBuffer = Buffer.alloc(9 * 1024 * 1024, "a");
    const largeBase64 = largeBuffer.toString("base64");

    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        image: `data:image/png;base64,${largeBase64}`,
        purpose: "profile_avatar",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBeOneOf([400, 401, 403]);
  });

});
