import type {
  Wallet,
  Transaction,
  Policy,
  SendPaymentParams,
  AgentPayConfig,
} from "./types.js";

export type { Wallet, Transaction, Policy, SendPaymentParams, AgentPayConfig };

export class AgentPay {
  private baseUrl: string;
  private apiKey?: string;

  constructor(config: AgentPayConfig = {}) {
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
}
