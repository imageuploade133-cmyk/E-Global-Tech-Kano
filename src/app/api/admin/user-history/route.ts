import { NextResponse } from "next/server";
import { verifyAdminAuth } from "@/lib/admin-auth";
import { adminDb } from "@/lib/firebase-admin";

export async function GET(req: Request) {
  try {
    const { uid, isAdmin } = await verifyAdminAuth(req);

    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden: Administrative access required." }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    if (!search) {
      return NextResponse.json({ success: true, message: "Enter search parameter." });
    }

    // Playtesting mock bypass
    if (uid === "mock-admin-uid") {
      const mockUser = {
        uid: "mock-user-1",
        name: "JULES VERNE",
        email: "jules@example.com",
        phoneNumber: "+2348011223344",
        role: "admin",
        kycStatus: "APPROVED",
        balance: 750000,
        bonusBalance: 12000,
        usdBalance: 2500,
        xofBalance: 320000,
        createdAt: new Date().toISOString()
      };

      const mockTransactions = [
        {
          id: "mock-tx-1",
          amount: 25000,
          type: "TRANSFER",
          status: "SUCCESSFUL",
          description: "Transfer to Opay account STEVE",
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          reference: "tx-opay-123"
        },
        {
          id: "mock-tx-2",
          amount: 50000,
          type: "DEPOSIT",
          status: "SUCCESSFUL",
          description: "Flutterwave Wallet Funding",
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          reference: "tx-flw-fund-456"
        }
      ];

      return NextResponse.json({
        success: true,
        user: mockUser,
        transactions: mockTransactions,
        investments: []
      });
    }

    // 1. SECURE LOW COST EQUALITY LOOKUP
    let userDoc: any = null;
    let targetUid = "";

    if (search.includes("@")) {
      const emailSnap = await adminDb.collection("users")
        .where("email", "==", search)
        .limit(1)
        .get();
      if (!emailSnap.empty) {
        userDoc = emailSnap.docs[0];
        targetUid = userDoc.id;
      }
    } else {
      // Search exactly by phone number first
      const phoneSnap = await adminDb.collection("users")
        .where("phoneNumber", "==", search)
        .limit(1)
        .get();
      if (!phoneSnap.empty) {
        userDoc = phoneSnap.docs[0];
        targetUid = userDoc.id;
      } else {
        // Search exactly by BVN
        const bvnSnap = await adminDb.collection("users")
          .where("bvn", "==", search)
          .limit(1)
          .get();
        if (!bvnSnap.empty) {
          userDoc = bvnSnap.docs[0];
          targetUid = userDoc.id;
        } else {
          // Check phone variations
          const variations = [
            search,
            `+234${search.startsWith("0") ? search.slice(1) : search}`,
            `+227${search.startsWith("0") ? search.slice(1) : search}`,
          ];
          const phoneSnap2 = await adminDb.collection("users")
            .where("phoneNumber", "in", variations)
            .limit(1)
            .get();
          if (!phoneSnap2.empty) {
            userDoc = phoneSnap2.docs[0];
            targetUid = userDoc.id;
          }
        }
      }
    }

    if (!userDoc) {
      return NextResponse.json({ success: false, error: "No user found matching this email, phone number, or BVN." });
    }

    const userData = userDoc.data();

    // Fetch multi-currency wallet balances
    let usdBalance = 0;
    let xofBalance = 0;
    try {
      const [usdDoc, xofDoc] = await Promise.all([
        adminDb.collection("wallets").doc(`${targetUid}_USD`).get(),
        adminDb.collection("wallets").doc(`${targetUid}_XOF`).get()
      ]);
      if (usdDoc.exists) usdBalance = Number(usdDoc.data()?.balance) || 0;
      if (xofDoc.exists) xofBalance = Number(xofDoc.data()?.balance) || 0;
    } catch (walletErr: any) {
      console.warn(`[Admin User History GET] Failed to fetch wallets for user=${targetUid}:`, walletErr.message);
    }

    const sanitizedUser = {
      uid: targetUid,
      name: userData.name || userData.displayName || `${userData.firstName || ""} ${userData.lastName || ""}`.trim() || "SYSTEM USER",
      email: userData.email || "No Email",
      phoneNumber: userData.phoneNumber || "No Phone",
      role: userData.role || "user",
      kycStatus: userData.kycStatus || "UNVERIFIED",
      balance: userData.balance || 0,
      bonusBalance: userData.bonusBalance || userData.bonus || 0,
      usdBalance,
      xofBalance,
      createdAt: userData.createdAt || new Date().toISOString()
    };

    const limitParam = Math.max(1, Number(searchParams.get("limit")) || 20);

    // 2. Fetch transaction records securely from Firestore matching targetUid (limited to low cost count)
    const txSnapshot = await adminDb.collection("transactions")
      .where("userId", "==", targetUid)
      .orderBy("createdAt", "desc")
      .limit(limitParam)
      .get();

    const transactions: any[] = [];
    txSnapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        amount: data.amount || 0,
        type: data.type || "TRANSACTION",
        status: data.status || "SUCCESSFUL",
        description: data.description || data.narration || "Wallet Transaction",
        createdAt: data.createdAt || new Date().toISOString(),
        reference: data.reference || data.tx_ref || doc.id
      });
    });

    // 3. Fetch investment records securely from Firestore matching targetUid (limited to low cost count)
    const invSnapshot = await adminDb.collection("investments")
      .where("userId", "==", targetUid)
      .orderBy("createdAt", "desc")
      .limit(limitParam)
      .get();

    const investments: any[] = [];
    invSnapshot.forEach((doc) => {
      const data = doc.data();
      investments.push({
        id: doc.id,
        amount: data.amount || 0,
        interestRate: data.interestRate || 0,
        status: data.status || "ACTIVE",
        createdAt: data.createdAt || new Date().toISOString(),
        maturesAt: data.maturesAt || new Date().toISOString(),
        description: data.description || "Fixed Deposit Savings Plan"
      });
    });

    return NextResponse.json({
      success: true,
      user: sanitizedUser,
      transactions,
      investments
    });

  } catch (err: any) {
    console.error("[Admin User History GET Exception]:", err.message);
    return NextResponse.json({ error: "Unauthorized or server exception", details: err.message }, { status: 401 });
  }
}
