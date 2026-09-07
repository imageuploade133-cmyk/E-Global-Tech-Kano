"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/AuthContext";
import { useAppConfig } from "@/lib/ConfigContext";
import { useRouter } from "next/navigation";
import { KycVerificationDrawer } from "@/components/profile/KycVerificationDrawer";
import BannerSlideshow from "@/components/BannerSlideshow";
import ModalHost, { ActiveModalType } from "./modals/ModalHost";

interface BalanceCardProps {
  balance: number;
  currency: string;
  userName?: string;
  isLoading?: boolean;
}

const BalanceCardComponent: React.FC<BalanceCardProps> = ({ balance, currency, userName, isLoading }) => {
  const { userData, user } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();

  const [isVisible, setIsVisible] = useState(false);
  const [totalInvestment, setTotalInvestment] = useState<number>(0);
  const [isKycDrawerOpen, setIsKycDrawerOpen] = useState(false);

  // Multi-currency States
  const [selectedCurrency, setSelectedCurrency] = useState<string>("NGN");
  const [currencyVisibility, setCurrencyVisibility] = useState<Record<string, boolean>>({});
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({ NGN: balance, USD: 0, XOF: 0 });
  const [usdAccountData, setUsdAccountData] = useState<{
    accountNumber: string;
    bankName: string;
    routingNumber: string;
    swiftCode?: string;
  } | null>(null);

  // Active Modal state
  const [activeModal, setActiveModal] = useState<ActiveModalType>(null);
  const [transferMode, setTransferMode] = useState<"single" | "bulk">("single");

  useEffect(() => {
    const saved = sessionStorage.getItem("balance_visible");
    if (saved !== null) {
      setIsVisible(saved === "true");
    }
  }, []);

  const toggleVisibility = () => {
    const nextState = !isVisible;
    setIsVisible(nextState);
    sessionStorage.setItem("balance_visible", String(nextState));
    window.dispatchEvent(new Event("balance_visibility_changed"));
  };

  useEffect(() => {
    setWalletBalances((prev) => ({ ...prev, NGN: balance }));
  }, [balance]);

  const fetchWalletBalances = useCallback(async () => {
    if (!user) return;
    try {
      let idToken = "mock-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock) {
        idToken = await user.getIdToken();
      } else {
        setWalletBalances({ NGN: balance, USD: 1250, XOF: 750000 });
        setUsdAccountData({
          accountNumber: "2209418374",
          bankName: "Silicon Valley Bank",
          routingNumber: "021000021",
          swiftCode: "SVBKNM2E",
        });
        return;
      }

      const res = await fetch("/api/wallets", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.wallets) {
          const ngnBal = data.wallets.NGN?.balance ?? balance;
          const usdBal = data.wallets.USD?.balance ?? 0;
          const xofBal = data.wallets.XOF?.balance ?? 0;
          setWalletBalances((prev) => ({ ...prev, NGN: ngnBal, USD: usdBal, XOF: xofBal }));
        }
      }

      const ratesRes = await fetch("/api/exchange-rates");
      if (ratesRes.ok) {
        const ratesData = await ratesRes.json();
        if (ratesData.success && ratesData.currencyVisibility) {
          setCurrencyVisibility(ratesData.currencyVisibility);
        }
      }

      const accRes = await fetch("/api/wallets/accounts", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (accRes.ok) {
        const accData = await accRes.json();
        if (accData.success && accData.accounts?.USD) {
          setUsdAccountData(accData.accounts.USD);
        }
      }
    } catch (err) {
      console.error("Error fetching multi-currency wallet state:", err);
    }
  }, [user, balance]);

  const fetchInvestmentBalance = useCallback(async () => {
    if (!user) return;
    try {
      let idToken = "mock-token";
      const isMock = sessionStorage.getItem("mock") === "true";
      if (!isMock) {
        idToken = await user.getIdToken();
      }

      const res = await fetch("/api/investments/savings", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.investments)) {
          const activeSum = data.investments
            .filter((i: any) => i.status === "ACTIVE" || i.status === "CLAIM_REQUESTED")
            .reduce((sum: number, i: any) => sum + (Number(i.principal) || 0) + (Number(i.accruedInterest) || 0), 0);
          setTotalInvestment(activeSum);
        }
      }
    } catch (err) {
      console.error("Error fetching investment balance:", err);
    }
  }, [user]);

  useEffect(() => {
    fetchWalletBalances();
    const intv = setInterval(fetchWalletBalances, 10000);
    return () => clearInterval(intv);
  }, [fetchWalletBalances]);

  useEffect(() => {
    fetchInvestmentBalance();
    const invIntv = setInterval(fetchInvestmentBalance, 10000);
    return () => clearInterval(invIntv);
  }, [fetchInvestmentBalance]);

  useEffect(() => {
    const handleRefresh = () => {
      fetchWalletBalances();
      fetchInvestmentBalance();
    };
    window.addEventListener("app-refresh", handleRefresh);
    return () => {
      window.removeEventListener("app-refresh", handleRefresh);
    };
  }, [fetchWalletBalances, fetchInvestmentBalance]);

  const activeBalance = walletBalances[selectedCurrency] ?? (selectedCurrency === "NGN" ? balance : 0);

  const formatBalance = (amount: number, currStr: string) => {
    if (!isVisible) return "••••••••";
    const symbolMap: Record<string, string> = { NGN: "₦", USD: "$", XOF: "CFA" };
    const sym = symbolMap[currStr] || `${currStr} `;
    return `${sym}${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleOpenAddMoney = () => setActiveModal("fund");
  const handleOpenTransfer = (mode: "single" | "bulk" = "single") => {
    setTransferMode(mode);
    setActiveModal("transfer");
  };
  const handleOpenSwap = () => setActiveModal("swap");
  const handleOpenUsd = () => setActiveModal("usd");

  const isKycApproved = userData?.kycStatus === "approved" || userData?.kycStatus === "VERIFIED";

  return (
    <div className="w-full space-y-4">
      {/* Main Balance Hero Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="relative bg-gradient-to-br from-[#0b513d] via-[#083e2e] to-[#04281d] text-white p-6 rounded-[28px] shadow-xl overflow-hidden border border-white/10"
      >
        {/* Subtle Decorative SVG Ring Background */}
        <div className="absolute top-0 right-0 -mr-12 -mt-12 w-48 h-48 rounded-full bg-white/5 blur-2xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-12 -mb-12 w-48 h-48 rounded-full bg-[#FC7A00]/10 blur-2xl pointer-events-none" />

        {/* Currency Switcher Tabs */}
        <div className="relative z-10 flex items-center justify-between mb-4">
          <div className="flex items-center gap-1.5 bg-black/20 p-1 rounded-2xl border border-white/10">
            {["NGN", "USD", "XOF"]
              .filter((curr) => curr === "NGN" || currencyVisibility[curr] !== false)
              .map((curr) => (
                <button
                  key={curr}
                  type="button"
                  onClick={() => setSelectedCurrency(curr)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all ${
                    selectedCurrency === curr
                      ? "bg-[#FC7A00] text-white shadow-md"
                      : "text-gray-300 hover:text-white"
                  }`}
                >
                  {curr}
                </button>
              ))}
          </div>

          {/* Eye visibility toggle button */}
          <button
            type="button"
            onClick={toggleVisibility}
            className="w-9 h-9 rounded-full bg-white/10 border border-white/15 flex items-center justify-center text-white/80 hover:text-white transition-all cursor-pointer"
            title={isVisible ? "Hide Balances" : "Show Balances"}
          >
            <span className="material-symbols-outlined text-lg">
              {isVisible ? "visibility" : "visibility_off"}
            </span>
          </button>
        </div>

        {/* Main Wallet Balance Amount */}
        <div className="relative z-10 space-y-1">
          <p className="text-[10px] font-black uppercase tracking-widest text-emerald-200/80">
            {selectedCurrency} Main Balance
          </p>
          <div className="flex items-baseline gap-2">
            <h2 className="font-mono text-3xl min-[375px]:text-4xl font-black tracking-tight text-white">
              {formatBalance(activeBalance, selectedCurrency)}
            </h2>
          </div>
        </div>

        {/* Quick Action Pills Grid */}
        <div className="relative z-10 grid grid-cols-4 gap-2 mt-6 pt-4 border-t border-white/10">
          <button
            type="button"
            onClick={handleOpenAddMoney}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 transition-all text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl text-[#FC7A00]">add_circle</span>
            <span className="font-hanken text-[10px] font-bold text-white">Add Money</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenTransfer("single")}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 transition-all text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl text-emerald-300">send</span>
            <span className="font-hanken text-[10px] font-bold text-white">Transfer</span>
          </button>

          <button
            type="button"
            onClick={handleOpenSwap}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 transition-all text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl text-amber-300">swap_horiz</span>
            <span className="font-hanken text-[10px] font-bold text-white">Swap</span>
          </button>

          <button
            type="button"
            onClick={handleOpenUsd}
            className="flex flex-col items-center gap-1.5 p-2 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 transition-all text-center cursor-pointer"
          >
            <span className="material-symbols-outlined text-xl text-cyan-300">account_balance_wallet</span>
            <span className="font-hanken text-[10px] font-bold text-white">USD Account</span>
          </button>
        </div>
      </motion.div>

      {/* KYC Verification Banner */}
      {!isKycApproved && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-600 text-2xl">verified_user</span>
            <div>
              <h4 className="font-hanken font-bold text-xs text-amber-900">KYC Verification Required</h4>
              <p className="font-hanken text-[11px] text-amber-700">Verify your identity to increase transaction limits.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsKycDrawerOpen(true)}
            className="px-3 py-2 bg-amber-600 text-white font-hanken text-[10px] font-black uppercase rounded-xl hover:bg-amber-700 transition-all cursor-pointer"
          >
            Verify Now
          </button>
        </div>
      )}

      {/* Banner Slideshow */}
      <BannerSlideshow page="transfer" />

      {/* KYC Drawer Overlay */}
      {isKycDrawerOpen && (
        <KycVerificationDrawer
          isOpen={isKycDrawerOpen}
          onClose={() => setIsKycDrawerOpen(false)}
          onSuccess={() => setIsKycDrawerOpen(false)}
        />
      )}

      {/* Isolated Transaction Modal Host */}
      <ModalHost
        activeModal={activeModal}
        onClose={() => setActiveModal(null)}
        user={user}
        userData={userData}
        config={config}
        initialTransferType={transferMode}
        initialFundCurrency={selectedCurrency}
        usdAccountData={usdAccountData}
        onSuccess={fetchWalletBalances}
      />
    </div>
  );
};

export const BalanceCard = React.memo(BalanceCardComponent);
