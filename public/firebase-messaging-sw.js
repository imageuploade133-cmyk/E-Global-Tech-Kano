importScripts("https://www.gstatic.com/firebasejs/10.15.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.15.0/firebase-messaging-compat.js");

const firebaseConfig = {
  apiKey: "AIzaSyCuolap_m6yXWEo2csYMyGhEshsHnd1aEQ",
  authDomain: "e-tech-global-hub.firebaseapp.com",
  projectId: "e-tech-global-hub",
  storageBucket: "e-tech-global-hub.firebasestorage.app",
  messagingSenderId: "228699271017",
  appId: "1:228699271017:web:97043359d72b08e99917f8",
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Background message received: ", payload);

  const notificationTitle = payload.notification?.title || payload.data?.title || "E-Tech Notification";
  const notificationOptions = {
    body: payload.notification?.body || payload.data?.body || "You have a new transaction or security update.",
    icon: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
    badge: "https://i.ibb.co/WWjZrtC7/E-Tech.png",
    data: payload.data || {},
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
