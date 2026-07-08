import { Header } from "@/components/layout/Header";
import { BottomNav } from "@/components/layout/BottomNav";
import { BalanceCard } from "@/components/wallet/BalanceCard";
import { ServiceGrid } from "@/components/wallet/ServiceGrid";
import { Promotions } from "@/components/wallet/Promotions";

export default function Home() {
  const user = {
    userName: "CAPTAIN",
    profileImage: "https://lh3.googleusercontent.com/aida-public/AB6AXuAhqRElSxFDYR0JkLrL3BmoTHpcQpwcpM8xiEOnGtTcV8dqv0FIMYVAxgz7tMMChcZxMlTa2-2ynaI3jIWoLsyt_hfOq8ILk52eJHTc0Ot0_rEl9aA6fYqKikhCmWGkw82ljlEttOLSEHGqM_XrwGNTAqYcnAliKIqqx6JvmHYxWU4vMcWp1WvRiDQDhCuSfoHxXfGhX0UQSjcA9sP2F2lVFfu9_7meiyzKguVTqcrOQ7LGww0OPJgP1b8eBW81_BBVIhpF2GzeT3M",
    balance: 85872.45,
    currency: "NGN",
  };

  return (
    <>
      <Header userName={user.userName} profileImage={user.profileImage} />

      <main className="mt-24 px-margin-mobile flex-grow pb-32">
        <BalanceCard balance={user.balance} currency={user.currency} />
        <ServiceGrid />
        <Promotions />
      </main>

      <BottomNav />
    </>
  );
}
