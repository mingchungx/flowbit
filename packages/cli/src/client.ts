const DEFAULT_BASE_URL = "http://localhost:3000";

export class FlowbitClient {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl?: string, apiKey?: string) {
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
    this.apiKey = apiKey;
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

    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: { ...headers, ...(options.headers as Record<string, string>) },
    });

    const body = await res.json();

    if (!res.ok) {
      throw new Error(body.error || `HTTP ${res.status}`);
    }

    return body as T;
  }

  async createWallet(name: string) {
    return this.request("/api/wallets", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
  }

  async getWallet(id: string) {
    return this.request(`/api/wallets/${id}`);
  }

  async listWallets() {
    return this.request("/api/wallets");
  }

  async fundWallet(id: string, amount: number, idempotencyKey?: string) {
    return this.request(`/api/wallets/${id}/fund`, {
      method: "POST",
      body: JSON.stringify({ amount, idempotency_key: idempotencyKey }),
    });
  }

  async addPolicy(
    walletId: string,
    type: string,
    params: Record<string, unknown>
  ) {
    return this.request(`/api/wallets/${walletId}/policies`, {
      method: "POST",
      body: JSON.stringify({ type, params }),
    });
  }

  async listPolicies(walletId: string) {
    return this.request(`/api/wallets/${walletId}/policies`);
  }

  async send(params: {
    from: string;
    to: string;
    amount: number;
    memo?: string;
    idempotencyKey?: string;
  }) {
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

  async getTransactions(walletId: string) {
    return this.request(`/api/transactions?wallet_id=${walletId}`);
  }

  // ── Agreements ──

  async createAgreement(params: {
    payerWalletId: string;
    payeeWalletId: string;
    type: string;
    amount: number;
    unit?: string;
    interval: string;
    metadata?: Record<string, unknown>;
  }) {
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

  async getAgreement(id: string) {
    return this.request(`/api/agreements/${id}`);
  }

  async listAgreements(filters?: {
    walletId?: string;
    type?: string;
    status?: string;
  }) {
    const params = new URLSearchParams();
    if (filters?.walletId) params.set("wallet_id", filters.walletId);
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return this.request(`/api/agreements${qs ? `?${qs}` : ""}`);
  }

  async cancelAgreement(id: string) {
    return this.request(`/api/agreements/${id}/cancel`, {
      method: "POST",
    });
  }

  async reportUsage(agreementId: string, quantity: number) {
    return this.request(`/api/agreements/${agreementId}/usage`, {
      method: "POST",
      body: JSON.stringify({ quantity }),
    });
  }

  async settleAgreement(id: string) {
    return this.request(`/api/agreements/${id}/settle`, {
      method: "POST",
    });
  }

  async settleAllDue() {
    return this.request("/api/agreements/settle", {
      method: "POST",
    });
  }
}
