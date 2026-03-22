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

export interface FlowbitConfig {
  baseUrl?: string;
  apiKey?: string;
}

// ── Agreements ──

export interface Agreement {
  id: string;
  payerWalletId: string;
  payeeWalletId: string;
  type: "subscription" | "usage" | "retainer";
  amount: string;
  unit: string | null;
  interval: "daily" | "weekly" | "monthly";
  nextDueAt: string;
  status: "active" | "paused" | "cancelled" | "completed";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageRecord {
  id: string;
  agreementId: string;
  quantity: string;
  reportedAt: string;
  settledAt: string | null;
}

export interface CreateAgreementParams {
  payerWalletId: string;
  payeeWalletId: string;
  type: "subscription" | "usage" | "retainer";
  amount: number;
  unit?: string;
  interval: "daily" | "weekly" | "monthly";
  metadata?: Record<string, unknown>;
}

export interface SettlementResult {
  settled: number;
  errors: Array<{ agreementId: string; error: string }>;
}
