import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "investments.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }
    const { uid } = perm.auth;

    // Playtesting mock bypass
    if (uid === "mock-admin-uid") {
      const mockInvestments = [
        {
          id: "mock-inv-1",
          userId: "mock-user-1",
          userName: "JULES VERNE",
          userEmail: "jules@example.com",
          amount: 500000,
          interestRate: 15,
          status: "ACTIVE",
          createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          maturesAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
          type: "fixed_deposit",
          description: "Fixed Deposit 90-Days Plan"
        },
        {
          id: "mock-inv-2",
          userId: "mock-user-2",
          userName: "STEVE COLLINS",
          userEmail: "steve@example.com",
          amount: 250000,
          interestRate: 12,
          status: "SETTLED",
          createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
          maturesAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          claimedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          type: "fixed_deposit",
          description: "Fixed Deposit 90-Days Plan"
        }
      ];

      return NextResponse.json({
        success: true,
        investments: mockInvestments
      });
    }

    // Query all investments in the system
    const snapshot = await adminDb
      .collection("investments")
      .orderBy("createdAt", "desc")
      .get();

    const rawInvestments: any[] = [];
    snapshot.forEach((doc) => {
      rawInvestments.push({ id: doc.id, ...doc.data() });
    });

    // Filter to only display fixed deposits
    const fdInvestments = rawInvestments.filter(
      (inv) => inv.type === "fixed_deposit" || inv.planType === "fixed_deposit"
    );

    // Enrich investments with user profiles (names and emails) safely using local caching
    const usersCache: Record<string, { name: string; email: string; phone: string }> = {};
    const enrichedInvestments: any[] = [];

    for (const inv of fdInvestments) {
      const targetUid = inv.userId;
      if (!targetUid) continue;

      if (!usersCache[targetUid]) {
        try {
          const userDoc = await adminDb.collection("users").doc(targetUid).get();
          if (userDoc.exists) {
            const uData = userDoc.data() || {};
            usersCache[targetUid] = {
              name: uData.name || uData.displayName || `${uData.firstName || ""} ${uData.lastName || ""}`.trim() || "Unknown User",
              email: uData.email || "No Email",
              phone: uData.phoneNumber || "No Phone"
            };
          } else {
            usersCache[targetUid] = { name: "Deleted Profile", email: "No Email", phone: "No Phone" };
          }
        } catch {
          usersCache[targetUid] = { name: "System User", email: "No Email", phone: "No Phone" };
        }
      }

      const meta = usersCache[targetUid];
      enrichedInvestments.push({
        ...inv,
        userName: meta.name,
        userEmail: meta.email,
        userPhone: meta.phone,
        description: inv.description || "Fixed Deposit Savings Plan"
      });
    }

    return NextResponse.json({
      success: true,
      investments: enrichedInvestments
    });

  } catch (err: any) {
    console.error("[Admin Investments GET Exception]:", err.message);
    return NextResponse.json({ error: "Unauthorized or server exception", details: err.message }, { status: 401 });
  }
}
