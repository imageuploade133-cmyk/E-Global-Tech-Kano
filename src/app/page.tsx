"use client";

import React, { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { RecentTransactions } from "@/components/wallet/RecentTransactions";
import { ServiceGrid } from "@/components/wallet/ServiceGrid";
import { Promotions } from "@/components/wallet/Promotions";
import { useAuth } from "@/lib/AuthContext";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

export default function Home() {
  const { userData, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const [verificationStatus, setVerificationStatus] = useState<"idle" | "verifying" | "success" | "error">("idle");
  const [verifiedAmount, setVerifiedAmount] = useState(0);
  const [verifyMessage, setVerifyMessage] = useState("");

  const currentUser = {
    userName: userData?.name?.split(" ")[0]?.toUpperCase() || user?.displayName?.split(" ")[0]?.toUpperCase() || "CAPTAIN",
    profileImage: user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M",
    balance: userData?.balance || 0,
    currency: "NGN",
  };

  // Capture and process Flutterwave callback parameters dynamically
  useEffect(() => {
    const transactionId = searchParams.get("transaction_id");
    const status = searchParams.get("status");
    const verifyParam = searchParams.get("verify");

    if ((verifyParam === "flw" && transactionId) || verifyParam === "flw_success") {
      const verifyPayment = async () => {
        setVerificationStatus("verifying");
        toast.loading("Verifying Flutterwave transaction details...");

        try {
          // If we redirected inside same tab
          if (transactionId) {
            const res = await fetch(`/api/flutterwave/verify?id=${transactionId}`);
            const data = await res.json();
            toast.dismiss();

            if (data.success) {
              setVerifiedAmount(data.fundedAmount || 0);
              setVerificationStatus("success");
              toast.success("Wallet successfully funded!");
            } else {
              setVerifyMessage(data.error || "Verification was rejected by the gateway.");
              setVerificationStatus("error");
              toast.error("Wallet funding was unsuccessful.");
            }
          } else {
            // Direct successful iframe completion
            setVerifiedAmount(0);
            setVerificationStatus("success");
            toast.dismiss();
            toast.success("Wallet successfully funded!");
          }
        } catch {
          toast.dismiss();
          setVerifyMessage("Internal server communication error during verification.");
          setVerificationStatus("error");
          toast.error("An error occurred during verification.");
        }
      };

      verifyPayment();
    } else if (status === "cancelled") {
      toast.error("The transaction checkout flow was cancelled.");
      router.replace("/");
    }
  }, [searchParams, router]);

  const handleDismissSuccess = () => {
    setVerificationStatus("idle");
    router.replace("/");
  };

  return (
    <>
      <Header userName={currentUser.userName} profileImage={currentUser.profileImage} />

      {/* Dynamic transaction verification overlays */}
      <AnimatePresence>
        {verificationStatus === "verifying" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/85 backdrop-blur-md z-[99999] flex flex-col items-center justify-center p-6 text-white"
          >
            <div className="flex flex-col items-center p-6 rounded-3xl bg-white/5 border border-white/10 shadow-2xl max-w-sm text-center space-y-4">
              <div className="relative w-12 h-12 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.0, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-[3px] border-white/20 border-t-[#FC7A00]"
                />
                <span className="material-symbols-outlined text-[#FC7A00] text-[22px] font-bold">lock_clock</span>
              </div>
              <div>
                <h3 className="font-hanken font-extrabold text-base text-white uppercase tracking-wider">Verifying Settlement</h3>
                <p className="font-hanken text-[11px] text-gray-400 mt-1 font-semibold leading-relaxed">
                  Communicating with Flutterwave verification rails to secure your wallet deposit. Please do not close or reload this window...
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {verificationStatus === "success" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-6 text-black"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-5 border border-gray-100"
            >
              <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 mx-auto shadow-inner">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>check_circle</span>
              </div>

              <div>
                <h3 className="font-hanken font-black text-lg text-gray-900 leading-tight">Payment Verified!</h3>
                <p className="font-hanken text-xs text-gray-500 mt-1 font-semibold leading-relaxed">
                  Your transaction has been securely processed and confirmed. Your wallet balance has been credited.
                </p>
              </div>

              {verifiedAmount > 0 && (
                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-150">
                  <p className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Credited Amount</p>
                  <p className="font-mono text-2xl font-black text-emerald-600 mt-0.5">
                    +₦{verifiedAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              <button
                onClick={handleDismissSuccess}
                className="w-full py-4 bg-gradient-to-r from-[#FC7A00] to-[#E06600] text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:brightness-105 active:scale-98 transition-all"
              >
                Go to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}

        {verificationStatus === "error" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-md z-[99999] flex items-center justify-center p-6 text-black"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-2xl max-w-sm w-full text-center space-y-5 border border-gray-100"
            >
              <div className="w-16 h-16 rounded-full bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 mx-auto shadow-inner">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: '"FILL" 1' }}>error</span>
              </div>

              <div>
                <h3 className="font-hanken font-black text-lg text-gray-900 leading-tight">Funding Failed</h3>
                <p className="font-hanken text-xs text-rose-600 mt-1.5 font-bold leading-relaxed">
                  {verifyMessage || "The transaction verification check was rejected by Flutterwave secure payment gateway."}
                </p>
              </div>

              <button
                onClick={handleDismissSuccess}
                className="w-full py-4 bg-gray-900 text-white text-xs font-black uppercase tracking-widest rounded-2xl cursor-pointer hover:bg-black active:scale-98 transition-all"
              >
                Dismiss
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="mt-20 min-[375px]:mt-24 px-margin-mobile flex-grow pb-24 min-[375px]:pb-32">
        <BalanceCard balance={currentUser.balance} currency={currentUser.currency} />
        <RecentTransactions />
        <ServiceGrid />
        <Promotions />
      </main>

      <BottomNav />
    </>
  );
}
