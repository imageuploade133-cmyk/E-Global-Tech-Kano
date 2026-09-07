"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

const FundWalletModal = dynamic(() => import("./FundWalletModal"), { ssr: false });
const TransferModal = dynamic(() => import("./TransferModal"), { ssr: false });
const SwapModal = dynamic(() => import("./SwapModal"), { ssr: false });
const UsdFundingModal = dynamic(() => import("./UsdFundingModal"), { ssr: false });

export type ActiveModalType = "fund" | "transfer" | "swap" | "usd" | null;

interface ModalHostProps {
  activeModal: ActiveModalType;
  onClose: () => void;
  user: any;
  userData: any;
  config: any;
  onSuccess?: () => void;
  initialTransferType?: "single" | "bulk";
  initialFundCurrency?: string;
  usdAccountData?: any;
}

export const ModalHost: React.FC<ModalHostProps> = ({
  activeModal,
  onClose,
  user,
  userData,
  config,
  onSuccess,
  initialTransferType = "single",
  initialFundCurrency = "NGN",
  usdAccountData,
}) => {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !activeModal) return null;

  const content = (
    <>
      {activeModal === "fund" && (
        <FundWalletModal
          user={user}
          userData={userData}
          config={config}
          initialCurrency={initialFundCurrency}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}

      {activeModal === "transfer" && (
        <TransferModal
          user={user}
          userData={userData}
          config={config}
          initialMode={initialTransferType}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}

      {activeModal === "swap" && (
        <SwapModal
          user={user}
          userData={userData}
          onClose={onClose}
          onSuccess={onSuccess}
        />
      )}

      {activeModal === "usd" && (
        <UsdFundingModal
          user={user}
          userData={userData}
          accountData={usdAccountData}
          onClose={onClose}
        />
      )}
    </>
  );

  return createPortal(content, document.body);
};

export default React.memo(ModalHost);
