import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";
import { NotificationService } from "@/services/notification-service";

export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    // Mock playtesting response
    if (uid === "mock-admin-uid") {
      const mockPendingKyc = [
        {
          uid: "mock-kyc-1",
          name: "CHIDI OKEKE",
          email: "chidi@example.com",
          phoneNumber: "+2348033445566",
          kycType: "bvn",
          kycNumber: "22223333444",
          kycStatus: "PENDING",
          submittedAt: new Date().toISOString()
        },
        {
          uid: "mock-kyc-2",
          name: "AMINA BELLO",
          email: "amina@example.com",
          phoneNumber: "+2348122334455",
          kycType: "nin",
          kycNumber: "55556666777",
          kycStatus: "PENDING",
          submittedAt: new Date().toISOString()
        }
      ];
      return NextResponse.json({ success: true, pendingUsers: mockPendingKyc });
    }

    // LOW READS: Query only users whose kycStatus is strictly PENDING with a small page limit (max 50 users)
    const pendingSnap = await adminDb.collection("users")
      .where("kycStatus", "==", "PENDING")
      .limit(50)
      .get();

    const pendingUsers = pendingSnap.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        name: data.name || data.displayName || `${data.firstName || ""} ${data.lastName || ""}`.trim() || "SUBMITTED USER",
        email: data.email || "",
        phoneNumber: data.phoneNumber || "",
        kycType: data.kycType || "bvn",
        kycNumber: data.kycNumber || data.bvn || data.nin || "•••••••••••",
        kycStatus: "PENDING",
        submittedAt: data.kycSubmittedAt || data.createdAt || new Date().toISOString()
      };
    });

    return NextResponse.json({ success: true, pendingUsers });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin KYC GET API] Error:", error.message);
    return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const { action, targetUid, reason } = await req.json();

    if (!targetUid) {
      return NextResponse.json({ error: "Missing target user identifier." }, { status: 400 });
    }

    if (uid === "mock-admin-uid") {
      return NextResponse.json({
        success: true,
        message: `Mock User KYC state marked as ${action === "approve" ? "VERIFIED" : "FAILED"} successfully!`
      });
    }

    if (action === "approve") {
      // 1. Update user profile to verified in Firestore
      await adminDb.collection("users").doc(targetUid).update({
        kycStatus: "VERIFIED",
        kycVerifiedAt: new Date().toISOString()
      });

      // 2. DISPATCH NOTIFICATION to user once approved (Atomic push + in-app log)
      try {
        await NotificationService.sendPushNotification(targetUid, {
          title: "Identity Verified successfully! 🎉",
          body: "Congratulations! Your identity documents (KYC verification) have been approved. You now have full access to virtual cards and virtual accounts.",
          type: "security"
        });
        console.log(`[Admin KYC] Dispatch approved notification successfully for user=${targetUid}`);
      } catch (notifyErr: any) {
        console.error("[Admin KYC Notification Error] Failed to send push:", notifyErr.message);
      }

      return NextResponse.json({
        success: true,
        message: "User KYC successfully verified and notification dispatched!"
      });

    } else if (action === "reject") {
      // 1. Update user profile to failed in Firestore
      await adminDb.collection("users").doc(targetUid).update({
        kycStatus: "FAILED",
        kycRejectionReason: reason || "Provided identity details mismatch.",
        kycRejectedAt: new Date().toISOString()
      });

      // 2. DISPATCH NOTIFICATION to user on rejection (Atomic push + in-app log)
      try {
        await NotificationService.sendPushNotification(targetUid, {
          title: "KYC Verification Rejected",
          body: `Identity verification failed: ${reason || "Provided BVN/NIN name mismatch"}. Please try again inside profile settings.`,
          type: "security"
        });
        console.log(`[Admin KYC] Dispatch rejected notification successfully for user=${targetUid}`);
      } catch (notifyErr: any) {
        console.error("[Admin KYC Notification Error] Failed to send push:", notifyErr.message);
      }

      return NextResponse.json({
        success: true,
        message: "User KYC rejected and notification dispatched successfully."
      });

    } else {
      return NextResponse.json({ error: "Invalid KYC action request." }, { status: 400 });
    }

  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin KYC POST API] Error:", error.message);
    return NextResponse.json({ error: "Operation failed", details: error.message }, { status: 500 });
  }
}
