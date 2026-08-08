import { Router, Request, Response } from "express";
import { KycService } from "../services/kycService";
import { gatewayAuthMiddleware } from "../middleware/auth";
import logger from "../config/logger";

const router = Router();

/**
 * Endpoint to securely process user KYC verification and liveness challenges.
 * This endpoint executes all Firestore writes and places the submission into a PENDING state.
 */
router.post("/verify-kyc", gatewayAuthMiddleware, async (req: Request, res: Response) => {
  const reqId = req.requestId;
  try {
    const {
      userId,
      firstName,
      lastName,
      documentType,
      documentNumber,
      faceConfidence,
      email,
      phone,
      capturedSelfie,
      livenessChallenge,
    } = req.body;

    if (!userId || !firstName || !lastName || !documentType || !documentNumber) {
      res.status(400).json({
        success: false,
        message: "Missing required KYC parameters: userId, firstName, lastName, documentType, documentNumber are required.",
      });
      return;
    }

    if (documentType !== "bvn" && documentType !== "nin") {
      res.status(400).json({
        success: false,
        message: "Invalid documentType. Must be either 'bvn' or 'nin'.",
      });
      return;
    }

    const submissionResult = await KycService.submitKyc({
      userId,
      firstName,
      lastName,
      documentType,
      documentNumber,
      faceConfidence: faceConfidence || 0.95,
      email: email || "",
      phone: phone || "",
      capturedSelfie,
      livenessChallenge,
    });

    res.status(200).json({
      success: true,
      message: "KYC submitted successfully. Your verification is now PENDING administrator approval.",
      data: submissionResult,
    });
  } catch (error: any) {
    logger.error(`[ProfileRoutes] verify-kyc failure: ${error.message} | reqId=${reqId}`);

    // Send KYC Rejected Notification (Only if not a duplicate validation failure)
    try {
      const { NotificationService } = require("../services/notificationService");
      if (req.body.userId) {
        await NotificationService.sendPushNotification(req.body.userId, {
          title: "❌ KYC Identity Submission Failed",
          body: `Identity submission failed: ${error.message || "Please check your document details."}`,
          type: "security",
          url: "/profile",
        });
      }
    } catch (notifErr: any) {
      logger.error(`[ProfileRoutes Exception] Failed to send KYC submission failure notification: ${notifErr.message}`);
    }

    res.status(400).json({
      success: false,
      message: error.message || "Identity verification failed.",
    });
  }
});

export default router;
