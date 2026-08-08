"use client";

import { useEffect } from "react";

const CURRENT_VERSION = "1.2.0";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // 1. Version Update Check (Clears local storage, and forces reload on new build deploy)
    const savedVersion = localStorage.getItem("APP_VERSION");
    if (savedVersion !== CURRENT_VERSION) {
      console.log(`[Version Control] New deployment detected (${CURRENT_VERSION}). Initializing fresh update...`);

      const balanceVisible = localStorage.getItem("balance_visible");

      // Clear sessionStorage
      sessionStorage.clear();

      // Restore critical user visual preferences
      if (balanceVisible !== null) {
        sessionStorage.setItem("balance_visible", balanceVisible);
      }

      // Record new version code
      sessionStorage.setItem("APP_VERSION", CURRENT_VERSION);

      // Force instant window reload to fetch latest client bundles
      window.location.reload();
      return;
    }

    // 2. Register modern Service Worker for offline load support
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((registration) => {
            console.log("[Service Worker] Registered successfully with scope:", registration.scope);

            // Check for updates to the service worker file on the server
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === "installed") {
                    if (navigator.serviceWorker.controller) {
                      console.log("[Service Worker] New content is available; please refresh.");
                    } else {
                      console.log("[Service Worker] Content is cached for offline use.");
                    }
                  }
                };
              }
            };
          })
          .catch((error) => {
            console.error("[Service Worker] Registration failed:", error);
          });
      });
    }
  }, []);

  return null;
}
