import request from "supertest";
import app from "../app";
import { env } from "../config/env";

// High-fidelity mocked Firebase Admin inside Jest.mock to ensure hoisting works flawlessly
jest.mock("../config/firebase", () => {
  const mGet = jest.fn();
  const mSet = jest.fn();
  const mDelete = jest.fn();
  const mUpdate = jest.fn();

  const mDoc = jest.fn((id) => ({
    _path: id,
    get: mGet,
    set: mSet,
    delete: mDelete,
    update: mUpdate,
  }));

  const mCollection = jest.fn((colName) => ({
    _colName: colName,
    doc: (docId: string) => {
      const d = mDoc(docId);
      d._path = `${colName}/${docId}`;
      return d;
    },
    where: jest.fn(() => ({
      get: jest.fn(() => ({ empty: true, docs: [] })),
    })),
    add: jest.fn(async () => ({ id: "mock-id" })),
  }));

  const mDb: any = {
    collection: mCollection,
    runTransaction: jest.fn(async (cb) => {
      const mockTx = {
        get: jest.fn(async (ref) => {
          return {
            exists: true,
            data: () => {
              if (ref._path === "users/test-security-user-123") {
                return mDb._userState;
              }
              if (ref._path === "kyc_submissions/test-security-user-123") {
                return mDb._submissionState;
              }
              return {};
            }
          };
        }),
        update: jest.fn(),
        set: jest.fn(),
      };
      return cb(mockTx);
    }),
    _userState: {},
    _submissionState: {},
    _mGet: mGet,
    _mSet: mSet,
    _mDelete: mDelete,
    _mUpdate: mUpdate,
  };

  return {
    __esModule: true,
    adminDb: mDb,
    default: mDb,
    hasAdminCredentialsActive: true,
  };
});

import adminDb from "../config/firebase";

describe("KYC, Admin Verification & Transaction Access Control Security Suite", () => {
  const getTestApiKey = () => env.GATEWAY_API_KEYS[0];
  const testUserId = "test-security-user-123";
  const testAdminId = "system-admin-999";

  const mDb = adminDb as any;

  beforeEach(() => {
    jest.clearAllMocks();
    mDb._userState = {};
    mDb._submissionState = {};
    mDb._mGet.mockReset();
    mDb._mSet.mockReset();
    mDb._mDelete.mockReset();
    mDb._mUpdate.mockReset();
  });

  describe("KYC Submission -> PENDING", () => {
    it("should allow a user to submit KYC details but place them strictly in a PENDING status", async () => {
      // Setup mock returns
      mDb._mGet.mockResolvedValue({
        exists: false,
        data: () => null,
      });

      const res = await request(app)
        .post("/api/profile/verify-kyc")
        .set("X-API-Key", getTestApiKey())
        .send({
          userId: testUserId,
          firstName: "John",
          lastName: "Doe",
          documentType: "bvn",
          documentNumber: "12345678901",
          faceConfidence: 0.95,
          email: "test-sec@example.com",
          phone: "+2348011223344",
          capturedSelfie: "data:image/jpeg;base64,mockselfiedatahere...",
          livenessChallenge: "blink"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe("PENDING");

      // Verify user document was written as PENDING
      expect(mDb._mSet).toHaveBeenCalledWith(
        expect.objectContaining({
          kycStatus: "PENDING",
          kycDocumentType: "bvn",
        }),
        { merge: true }
      );
    });
  });

  describe("Transaction Access Control Enforcement", () => {
    it("should strictly block sensitive financial transactions if kycStatus is PENDING", async () => {
      // 1. Setup user as PENDING in mock state
      mDb._userState = {
        uid: testUserId,
        email: "test-sec@example.com",
        balance: 10000,
        kycStatus: "PENDING",
      };

      mDb._mGet.mockResolvedValue({
        exists: true,
        data: () => mDb._userState,
      });

      // 2. Attempt Transfer via S2S
      const res = await request(app)
        .post("/api/flutterwave/transfer")
        .set("X-API-Key", getTestApiKey())
        .send({
          userId: testUserId,
          amount: 200,
          account_number: "2345678901",
          account_bank: "035",
          beneficiary_name: "Sarah Connor",
          currency: "NGN",
          reference: `test-trf-${Date.now()}`
        });

      // Assert S2S double protection blocks the transaction
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Forbidden: Account verification");
    });

    it("should strictly block sensitive financial transactions if kycStatus is REJECTED", async () => {
      // 1. Setup user as REJECTED in mock state
      mDb._userState = {
        uid: testUserId,
        email: "test-sec@example.com",
        balance: 10000,
        kycStatus: "REJECTED",
      };

      mDb._mGet.mockResolvedValue({
        exists: true,
        data: () => mDb._userState,
      });

      // 2. Attempt Transfer
      const res = await request(app)
        .post("/api/flutterwave/transfer")
        .set("X-API-Key", getTestApiKey())
        .send({
          userId: testUserId,
          amount: 200,
          account_number: "2345678901",
          account_bank: "035",
          beneficiary_name: "Sarah Connor",
          currency: "NGN",
          reference: `test-trf-${Date.now()}`
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Forbidden: Account verification");
    });
  });

  describe("Admin S2S Endpoints Security & Escalation Blockers", () => {
    it("should deny access to KYC approve endpoint if standard/non-admin credentials are used", async () => {
      const res = await request(app)
        .post("/api/admin/kyc/approve")
        .send({ targetUid: testUserId });

      expect(res.status).toBe(401);
    });

    it("should allow authorized S2S API Key to approve KYC and atomically set status to APPROVED", async () => {
      // Setup pending submission
      mDb._userState = {
        uid: testUserId,
        email: "test-sec@example.com",
        balance: 1000,
        kycStatus: "PENDING",
      };
      mDb._submissionState = {
        userId: testUserId,
        firstName: "John",
        lastName: "Doe",
        documentType: "bvn",
        documentNumber: "12345678901",
        status: "PENDING",
      };

      mDb._mGet.mockImplementation(async function(this: any) {
        if (this._path === "wallet_accounts/test-security-user-123") {
          return { exists: true, data: () => ({ accountNumber: "123456", bankName: "Wema Bank" }) };
        }
        return { exists: true, data: () => ({}) };
      });

      // Admin approve
      const res = await request(app)
        .post("/api/admin/kyc/approve")
        .set("X-API-Key", getTestApiKey())
        .send({
          targetUid: testUserId,
          adminId: testAdminId
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("APPROVED");
    });

    it("should allow authorized S2S API Key to reject KYC and atomically set status to REJECTED", async () => {
      // Setup pending submission
      mDb._userState = {
        uid: testUserId,
        email: "test-sec@example.com",
        balance: 1000,
        kycStatus: "PENDING",
      };
      mDb._submissionState = {
        userId: testUserId,
        firstName: "John",
        lastName: "Doe",
        documentType: "bvn",
        documentNumber: "12345678901",
        status: "PENDING",
        hashedId: "somehashedid"
      };

      mDb._mGet.mockResolvedValue({
        exists: true,
        data: () => ({ hashedId: "somehashedid" }),
      });

      // Admin reject
      const res = await request(app)
        .post("/api/admin/kyc/reject")
        .set("X-API-Key", getTestApiKey())
        .send({
          targetUid: testUserId,
          adminId: testAdminId,
          reason: "Mismatch of identity details."
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("REJECTED");
    });
  });
});
