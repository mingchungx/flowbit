import { db } from "@/lib/db";
import { wallets, transactions } from "@/lib/db/schema";
import { eq, gte, sql, and, or, inArray } from "drizzle-orm";

// ── Error class ──

export class FinancialLimitExceededError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "FinancialLimitExceededError";
  }
}

// ── Limits configuration ──

export interface FinancialLimits {
  maxWalletsPerKey: number;
  maxTxPerWalletPerHour: number;
  maxUsdcVolumePerKeyPerDay: number;
}

const DEFAULT_LIMITS: FinancialLimits = {
  maxWalletsPerKey: 100,
  maxTxPerWalletPerHour: 60,
  maxUsdcVolumePerKeyPerDay: 100_000,
};

/**
 * Get the current limits. In a future iteration this could be loaded from
 * a per-key configuration table — for now we use sensible defaults.
 */
export function getFinancialLimits(): FinancialLimits {
  return DEFAULT_LIMITS;
}

// ── Check functions ──

/**
 * Ensure the API key hasn't exceeded the maximum number of wallets.
 * Call this before creating a new wallet.
 */
export async function checkWalletCreationLimit(
  keyId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = getFinancialLimits();

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(wallets)
    .where(eq(wallets.ownerKeyId, keyId));

  if (result.count >= limits.maxWalletsPerKey) {
    return {
      allowed: false,
      reason: `Wallet creation limit reached: maximum ${limits.maxWalletsPerKey} wallets per API key`,
    };
  }

  return { allowed: true };
}

/**
 * Ensure the wallet hasn't exceeded the maximum transactions per hour.
 * Counts all outgoing transactions (where fromWalletId matches) in the
 * last 60 minutes.
 */
export async function checkTxPerWalletPerHour(
  walletId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = getFinancialLimits();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [result] = await db
    .select({
      count: sql<number>`COUNT(*)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.fromWalletId, walletId),
        gte(transactions.createdAt, oneHourAgo)
      )
    );

  if (result.count >= limits.maxTxPerWalletPerHour) {
    return {
      allowed: false,
      reason: `Transaction rate limit reached: maximum ${limits.maxTxPerWalletPerHour} transactions per wallet per hour`,
    };
  }

  return { allowed: true };
}

/**
 * Ensure the API key hasn't exceeded the maximum daily USDC volume.
 * Sums the amount across all transactions involving wallets owned by this
 * key (both sends and funds) in the last 24 hours.
 */
export async function checkDailyVolumeLimit(
  keyId: string,
  additionalAmount: number
): Promise<{ allowed: boolean; reason?: string }> {
  const limits = getFinancialLimits();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Get all wallet IDs owned by this key
  const ownedWallets = await db
    .select({ id: wallets.id })
    .from(wallets)
    .where(eq(wallets.ownerKeyId, keyId));

  if (ownedWallets.length === 0) {
    // No wallets yet — volume is zero, allow the operation
    return { allowed: true };
  }

  const walletIds = ownedWallets.map((w) => w.id);

  // Sum outgoing transaction amounts from any wallet owned by this key
  // in the last 24h. We count fromWalletId for sends and toWalletId for
  // funding because both represent USDC volume initiated by the key owner.
  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        gte(transactions.createdAt, oneDayAgo),
        or(
          inArray(transactions.fromWalletId, walletIds),
          inArray(transactions.toWalletId, walletIds)
        )
      )
    );

  const currentVolume = parseFloat(result.total);
  const projectedVolume = currentVolume + additionalAmount;

  if (projectedVolume > limits.maxUsdcVolumePerKeyPerDay) {
    return {
      allowed: false,
      reason: `Daily USDC volume limit reached: projected ${projectedVolume.toFixed(2)} exceeds maximum ${limits.maxUsdcVolumePerKeyPerDay} per API key per day`,
    };
  }

  return { allowed: true };
}

/**
 * Run all financial limit checks relevant to a payment.
 * Throws FinancialLimitExceededError if any limit is exceeded.
 */
export async function enforcePaymentLimits(params: {
  keyId: string;
  fromWalletId: string;
  amount: number;
}): Promise<void> {
  const txCheck = await checkTxPerWalletPerHour(params.fromWalletId);
  if (!txCheck.allowed) {
    throw new FinancialLimitExceededError(txCheck.reason!);
  }

  const volumeCheck = await checkDailyVolumeLimit(params.keyId, params.amount);
  if (!volumeCheck.allowed) {
    throw new FinancialLimitExceededError(volumeCheck.reason!);
  }
}

/**
 * Run all financial limit checks relevant to funding a wallet.
 * Throws FinancialLimitExceededError if any limit is exceeded.
 */
export async function enforceFundingLimits(params: {
  keyId: string;
  amount: number;
}): Promise<void> {
  const volumeCheck = await checkDailyVolumeLimit(params.keyId, params.amount);
  if (!volumeCheck.allowed) {
    throw new FinancialLimitExceededError(volumeCheck.reason!);
  }
}

/**
 * Run financial limit checks for wallet creation.
 * Throws FinancialLimitExceededError if the limit is exceeded.
 */
export async function enforceWalletCreationLimit(keyId: string): Promise<void> {
  const check = await checkWalletCreationLimit(keyId);
  if (!check.allowed) {
    throw new FinancialLimitExceededError(check.reason!);
  }
}
