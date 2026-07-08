"use client";

import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { ServiceGrid } from "@/components/wallet/ServiceGrid";
import { Promotions } from "@/components/wallet/Promotions";
import { useAuth } from "@/lib/AuthContext";

export default function Home() {
  const { userData, user } = useAuth();

  const currentUser = {
    userName: userData?.name?.split(" ")[0]?.toUpperCase() || user?.displayName?.split(" ")[0]?.toUpperCase() || "CAPTAIN",
    profileImage: user?.photoURL || "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M",
    balance: userData?.balance || 0,
    currency: "NGN",
  };

  return (
    <>
      <Header userName={currentUser.userName} profileImage={currentUser.profileImage} />

      <main className="mt-24 px-margin-mobile flex-grow pb-32">
        <BalanceCard balance={currentUser.balance} currency={currentUser.currency} />
        <ServiceGrid />
        <Promotions />
      </main>

      <BottomNav />
    </>
  );
}
