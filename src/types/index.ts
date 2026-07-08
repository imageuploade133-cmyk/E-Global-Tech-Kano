export interface Transaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  date: string;
  category: string;
}

export interface WalletState {
  balance: number;
  currency: string;
  userName: string;
  profileImage: string;
}
