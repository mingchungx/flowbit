import type {
  Wallet,
  Transaction,
  Policy,
  SendPaymentParams,
  FlowbitConfig,
  Agreement,
  UsageRecord,
  CreateAgreementParams,
  SettlementResult,
} from "./types.js";

export type {
  Wallet,
  Transaction,
  Policy,
  SendPaymentParams,
  FlowbitConfig,
  Agreement,
  UsageRecord,
  CreateAgreementParams,
  SettlementResult,
};

export class FlowbitClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: FlowbitConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://localhost:3000").replace(
      /\/$/,
      ""
    );
    this.apiKey = config.apiKey;
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    const body = await res.json();
    if (!res.ok) {
      throw new Error(
        (body as { error?: string }).error || `HTTP ${res.status}`
      );
    }
    return body as T;
  }

  // ── Wallets ──

  async createWallet(name: string): Promise<Wallet> {
    return this.request("/api/wallets", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getWallet(id: string): Promise<Wallet> {
    return this.request(`/api/wallets/${id}`);
  }

  async listWallets(): Promise<Wallet[]> {
    return this.request("/api/wallets");
  }

  async fundWallet(
    id: string,
    amount: number,
    idempotencyKey?: string
  ): Promise<Transaction> {
    return this.request(`/api/wallets/${id}/fund`, {
      method: "POST",
      body: JSON.stringify({ amount, idempotency_key: idempotencyKey }),
    });
  }

  // ── Payments ──

  async send(params: SendPaymentParams): Promise<Transaction> {
    return this.request("/api/send", {
      method: "POST",
      body: JSON.stringify({
        from: params.from,
        to: params.to,
        amount: params.amount,
        memo: params.memo,
        idempotency_key: params.idempotencyKey,
      }),
    });
  }

  // ── Transactions ──

  async getTransactions(walletId: string): Promise<Transaction[]> {
    return this.request(`/api/transactions?wallet_id=${walletId}`);
  }

  // ── Policies ──

  async addPolicy(
    walletId: string,
    type: Policy["type"],
    params: Record<string, unknown>
  ): Promise<Policy> {
    return this.request(`/api/wallets/${walletId}/policies`, {
      method: "POST",
      body: JSON.stringify({ type, params }),
    });
  }

  async listPolicies(walletId: string): Promise<Policy[]> {
    return this.request(`/api/wallets/${walletId}/policies`);
  }

  // ── Agreements ──

  async createAgreement(params: CreateAgreementParams): Promise<Agreement> {
    return this.request("/api/agreements", {
      method: "POST",
      body: JSON.stringify({
        payer_wallet_id: params.payerWalletId,
        payee_wallet_id: params.payeeWalletId,
        type: params.type,
        amount: params.amount,
        unit: params.unit,
        interval: params.interval,
        metadata: params.metadata,
      }),
    });
  }

  async getAgreement(id: string): Promise<Agreement> {
    return this.request(`/api/agreements/${id}`);
  }

  async listAgreements(
    filters?: { walletId?: string; type?: string; status?: string }
  ): Promise<Agreement[]> {
    const params = new URLSearchParams();
    if (filters?.walletId) params.set("wallet_id", filters.walletId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return this.request(`/api/agreements${qs ? `?${qs}` : ""}`);
  }

  async cancelAgreement(id: string): Promise<Agreement> {
    return this.request(`/api/agreements/${id}/cancel`, {
      method: "POST",
    });
  }

  async reportUsage(agreementId: string, quantity: number): Promise<UsageRecord> {
    return this.request(`/api/agreements/${agreementId}/usage`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    });
  }

  async settleAgreement(id: string): Promise<Transaction> {
    return this.request(`/api/agreements/${id}/settle`, {
      method: "POST",
    });
  }

  async settleAllDue(): Promise<SettlementResult> {
    return this.request("/api/agreements/settle", {
      method: "POST",
    });
  }
}
