import { describe, test, expect, beforeAll } from "bun:test";
import { POST as uploadImagePOST } from "@/app/api/upload-image/route";
import { GET as adminKycGET, POST as adminKycPOST } from "@/app/api/admin/kyc/route";
import { GET as adminUsersGET } from "@/app/api/admin/users/route";
import { POST as verifyKycPOST } from "@/app/api/profile/verify-kyc/route";
import { adminDb } from "@/lib/firebase-admin";

describe("Strict Two-User Authenticated IDOR & Provenance Security Test Suite", () => {
  // In development/test mode, authenticateUserRequest recognizes "mock-uid" and "mock-admin-uid" as authenticated users
  const USER_A_TOKEN = "Bearer mock-uid";
  const USER_A_UID = "mock-uid";
  const USER_B_UID = "user-b-victim-uid";
  const USER_B_SELFIE_URL = "https://i.ibb.co/user-b-victim-selfie.jpg";

  beforeAll(async () => {
    // Seed User B's upload receipt bound to User B's UID in kyc_upload_receipts
    const receiptDocId = Buffer.from(`${USER_B_UID}_${USER_B_SELFIE_URL}`).toString("hex").slice(0, 64);
    await adminDb.collection("kyc_upload_receipts").doc(receiptDocId).set({
      ownerUid: USER_B_UID,
      url: USER_B_SELFIE_URL,
      imageId: "user-b-image-123",
      purpose: "kyc_selfie",
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });
  });

  // Test 1: User A trying to access Admin KYC list without admin rights
  test("Test 1: Authenticated normal User A without kyc.view permission receives HTTP 403 Forbidden on Admin KYC GET", async () => {
    const req = new Request(`http://localhost/api/admin/kyc?targetUid=${USER_B_UID}`, {
      method: "GET",
      headers: {
        "Authorization": USER_A_TOKEN,
      },
    });

    const res = await adminKycGET(req);
    expect(res.status).toBe(403);
  });

  // Test 2: User A attempting to pass User B's UID in verify-kyc
  test("Test 2: Authenticated User A passing User B's targetUid in body cannot override token identity", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        userId: USER_B_UID,
        uid: USER_B_UID,
        targetUid: USER_B_UID,
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: USER_B_SELFIE_URL,
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    // User A attempts to submit User B's selfie URL -> fails provenance check with 403 Forbidden
    expect(res.status).toBe(403);
  });

  // Test 3: User A attempting to submit User B's upload receipt URL
  test("Test 3: Authenticated User A attempting to submit User B's selfie URL receives HTTP 403 Forbidden", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: USER_B_SELFIE_URL,
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toContain("uploaded by another");
  });

  // Test 4: User A calling Admin KYC POST to approve User B
  test("Test 4: Authenticated User A calling Admin KYC POST receives HTTP 403 Forbidden", async () => {
    const req = new Request("http://localhost/api/admin/kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        action: "approve",
        targetUid: USER_B_UID,
        provider: "flutterwave",
      }),
    });

    const res = await adminKycPOST(req);
    expect(res.status).toBe(403);
  });

  // Test 5: Rejection of JSON base64 payloads on /api/upload-image with HTTP 415
  test("Test 5: /api/upload-image strictly rejects JSON base64 requests with HTTP 415", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        purpose: "profile_avatar",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(415);
  });

  // Test 6: Rejection of raw base64 strings in /api/profile/verify-kyc
  test("Test 6: /api/profile/verify-kyc rejects raw base64 or data URLs with HTTP 400", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Raw base64 or data URLs are strictly rejected");
  });

  // Test 7: Rejection of arbitrary external domains in /api/profile/verify-kyc
  test("Test 7: /api/profile/verify-kyc rejects non-ImgBB arbitrary external hostnames with HTTP 400", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": USER_A_TOKEN,
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://evil-attacker.com/fake-selfie.png",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toContain("Selfie URL must be a direct HTTPS ImgBB image URL");
  });

  // Test 8: Unauthenticated upload attempt
  test("Test 8: Unauthenticated upload attempt returns HTTP 415 for non-multipart requests", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(415);
  });

  // Test 9: Unauthenticated upload attempt with multipart content-type returns 401
  test("Test 9: Unauthenticated multipart upload attempt returns HTTP 401", async () => {
    const formData = new FormData();
    formData.append("purpose", "profile_avatar");

    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      body: formData,
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(401);
  });

  // Test 10: Authorized Admin user can access Admin KYC endpoint
  test("Test 10: Authorized Admin user can access Admin KYC endpoint with HTTP 200", async () => {
    const req = new Request("http://localhost/api/admin/kyc?tab=pending", {
      method: "GET",
      headers: {
        "Authorization": "Bearer mock-admin-uid",
      },
    });

    const res = await adminKycGET(req);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
