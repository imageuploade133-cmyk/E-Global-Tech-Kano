import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";
import { NotificationService } from "@/services/notification-service";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "users.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database uninitialized" }, { status: 500 });
    }

    const snap = await adminDb.collection("tier_upgrade_requests").orderBy("createdAt", "desc").limit(100).get();
    const requests = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    const metrics = {
      totalRequests: requests.length,
      pendingCount: requests.filter((r: any) => r.status === "PENDING").length,
      approvedCount: requests.filter((r: any) => r.status === "APPROVED").length,
      rejectedCount: requests.filter((r: any) => r.status === "REJECTED").length,
    };

    return NextResponse.json({
      success: true,
      requests,
      metrics,
    });
  } catch (err: any) {
    console.error("[Admin Limit Requests GET] Error:", err.message);
    return NextResponse.json({ error: "Failed to fetch limit upgrade requests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "users.manage");
    if (!perm.authorized) {
      return perm.response!;
    }

    if (!adminDb) {
      return NextResponse.json({ error: "Database uninitialized" }, { status: 500 });
    }

    const body = await req.json() || {};
    const { action, userId, assignedTier = "Tier 2", dailyLimit, singleLimit, rejectionReason = "" } = body;

    if (!userId) {
      return NextResponse.json({ error: "Target User ID is required." }, { status: 400 });
    }

    const adminEmail = perm.auth?.email || "admin@system";
    const nowIso = new Date().toISOString();

    if (action === "approve") {
      const numDaily = Number(dailyLimit) || (assignedTier === "Tier 3" ? 50000000 : assignedTier === "Tier 2" ? 5000000 : 500000);
      const numSingle = Number(singleLimit) || (assignedTier === "Tier 3" ? 10000000 : assignedTier === "Tier 2" ? 2000000 : 200000);

      // Update upgrade request document
      await adminDb.collection("tier_upgrade_requests").doc(userId).set({
        status: "APPROVED",
        assignedTier,
        dailyLimit: numDaily,
        singleLimit: numSingle,
        approvedAt: nowIso,
        approvedBy: adminEmail,
        updatedAt: nowIso,
      }, { merge: true });

      // Update user document
      await adminDb.collection("users").doc(userId).set({
        tier: assignedTier,
        dailyLimit: numDaily,
        singleLimit: numSingle,
        limitUpdatedAt: nowIso,
        limitUpdatedBy: adminEmail,
      }, { merge: true });

      // Dispatch push notification
      await NotificationService.sendPushNotification(userId, {
        title: "🎉 Tier Upgrade Approved!",
        body: `Congratulations! Your account has been upgraded to ${assignedTier}. Your new daily limit is ₦${numDaily.toLocaleString("en-NG")}.`,
        type: "system",
        url: "/profile",
      });

      return NextResponse.json({
        success: true,
        message: `Limit upgrade approved successfully! User set to ${assignedTier} with ₦${numDaily.toLocaleString("en-NG")} daily limit.`,
      });
    } else if (action === "reject") {
      await adminDb.collection("tier_upgrade_requests").doc(userId).set({
        status: "REJECTED",
        rejectionReason: rejectionReason.trim() || "Information provided could not be verified.",
        rejectedAt: nowIso,
        rejectedBy: adminEmail,
        updatedAt: nowIso,
      }, { merge: true });

      await NotificationService.sendPushNotification(userId, {
        title: "Tier Upgrade Request Update",
        body: `Your tier upgrade request was not approved: ${rejectionReason || "Information provided could not be verified."}`,
        type: "system",
        url: "/profile",
      });

      return NextResponse.json({
        success: true,
        message: "Tier upgrade request rejected.",
      });
    } else {
      return NextResponse.json({ error: `Invalid action '${action}'.` }, { status: 400 });
    }
  } catch (err: any) {
    console.error("[Admin Limit Requests POST] Error:", err.message);
    return NextResponse.json({ error: "Failed to process limit request action" }, { status: 500 });
  }
}
