#!/usr/bin/env ts-node
/**
 * Production-Grade Firebase Administrative Management Script.
 * Used to securely set or revoke custom admin claims (`admin: true`) for specific users.
 *
 * Usage:
 *   npx ts-node scripts/setAdmin.ts --email admin@example.com --grant
 *   npx ts-node scripts/setAdmin.ts --email admin@example.com --revoke
 *   npx ts-node scripts/setAdmin.ts --uid UID_HERE --grant
 */

import { initializeApp, cert, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// Initialize Firebase Admin SDK using local environment service accounts
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID || "e-tech-global-hub";
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

function initAdmin() {
  if (getApps().length > 0) return;

  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      initializeApp({ credential: cert(parsed), projectId });
      console.log(`[Firebase Admin CLI] Initialized with Service Account JSON. Project: ${projectId}`);
      return;
    } catch (e) {
      console.error("[Firebase Admin CLI] Parsing Service Account Key JSON failed.");
    }
  }

  if (projectId && clientEmail && privateKey) {
    initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
      projectId
    });
    console.log(`[Firebase Admin CLI] Initialized with credentials. Project: ${projectId}`);
  } else {
    // Fallback to local default / environment
    initializeApp({ projectId });
    console.log(`[Firebase Admin CLI] Initialized with fallback projectId: ${projectId}`);
  }
}

async function run() {
  initAdmin();
  const auth = getAuth();
  const db = getFirestore();

  const args = process.argv.slice(2);
  const emailIndex = args.indexOf("--email");
  const uidIndex = args.indexOf("--uid");
  const grant = args.includes("--grant");
  const revoke = args.includes("--revoke");

  let email = emailIndex !== -1 ? args[emailIndex + 1] : null;
  let uid = uidIndex !== -1 ? args[uidIndex + 1] : null;

  if (!email && !uid) {
    console.error(`\n❌ Error: Please provide either --email <email> or --uid <uid>\n`);
    console.log("Usage Examples:");
    console.log("  npx ts-node scripts/setAdmin.ts --email test@test.com --grant");
    console.log("  npx ts-node scripts/setAdmin.ts --uid user_12345 --revoke\n");
    process.exit(1);
  }

  if (!grant && !revoke) {
    console.error(`\n❌ Error: Please specify either --grant or --revoke to set claims.\n`);
    process.exit(1);
  }

  try {
    let userRecord;
    if (email) {
      console.log(`🔍 Searching for user by email: ${email}...`);
      userRecord = await auth.getUserByEmail(email.trim());
    } else if (uid) {
      console.log(`🔍 Searching for user by UID: ${uid}...`);
      userRecord = await auth.getUser(uid.trim());
    }

    if (!userRecord) {
      throw new Error("User record could not be found.");
    }

    const targetUid = userRecord.uid;
    const adminClaim = grant && !revoke;

    console.log(`✨ User resolved!`);
    console.log(`   UID: ${targetUid}`);
    console.log(`   Email: ${userRecord.email || "none"}`);
    console.log(`   Display Name: ${userRecord.displayName || "none"}`);
    console.log(`   Current Claims: ${JSON.stringify(userRecord.customClaims || {})}`);

    console.log(`\n⚙️  Applying claim update: { admin: ${adminClaim} }...`);

    // Set Custom Claims on Firebase Authentication
    await auth.setCustomUserClaims(targetUid, {
      ...userRecord.customClaims,
      admin: adminClaim
    });

    // Mirror/write the role field synchronously in Firestore for fallback display/queries
    const userRef = db.collection("users").doc(targetUid);
    await userRef.set({
      role: adminClaim ? "admin" : "user",
      updatedAt: new Date().toISOString()
    }, { merge: true });

    // Fetch updated user to verify
    const updatedUser = await auth.getUser(targetUid);
    console.log(`\n✅ Success! Claims applied and verified successfully.`);
    console.log(`   New Claims: ${JSON.stringify(updatedUser.customClaims)}`);
    console.log(`   Firestore Role: ${adminClaim ? "admin" : "user"}\n`);

  } catch (err: any) {
    console.error(`\n❌ Administrative update failed:`, err.message || err);
    process.exit(1);
  }
}

run().catch((err) => {
  console.error("CLI Execution failed:", err);
  process.exit(1);
});
