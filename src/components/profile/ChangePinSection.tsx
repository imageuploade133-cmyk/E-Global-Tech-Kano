"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { useAuth } from "@/lib/AuthContext";

export function ChangePinSection() {
  const { user, userData, updateUserData } = useAuth();
  const [oldPin, setOldPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [isUpdatingPin, setIsUpdatingPin] = useState(false);

  const handleUpdatePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (oldPin.length !== 4 || isNaN(Number(oldPin))) {
      toast.error("Please enter a valid 4-digit old PIN.");
      return;
    }
    if (newPin.length !== 4 || isNaN(Number(newPin))) {
      toast.error("New PIN must be exactly 4 digits.");
      return;
    }
    if (newPin !== confirmPin) {
      toast.error("New PINs do not match.");
      return;
    }

    setIsUpdatingPin(true);
    try {
      const isMock = sessionStorage.getItem("mock") === "true";

      if (isMock) {
        const currentStoredPin = userData?.pin || "1234";
        if (oldPin !== currentStoredPin) {
          toast.error("Incorrect current PIN. Access denied.");
          setIsUpdatingPin(false);
          return;
        }

        await updateUserData({ pin: newPin });
        toast.success("Access PIN updated successfully!");
      } else {
        if (!user) {
          toast.error("Authentication required.");
          setIsUpdatingPin(false);
          return;
        }

        const idToken = await user.getIdToken();

        const verifyRes = await fetch("/api/auth/pin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            action: "verify",
            pin: oldPin
          })
        });

        const verifyData = await verifyRes.json();
        if (!verifyRes.ok || !verifyData.success) {
          toast.error(verifyData.message || verifyData.error || "Incorrect current PIN. Access denied.");
          setIsUpdatingPin(false);
          return;
        }

        const setRes = await fetch("/api/auth/pin", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${idToken}`
          },
          body: JSON.stringify({
            action: "set",
            pin: newPin
          })
        });

        const setData = await setRes.json();
        if (setRes.ok && setData.success) {
          toast.success("Access PIN updated successfully!");
        } else {
          toast.error(setData.error || "Failed to set new PIN securely.");
          setIsUpdatingPin(false);
          return;
        }
      }

      setOldPin("");
      setNewPin("");
      setConfirmPin("");
    } catch (err: unknown) {
      console.error("PIN Update Error:", err);
      toast.error("Failed to update Access PIN");
    } finally {
      setIsUpdatingPin(false);
    }
  };

  return (
    <section className="premium-gradient-card premium-gradient-border p-6 space-y-4">
      <h3 className="font-hanken font-bold text-sm tracking-wider uppercase text-gray-500 border-b border-gray-100/60 pb-2.5">
        Change Access PIN
      </h3>

      <form onSubmit={handleUpdatePin} className="space-y-4">
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold uppercase tracking-wider text-black">Current 4-Digit PIN</label>
            <input
              type="password"
              maxLength={4}
              required
              value={oldPin}
              onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ""))}
              className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
              placeholder="••••"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black">New 4-Digit PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={newPin}
                onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
                placeholder="••••"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-black">Confirm PIN</label>
              <input
                type="password"
                maxLength={4}
                required
                value={confirmPin}
                onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
                className="w-full bg-white border border-black rounded-2xl px-4 py-3.5 text-xs font-semibold text-black placeholder-gray-400 outline-none focus:border-black/60 shadow-sm transition-all text-center tracking-[0.5em]"
                placeholder="••••"
              />
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={isUpdatingPin}
          className="w-full bg-black text-white py-3 rounded-xl text-xs font-bold uppercase tracking-widest active:scale-95 transition-transform disabled:opacity-50 cursor-pointer"
        >
          {isUpdatingPin ? "Updating..." : "Update PIN"}
        </button>
      </form>
    </section>
  );
}
