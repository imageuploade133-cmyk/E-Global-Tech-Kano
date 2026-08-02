"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User, updateProfile } from "firebase/auth";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface UserData {
  name?: string;
  email?: string;
  pin?: string;
  balance?: number;
  isPinRequired?: boolean;
  isFaceIdEnabled?: boolean;
  dailyLimit?: number;
  photoURL?: string;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPinVerified: boolean;
  setPinVerified: (verified: boolean) => void;
  userData: UserData | null;
  updateUserData: (updates: Partial<UserData>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [loading, setLoading] = useState(true);

  // Load custom mock data from sessionStorage if present
  const getStoredMockData = (): UserData => {
    if (typeof window === "undefined") return {};
    const stored = sessionStorage.getItem("mock_user_data");
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return {};
      }
    }
    return {};
  };

  const saveStoredMockData = (data: UserData) => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("mock_user_data", JSON.stringify(data));
    }
  };

  useEffect(() => {
    // Check if mock query parameter or session is active (run only on client to avoid SSR hydration mismatch)
    const hasMockQuery = window.location.search.includes("mock=true");
    const hasMockSession = sessionStorage.getItem("mock") === "true";

    if (hasMockQuery) {
      sessionStorage.setItem("mock", "true");
    }

    if (hasMockQuery || hasMockSession) {
      setUser({
        uid: "mock-uid",
        displayName: "JULES VERNE",
        email: "jules@example.com",
      } as User);

      const storedMock = getStoredMockData();
      setUserData({
        name: "JULES VERNE",
        email: "jules@example.com",
        pin: "1234",
        balance: 750000,
        isPinRequired: true,
        isFaceIdEnabled: false,
        dailyLimit: 500000,
        ...storedMock
      });
      setIsPinVerified(true);
      setLoading(false);
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Set up real-time listener for user data
        unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data() as UserData;
            setUserData({
              isPinRequired: true,
              isFaceIdEnabled: false,
              dailyLimit: 500000,
              balance: data.balance !== undefined ? data.balance : 0.00,
              name: (data.displayName as string | undefined) || data.name || "",
              ...data
            });
          }
          setLoading(false);
        }, (error) => {
          console.error("Firestore Listener Error:", error);
          setLoading(false);
        });
      } else {
        if (unsubscribeSnapshot) unsubscribeSnapshot();
        setUserData(null);
        setIsPinVerified(false);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  const updateUserData = async (updates: Partial<UserData>) => {
    const isMock = sessionStorage.getItem("mock") === "true";

    if (isMock) {
      const merged = { ...userData, ...updates };
      setUserData(merged);
      saveStoredMockData(merged);

      if (user && updates.name) {
        setUser({ ...user, displayName: updates.name } as User);
      }
      return;
    }

    if (user) {
      // 1. Update Firebase Auth Profile if name or profile image changes
      if (updates.name || updates.photoURL) {
        await updateProfile(user, {
          displayName: updates.name || user.displayName,
          photoURL: (updates.photoURL as string) || user.photoURL
        });
      }

      // 2. Update Firestore
      await updateDoc(doc(db, "users", user.uid), updates);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPinVerified,
        setPinVerified: setIsPinVerified,
        userData,
        updateUserData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
