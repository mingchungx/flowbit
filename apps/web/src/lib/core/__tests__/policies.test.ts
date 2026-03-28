import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock the DB module so evaluatePolicies doesn't need Postgres ──

// We mock `@/lib/db` to return controlled policy rows from the `policies` table
// and controlled transaction sums from the `transactions` table.

let mockPolicies: Array<{ type: string; params: unknown; active: boolean; walletId: string }> = [];
let mockDailyTotal = "0";

vi.mock("@/lib/db", () => {
  return {
    db: {
      select: (columns?: unknown) => {
        // If columns contain a "total" key, this is the daily limit aggregation query
        if (columns && typeof columns === "object" && "total" in (columns as Record<string, unknown>)) {
          return {
            from: () => ({
              where: () => [{ total: mockDailyTotal }],
            }),
          };
        }
        // Otherwise it's the policy lookup query
        return {
          from: () => ({
            where: () =>
              mockPolicies.filter((p) => p.active),
          }),
        };
      },
    },
  };
});

// Import AFTER mocking
import { evaluatePolicies } from "../policies";
import type { PolicyCheckInput } from "../policies";

beforeEach(() => {
  mockPolicies = [];
  mockDailyTotal = "0";
});

// ── checkMaxPerTx (tested through evaluatePolicies) ──

describe("max_per_tx policy", () => {
  const input: PolicyCheckInput = {
    walletId: "wallet-1",
    amount: 50,
    toWalletId: "wallet-2",
  };

  it("allows amount under the limit", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 100 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("allows amount exactly at the limit", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 50 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("rejects amount exceeding the limit", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 25 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("exceeds max per transaction limit");
    expect(result.reason).toContain("50");
    expect(result.reason).toContain("25");
  });

  it("allows zero amount", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 100 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies({ ...input, amount: 0 });
    expect(result.ok).toBe(true);
  });

  it("rejects negative amount that exceeds limit (policy checks value, not sign)", async () => {
    // Negative amounts should be caught by sendPayment before policy check,
    // but the policy itself only checks `amount > max`
    mockPolicies = [
      { type: "max_per_tx", params: { max: 100 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies({ ...input, amount: -5 });
    expect(result.ok).toBe(true); // -5 is not > 100
  });

  it("handles very large amounts", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 1_000_000 }, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies({ ...input, amount: 1_000_000.01 });
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("exceeds max per transaction limit");
  });

  it("handles decimal precision correctly", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 10.50 }, active: true, walletId: "wallet-1" },
    ];
    // Amount at limit (equal)
    const atLimit = await evaluatePolicies({ ...input, amount: 10.50 });
    expect(atLimit.ok).toBe(true);

    // Amount just over limit
    const overLimit = await evaluatePolicies({ ...input, amount: 10.51 });
    expect(overLimit.ok).toBe(false);
  });
});

// ── checkAllowlist (tested through evaluatePolicies) ──

describe("allowlist policy", () => {
  const input: PolicyCheckInput = {
    walletId: "wallet-1",
    amount: 10,
    toWalletId: "wallet-2",
  };

  it("allows wallet that is in the allowlist", async () => {
    mockPolicies = [
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-2", "wallet-3"] },
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("rejects wallet not in the allowlist", async () => {
    mockPolicies = [
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-3", "wallet-4"] },
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("wallet-2");
    expect(result.reason).toContain("not in the allowlist");
  });

  it("rejects when allowlist is empty", async () => {
    mockPolicies = [
      {
        type: "allowlist",
        params: { allowed_wallets: [] },
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not in the allowlist");
  });

  it("allows when wallet is the only entry in the list", async () => {
    mockPolicies = [
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-2"] },
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });
});

// ── checkDailyLimit (tested through evaluatePolicies with mocked DB aggregation) ──

describe("daily_limit policy", () => {
  const input: PolicyCheckInput = {
    walletId: "wallet-1",
    amount: 20,
    toWalletId: "wallet-2",
  };

  it("allows when daily total plus amount is under the limit", async () => {
    mockPolicies = [
      { type: "daily_limit", params: { limit: 100 }, active: true, walletId: "wallet-1" },
    ];
    mockDailyTotal = "30"; // 30 + 20 = 50 < 100
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("rejects when daily total plus amount exceeds the limit", async () => {
    mockPolicies = [
      { type: "daily_limit", params: { limit: 50 }, active: true, walletId: "wallet-1" },
    ];
    mockDailyTotal = "35"; // 35 + 20 = 55 > 50
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Daily spend would be 55");
    expect(result.reason).toContain("exceeding limit of 50");
  });

  it("allows when daily total plus amount equals exactly the limit", async () => {
    mockPolicies = [
      { type: "daily_limit", params: { limit: 50 }, active: true, walletId: "wallet-1" },
    ];
    mockDailyTotal = "30"; // 30 + 20 = 50 == 50
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("allows when no prior spending today", async () => {
    mockPolicies = [
      { type: "daily_limit", params: { limit: 100 }, active: true, walletId: "wallet-1" },
    ];
    mockDailyTotal = "0"; // 0 + 20 = 20 < 100
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });
});

// ── evaluatePolicies with multiple policies ──

describe("evaluatePolicies", () => {
  const input: PolicyCheckInput = {
    walletId: "wallet-1",
    amount: 50,
    toWalletId: "wallet-2",
  };

  it("passes when no policies exist", async () => {
    mockPolicies = [];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("passes when all policies pass", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 100 }, active: true, walletId: "wallet-1" },
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-2"] },
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });

  it("fails when one policy fails even if others pass", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 100 }, active: true, walletId: "wallet-1" },
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-3"] }, // wallet-2 not allowed
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("not in the allowlist");
  });

  it("returns first failing policy reason when multiple fail", async () => {
    mockPolicies = [
      { type: "max_per_tx", params: { max: 10 }, active: true, walletId: "wallet-1" }, // 50 > 10, fails first
      {
        type: "allowlist",
        params: { allowed_wallets: ["wallet-3"] }, // also fails
        active: true,
        walletId: "wallet-1",
      },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    // Should get the max_per_tx error since it's evaluated first
    expect(result.reason).toContain("exceeds max per transaction limit");
  });

  it("rejects unknown policy types", async () => {
    mockPolicies = [
      { type: "unknown_type", params: {}, active: true, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(false);
    expect(result.reason).toContain("Unknown policy type: unknown_type");
  });

  it("ignores inactive policies (filtered by mock)", async () => {
    // Our mock filters by active === true, mirroring the DB WHERE clause
    mockPolicies = [
      { type: "max_per_tx", params: { max: 10 }, active: false, walletId: "wallet-1" },
    ];
    const result = await evaluatePolicies(input);
    expect(result.ok).toBe(true);
  });
});
