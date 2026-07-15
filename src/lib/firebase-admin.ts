import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

let adminApp: App;

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = process.env.FIREBASE_PRIVATE_KEY;

if (privateKey) {
  privateKey = privateKey.replace(/\\n/g, "\n");
}

function getCredentials() {
  if (serviceAccountJson) {
    try {
      const parsed = JSON.parse(serviceAccountJson);
      return cert(parsed);
    } catch (e) {
      console.error("[Firebase Admin Init] Error parsing FIREBASE_SERVICE_ACCOUNT_KEY JSON string:", e);
    }
  }

  if (projectId && clientEmail && privateKey) {
    return cert({
      projectId,
      clientEmail,
      privateKey,
    });
  }

  // Fallback to application default credentials in environments like Google Cloud/Firebase Hosting
  return undefined;
}

const apps = getApps();

if (apps.length > 0) {
  adminApp = apps[0];
} else {
  const credential = getCredentials();
  if (credential) {
    adminApp = initializeApp({
      credential,
    });
    console.log("[Firebase Admin] Initialized with explicit service account credentials.");
  } else {
    // If no explicit credentials, initialize empty (for local emulators or ADC fallback)
    adminApp = initializeApp();
    console.log("[Firebase Admin] Initialized with default server credentials.");
  }
}

const adminDb = getFirestore(adminApp);

export { adminApp, adminDb };
