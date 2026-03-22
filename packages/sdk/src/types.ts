export interface Wallet {
  id: string;
  name: string;
  address: string;
  currency: string;
  balance: string;
  createdAt: string;
  updatedAt: string;
}

export interface Transaction {
  id: string;
  idempotencyKey: string;
  fromWalletId: string | null;
  toWalletId: string;
  amount: string;
  memo: string | null;
  status: string;
  txHash: string | null;
  createdAt: string;
}

export interface Policy {
  id: string;
  walletId: string;
  type: "max_per_tx" | "daily_limit" | "allowlist";
  params: Record<string, unknown>;
  active: boolean;
  createdAt: string;
}

export interface SendPaymentParams {
  from: string;
  to: string;
  amount: number;
  memo?: string;
  idempotencyKey?: string;
}

export interface AgentPayConfig {
  baseUrl?: string;
  apiKey?: string;
}
