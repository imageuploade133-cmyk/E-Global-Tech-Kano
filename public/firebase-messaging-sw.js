importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js");

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

// Handle background notification clicks and routing
self.addEventListener("notificationclick", (event) => {
  console.log("[Service Worker] Notification clicked:", event);
  event.notification.close();

  // Extract transaction reference or target URL safely
  const txRef = event.notification.data?.reference || event.notification.data?.transactionReference || event.notification.data?.txRef;
  let targetUrl = event.notification.data?.url || event.notification.data?.click_action || "/";

  if (txRef && !targetUrl.includes("txRef")) {
    targetUrl = `/?txRef=${encodeURIComponent(txRef)}`;
  }

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windowClients) => {
      // If there's an existing window open on the domain, focus it and navigate
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(self.location.origin) && "focus" in client) {
          return client.navigate(targetUrl).then((navigatedClient) => navigatedClient.focus());
        }
      }
      // Otherwise, open a brand new window to the target URL
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
