const DEFAULT_BASE_URL = "http://localhost:3000";

export class FlowbitClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = (baseUrl || DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private async request<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
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
}
