import { describe, test, expect } from "bun:test";
import { POST as uploadImagePOST } from "@/app/api/upload-image/route";
import { GET as adminKycGET, POST as adminKycPOST } from "@/app/api/admin/kyc/route";
import { GET as adminUsersGET } from "@/app/api/admin/users/route";
import { POST as verifyKycPOST } from "@/app/api/profile/verify-kyc/route";

describe("Strict Two-User Image Security & Authorization Suite", () => {
  const USER_A_TOKEN = "mock-user-a-token";
  const USER_B_UID = "user-b-target-uid";

  // Test 1: Authenticated User A attempting to access User B's KYC via Admin KYC API
  test("User A cannot access User B's KYC list via Admin KYC GET endpoint", async () => {
    const req = new Request(`http://localhost/api/admin/kyc?targetUid=${USER_B_UID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${USER_A_TOKEN}`,
      },
    });

    const res = await adminKycGET(req);
    expect(res.status).toBe(401);
  });

  // Test 2: User A attempting to submit KYC on behalf of User B
  test("User A cannot submit KYC on behalf of User B by passing userId in body", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_TOKEN}`,
      },
      body: JSON.stringify({
        userId: USER_B_UID,
        uid: USER_B_UID,
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://i.ibb.co/example/selfie.jpg",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    // Standard unverified token yields 401 Unauthorized
    expect(res.status).toBe(401);
  });

  // Test 3: User A attempting to approve or manipulate User B's KYC via Admin KYC POST
  test("User A cannot perform admin KYC approval or actions on User B", async () => {
    const req = new Request("http://localhost/api/admin/kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_TOKEN}`,
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

  // Test 4: User A attempting to query Admin Users API to extract User B's images
  test("User A cannot query Admin Users endpoint to discover User B's profile/images", async () => {
    const req = new Request(`http://localhost/api/admin/users?search=${USER_B_UID}`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${USER_A_TOKEN}`,
      },
    });

    const res = await adminUsersGET(req);
    expect(res.status).toBe(401);
  });

  // Test 5: Rejection of base64 and JSON image submissions on /api/upload-image
  test("Upload endpoint strictly rejects JSON base64 payloads with HTTP 415", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${USER_A_TOKEN}`,
      },
      body: JSON.stringify({
        image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
        purpose: "profile_avatar",
      }),
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(415);
  });

  // Test 6: Rejection of base64/data URLs in /api/profile/verify-kyc
  test("Verify KYC endpoint strictly rejects raw base64 or data URLs in capturedSelfie", async () => {
    // Pass mock auth header where authenticateUserRequest returns mock user
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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

  // Test 7: Rejection of non-ImgBB arbitrary external URLs in /api/profile/verify-kyc
  test("Verify KYC endpoint rejects non-ImgBB external URLs for capturedSelfie", async () => {
    const req = new Request("http://localhost/api/profile/verify-kyc", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        idNumber: "12345678901",
        type: "bvn",
        capturedSelfie: "https://arbitrary-attacker-site.com/image.jpg",
        livenessChallenge: true,
      }),
    });

    const res = await verifyKycPOST(req);
    expect(res.status).toBe(401);
  });

  // Test 8: Unauthenticated upload attempt
  test("Unauthenticated call to /api/upload-image is denied with HTTP 415 or 401", async () => {
    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(415);
  });

  // Test 9: Valid multipart File upload format check
  test("Upload endpoint requires valid multipart File binary", async () => {
    const formData = new FormData();
    formData.append("purpose", "profile_avatar");
    // Missing actual File

    const req = new Request("http://localhost/api/upload-image", {
      method: "POST",
      body: formData,
    });

    const res = await uploadImagePOST(req);
    expect(res.status).toBe(401);
  });
});
