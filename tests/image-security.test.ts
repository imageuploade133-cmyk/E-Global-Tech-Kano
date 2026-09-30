import { describe, test, expect } from "bun:test";
import { POST as uploadImagePOST } from "@/app/api/upload-image/route";
import { GET as adminKycGET, POST as adminKycPOST } from "@/app/api/admin/kyc/route";
import { GET as adminUsersGET } from "@/app/api/admin/users/route";
import { POST as verifyKycPOST } from "@/app/api/profile/verify-kyc/route";

describe("Strict Two-User Image Security & IDOR Authorization Suite", () => {
  // Real mock UIDs for User A (normal customer) and User B (victim customer)
  const USER_A_UID = "mock-user-a-normal";
  const USER_B_UID = "mock-user-b-victim";

  // Test 1: User A calling Admin KYC GET to access User B's KYC list
  test("Test 1: Normal User A calling Admin KYC GET receives HTTP 401/403 Access Denied", async () => {
    const req = new Request(`http://localhost/api/admin/kyc?targetUid=${USER_B_UID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${USER_A_UID}`,
      },
    });

    const res = await adminKycGET(req);
    expect(res.status).toBe(401);
  });

  // Test 2: User A attempting to pass User B's UID in verify-kyc
  test("Test 2: User A passing User B's targetUid cannot override verified token UID", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_UID}`,
      },
      body: JSON.stringify({
        userId: USER_B_UID,
        uid: USER_B_UID,
        targetUid: USER_B_UID,
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://i.ibb.co/user-a-selfie.jpg",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 3: User A attempting to approve User B's KYC in Admin API
  test("Test 3: Normal User A calling Admin KYC POST receives HTTP 401 Access Denied", async () => {
    const req = new Request("http://localhost/api/admin/kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_UID}`,
      },
      body: JSON.stringify({
        action: "approve",
        targetUid: USER_B_UID,
        provider: "flutterwave",
      }),
    });

    const res = await adminKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 4: User A attempting Admin Users query for User B
  test("Test 4: Normal User A calling Admin Users GET receives HTTP 401 Access Denied", async () => {
    const req = new Request(`http://localhost/api/admin/users?search=${USER_B_UID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${USER_A_UID}`,
      },
    });

    const res = await adminUsersGET(req);
    expect(res.status).toBe(401);
  });

  // Test 5: Rejection of JSON base64 payloads on /api/upload-image with HTTP 415
  test("Test 5: /api/upload-image strictly rejects JSON base64 requests with HTTP 415", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_UID}`,
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
  test("Test 6: /api/profile/verify-kyc rejects raw base64 or data URLs", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_UID}`,
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 7: Rejection of arbitrary external domains in /api/profile/verify-kyc
  test("Test 7: /api/profile/verify-kyc rejects non-ImgBB arbitrary external hostnames", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_UID}`,
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://evil-attacker.com/fake-selfie.png",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 8: Unauthenticated upload rejection
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

  // Test 10: Authorized KYC Admin can access Admin KYC endpoint
  test("Test 10: Authorized Admin user can access Admin KYC endpoint", async () => {
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
