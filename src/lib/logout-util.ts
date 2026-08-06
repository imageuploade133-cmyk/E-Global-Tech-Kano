import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { toast } from "sonner";

/**
 * Reusable, robust unified sign-out helper that handles:
 * 1. Unregistering the browser FCM token from the database.
 * 2. Logging out of Firebase Authentication.
 * 3. Clearing relevant mock and token values from storage.
 * 4. Navigating back to the login screen.
 */
export async function handleAppSignOut(router: any) {
  try {
    const isMock = typeof window !== "undefined" && sessionStorage.getItem("mock") === "true";

    if (isMock) {
      console.log("[SignOut] Mock sign-out initiated.");
      if (typeof window !== "undefined") {
        sessionStorage.clear();
        localStorage.removeItem("active_fcm_token");
        toast.success("Logged out successfully");
        window.location.href = "/auth/login";
      } else {
        router.push("/auth/login");
      }
      return;
    }

    const token = typeof window !== "undefined" ? localStorage.getItem("active_fcm_token") : null;
    const user = auth.currentUser;

    if (token && user) {
      try {
        const idToken = await user.getIdToken();
        const res = await fetch("/api/fcm/unregister", {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`,
          },
          body: JSON.stringify({ token }),
        });

        if (res.ok) {
          console.log("[SignOut] FCM token unregistered successfully.");
        } else {
          const data = await res.json().catch(() => ({}));
          console.warn("[SignOut Warning] FCM token unregistration returned failure status:", data.error || data.message);
        }
      } catch (err: any) {
        console.error("[SignOut Exception] Failed to unregister FCM token:", err.message);
      }
    }
  } catch (err: any) {
    console.error("[SignOut Exception] General error in pre-signout helper:", err.message);
  } finally {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("active_fcm_token");
      }
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (err: any) {
      console.error("[SignOut Error] Firebase auth signout crashed:", err.message);
      toast.error("Failed to sign out completely from auth session.");
    }
    if (typeof window !== "undefined") {
      window.location.href = "/auth/login";
    } else {
      router.push("/auth/login");
    }
  }
}
