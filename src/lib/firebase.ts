import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCuolap_m6yXWEo2csYMyGhEshsHnd1aEQ",
  authDomain: "e-tech-global-hub.firebaseapp.com",
  projectId: "e-tech-global-hub",
  storageBucket: "e-tech-global-hub.firebasestorage.app",
  messagingSenderId: "228699271017",
  appId: "1:228699271017:web:97043359d72b08e99917f8",
  measurementId: "G-QL3VDSLC9J"
};

// Initialize Firebase
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
