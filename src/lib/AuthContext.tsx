"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";

interface UserData {
  name?: string;
  email?: string;
  pin?: string;
  balance?: number;
  [key: string]: unknown;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isPinVerified: boolean;
  setPinVerified: (verified: boolean) => void;
  userData: UserData | null;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);

      if (currentUser) {
        // Set up real-time listener for user data
        unsubscribeSnapshot = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setUserData(docSnap.data() as UserData);
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

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isPinVerified,
        setPinVerified: setIsPinVerified,
        userData,
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
