import { db } from "@/lib/db";
import { policies, transactions } from "@/lib/db/schema";
import { eq, and, gte, sql } from "drizzle-orm";

export type PolicyType = "max_per_tx" | "daily_limit" | "allowlist";

export interface MaxPerTxParams {
  max: number;
}

export interface DailyLimitParams {
  limit: number;
}

export interface AllowlistParams {
  allowed_wallets: string[];
}

export type PolicyParams = MaxPerTxParams | DailyLimitParams | AllowlistParams;

export interface PolicyCheckInput {
  walletId: string;
  amount: number;
  toWalletId: string;
}

interface PolicyRow {
  type: string;
  params: unknown;
}

async function checkMaxPerTx(
  params: MaxPerTxParams,
  input: PolicyCheckInput
): Promise<{ ok: boolean; reason?: string }> {
  if (input.amount > params.max) {
    return {
      ok: false,
      reason: `Amount ${input.amount} exceeds max per transaction limit of ${params.max}`,
    };
  }
  return { ok: true };
}

async function checkDailyLimit(
  params: DailyLimitParams,
  input: PolicyCheckInput
): Promise<{ ok: boolean; reason?: string }> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.fromWalletId, input.walletId),
        eq(transactions.status, "completed"),
        gte(transactions.createdAt, startOfDay)
      )
    );

  const dailyTotal = parseFloat(result[0].total) + input.amount;
  if (dailyTotal > params.limit) {
    return {
      ok: false,
      reason: `Daily spend would be ${dailyTotal}, exceeding limit of ${params.limit}`,
    };
  }
  return { ok: true };
}

async function checkAllowlist(
  params: AllowlistParams,
  input: PolicyCheckInput
): Promise<{ ok: boolean; reason?: string }> {
  if (!params.allowed_wallets.includes(input.toWalletId)) {
    return {
      ok: false,
      reason: `Wallet ${input.toWalletId} is not in the allowlist`,
    };
  }
  return { ok: true };
}

export async function evaluatePolicies(
  input: PolicyCheckInput
): Promise<{ ok: boolean; reason?: string }> {
  const activePolicies = await db
    .select()
    .from(policies)
    .where(
      and(eq(policies.walletId, input.walletId), eq(policies.active, true))
    );

  for (const policy of activePolicies as PolicyRow[]) {
    let result: { ok: boolean; reason?: string };
    const params = policy.params as PolicyParams;

    switch (policy.type) {
      case "max_per_tx":
        result = await checkMaxPerTx(params as MaxPerTxParams, input);
        break;
      case "daily_limit":
        result = await checkDailyLimit(params as DailyLimitParams, input);
        break;
      case "allowlist":
        result = await checkAllowlist(params as AllowlistParams, input);
        break;
      default:
        result = { ok: false, reason: `Unknown policy type: ${policy.type}` };
    }

    if (!result.ok) {
      return result;
    }
  }

  return { ok: true };
}
