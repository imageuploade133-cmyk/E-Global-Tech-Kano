import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFirebaseError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "An error occurred during secure authentication. Please check your network and try again.";
  }

  const err = error as { code?: string; message?: string };
  const code = err.code || "";

  switch (code) {
    case "auth/email-already-in-use":
      return "This email address is already associated with an active E-Tech account.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Your password must contain at least 6 characters for security.";
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-credential":
      return "The email address or password entered is incorrect. Please verify your credentials.";
    case "auth/too-many-requests":
      return "Access temporarily restricted due to multiple failed attempts. Please try again shortly.";
    case "auth/network-request-failed":
      return "Secure connection failed. Please check your internet connection.";
    default:
      return err.message || "An error occurred during secure authentication. Please check your network and try again.";
  }
}
