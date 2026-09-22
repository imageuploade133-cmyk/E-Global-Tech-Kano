import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { requireAdminPermission } from "@/lib/admin-permissions";

export async function GET(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "users.view");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }
    const { uid } = perm.auth;

    const { searchParams } = new URL(req.url);
    const searchTerm = searchParams.get("search")?.trim().toLowerCase() || "";
    const statusFilter = searchParams.get("status")?.toUpperCase() || "ALL"; // ALL, ACTIVE, DEACTIVATED
    const limitParam = parseInt(searchParams.get("limit") || "20", 10);
    const pageSize = Math.min(Math.max(isNaN(limitParam) ? 20 : limitParam, 1), 100);
    const lastDocId = searchParams.get("startAfter") || searchParams.get("lastDocId") || null;

    // Mock playtesting response
    if (uid === "mock-admin-uid") {
      const mockVirtualAccounts = [
        {
          uid: "mock-user-1",
          name: "JULES VERNE",
          email: "jules@example.com",
          phoneNumber: "+2348011223344",
          virtualAccountNumber: "9921473281",
          virtualAccountBankName: "Wema Bank",
          virtualAccountName: "E-GLOBAL / JULES VERNE",
          virtualAccountProvider: "flutterwave",
          isActive: true,
          deactivatedAt: null,
          deactivatedBy: null,
          kycStatus: "VERIFIED",
          balance: 750000,
          createdAt: new Date().toISOString(),
        },
        {
          uid: "mock-user-2",
          name: "STEVE COLLINS",
          email: "steve@example.com",
          phoneNumber: "+2348122334455",
          virtualAccountNumber: "7033123456",
          virtualAccountBankName: "GTBank (Squadco)",
          virtualAccountName: "E-GLOBAL / STEVE COLLINS",
          virtualAccountProvider: "squad",
          isActive: false,
          deactivatedAt: new Date(Date.now() - 86400000).toISOString(),
          deactivatedBy: "admin@eglobal.com",
          kycStatus: "VERIFIED",
          balance: 45000,
          createdAt: new Date(Date.now() - 172800000).toISOString(),
        },
      ];

      let filtered = mockVirtualAccounts;

      if (statusFilter === "ACTIVE") {
        filtered = filtered.filter((a) => a.isActive);
      } else if (statusFilter === "DEACTIVATED") {
        filtered = filtered.filter((a) => !a.isActive);
      }

      if (searchTerm) {
        filtered = filtered.filter(
          (a) =>
            a.name.toLowerCase().includes(searchTerm) ||
            a.email.toLowerCase().includes(searchTerm) ||
            a.phoneNumber.includes(searchTerm) ||
            a.virtualAccountNumber.includes(searchTerm) ||
            a.virtualAccountBankName.toLowerCase().includes(searchTerm)
        );
      }

      const activeCount = mockVirtualAccounts.filter((a) => a.isActive).length;
      const deactivatedCount = mockVirtualAccounts.filter((a) => !a.isActive).length;

      return NextResponse.json({
        success: true,
        virtualAccounts: filtered,
        counts: {
          total: mockVirtualAccounts.length,
          active: activeCount,
          deactivated: deactivatedCount,
        },
        pagination: {
          limit: pageSize,
          hasNextPage: false,
          lastDocId: null,
        },
      });
    }

    // Get count aggregations to avoid fetching all documents for metrics
    const countsPromise = (async () => {
      try {
        const [totalSnap, deactivatedSnap] = await Promise.all([
          adminDb.collection("users").count().get(),
          adminDb.collection("users").where("virtualAccountActive", "==", false).count().get(),
        ]);
        const total = totalSnap.data().count;
        const deactivated = deactivatedSnap.data().count;
        const active = Math.max(0, total - deactivated);
        return { total, active, deactivated };
      } catch (err) {
        console.warn("[Admin Virtual Accounts] Count aggregation fallback:", err);
        return { total: 0, active: 0, deactivated: 0 };
      }
    })();

    const rawUsers: any[] = [];
    let lastFetchedDocId: string | null = null;
    let hasNextPage = false;

    if (searchTerm) {
      if (searchTerm.includes("@")) {
        // Query by email
        const snap = await adminDb
          .collection("users")
          .where("email", "==", searchTerm)
          .limit(pageSize)
          .get();
        snap.forEach((doc) => rawUsers.push({ uid: doc.id, ...doc.data() }));
      } else {
        // Query across phone number, account number, BVN, or exact name match
        const queries = [
          adminDb.collection("users").where("phoneNumber", "==", searchTerm).limit(pageSize).get(),
          adminDb.collection("users").where("virtualAccountNumber", "==", searchTerm).limit(pageSize).get(),
          adminDb.collection("users").where("accountNumber", "==", searchTerm).limit(pageSize).get(),
          adminDb.collection("users").where("bvn", "==", searchTerm).limit(pageSize).get(),
          adminDb.collection("users").where("name", "==", searchTerm.toUpperCase()).limit(pageSize).get(),
        ];

        const snaps = await Promise.all(queries);
        snaps.forEach((snap) => {
          snap.forEach((doc) => {
            if (!rawUsers.some((u) => u.uid === doc.id)) {
              rawUsers.push({ uid: doc.id, ...doc.data() });
            }
          });
        });

        // Substring / partial fallback query across loaded documents if no exact index hit
        if (rawUsers.length === 0) {
          const rawDigits = searchTerm.replace(/\D/g, "");
          if (rawDigits.length >= 6) {
            const digitVariations = [
              searchTerm,
              rawDigits,
              `+234${rawDigits.startsWith("0") ? rawDigits.slice(1) : rawDigits}`,
              `0${rawDigits}`,
            ];

            const fallbackSnap = await adminDb
              .collection("users")
              .where("phoneNumber", "in", digitVariations)
              .limit(pageSize)
              .get();

            fallbackSnap.forEach((doc) => {
              if (!rawUsers.some((u) => u.uid === doc.id)) {
                rawUsers.push({ uid: doc.id, ...doc.data() });
              }
            });
          }
        }
      }
    } else {
      // Default / Filtered paginated query using Firestore cursors
      let query = adminDb.collection("users").orderBy("createdAt", "desc");

      if (statusFilter === "DEACTIVATED") {
        query = adminDb
          .collection("users")
          .where("virtualAccountActive", "==", false)
          .orderBy("createdAt", "desc");
      }

      if (lastDocId) {
        const lastDocSnap = await adminDb.collection("users").doc(lastDocId).get();
        if (lastDocSnap.exists) {
          query = query.startAfter(lastDocSnap);
        }
      }

      // Query pageSize + 1 to check if there is a next page
      const snap = await query.limit(pageSize + 1).get();

      if (!snap.empty) {
        const docs = snap.docs;
        hasNextPage = docs.length > pageSize;
        const pageDocs = hasNextPage ? docs.slice(0, pageSize) : docs;

        pageDocs.forEach((doc) => {
          rawUsers.push({ uid: doc.id, ...doc.data() });
        });

        if (pageDocs.length > 0) {
          lastFetchedDocId = pageDocs[pageDocs.length - 1].id;
        }
      }
    }

    const counts = await countsPromise;

    let mappedVirtualAccounts = rawUsers.map((u) => {
      const userUid = u.uid || u.id;
      const acctNum = u.virtualAccountNumber || u.accountNumber || "";
      const bankName = u.virtualAccountBankName || u.bankName || "Wema Bank";
      const acctName = u.virtualAccountName || u.accountName || u.name || u.displayName || "";
      const isActive = u.virtualAccountActive !== false && u.virtualAccountStatus !== "INACTIVE";

      return {
        uid: userUid,
        name: u.name || u.displayName || `${u.firstName || ""} ${u.lastName || ""}`.trim() || "Customer",
        email: u.email || "",
        phoneNumber: u.phoneNumber || u.phone || "",
        virtualAccountNumber: acctNum,
        virtualAccountBankName: bankName,
        virtualAccountName: acctName,
        virtualAccountProvider: u.virtualAccountProvider || "flutterwave",
        isActive,
        deactivatedAt: u.virtualAccountDeactivatedAt || null,
        deactivatedBy: u.virtualAccountDeactivatedBy || null,
        kycStatus: u.kycStatus || "UNVERIFIED",
        balance: Number(u.balance) || 0,
        createdAt: u.createdAt || new Date().toISOString(),
      };
    });

    // In-memory status filter for search results or default statusFilter if not natively indexed
    if (statusFilter === "ACTIVE") {
      mappedVirtualAccounts = mappedVirtualAccounts.filter((a) => a.isActive);
    } else if (statusFilter === "DEACTIVATED" && searchTerm) {
      mappedVirtualAccounts = mappedVirtualAccounts.filter((a) => !a.isActive);
    }

    return NextResponse.json({
      success: true,
      virtualAccounts: mappedVirtualAccounts,
      counts,
      pagination: {
        limit: pageSize,
        hasNextPage,
        lastDocId: lastFetchedDocId,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Virtual Accounts GET Error]:", error.message);
    return NextResponse.json({ error: "Failed to fetch virtual accounts.", details: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const perm = await requireAdminPermission(req, "users.manage");
    if (!perm.authorized || !perm.auth) {
      return perm.response!;
    }
    const { email: adminEmail } = perm.auth;

    const body = await req.json();
    const { action, targetUid } = body;

    if (!targetUid) {
      return NextResponse.json({ error: "Missing target user identifier." }, { status: 400 });
    }

    const userRef = adminDb.collection("users").doc(targetUid);
    const walletRef = adminDb.collection("wallets").doc(`${targetUid}_NGN`);

    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ error: "Customer profile document not found." }, { status: 404 });
    }

    const uData = userSnap.data() || {};
    const userName = uData.name || uData.displayName || "Customer";
    const acctNum = uData.virtualAccountNumber || uData.accountNumber || "N/A";

    const nowIso = new Date().toISOString();

    if (action === "deactivate") {
      await userRef.update({
        virtualAccountActive: false,
        virtualAccountStatus: "INACTIVE",
        virtualAccountDeactivatedAt: nowIso,
        virtualAccountDeactivatedBy: adminEmail || "CPanel Admin",
      });

      const walletSnap = await walletRef.get();
      if (walletSnap.exists) {
        await walletRef.update({
          virtualAccountActive: false,
          virtualAccountStatus: "INACTIVE",
        });
      }

      return NextResponse.json({
        success: true,
        message: `Virtual account number ${acctNum} for customer "${userName}" has been successfully DEACTIVATED.`,
      });
    } else if (action === "reactivate") {
      await userRef.update({
        virtualAccountActive: true,
        virtualAccountStatus: "ACTIVE",
        virtualAccountReactivatedAt: nowIso,
        virtualAccountReactivatedBy: adminEmail || "CPanel Admin",
      });

      const walletSnap = await walletRef.get();
      if (walletSnap.exists) {
        await walletRef.update({
          virtualAccountActive: true,
          virtualAccountStatus: "ACTIVE",
        });
      }

      return NextResponse.json({
        success: true,
        message: `Virtual account number ${acctNum} for customer "${userName}" has been REACTIVATED successfully.`,
      });
    } else {
      return NextResponse.json({ error: "Invalid action specified." }, { status: 400 });
    }
  } catch (err: unknown) {
    const error = err as Error;
    console.error("[Admin Virtual Accounts POST Error]:", error.message);
    return NextResponse.json({ error: "Operation failed.", details: error.message }, { status: 500 });
  }
}
