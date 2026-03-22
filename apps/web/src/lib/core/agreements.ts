import { db } from "@/lib/db";
import {
  agreements,
  usageRecords,
  wallets,
  transactions,
} from "@/lib/db/schema";
import { eq, and, or, lte, sql, isNull, ne } from "drizzle-orm";
import { getWallet, sendPayment, InsufficientFundsError } from "./ledger";

// ── Error classes ──

export class AgreementNotFoundError extends Error {
  constructor(agreementId: string) {
    super(`Agreement not found: ${agreementId}`);
    this.name = "AgreementNotFoundError";
  }
}

export class InvalidAgreementError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidAgreementError";
  }
}

// ── Types ──

export type AgreementType = "subscription" | "usage" | "retainer";
export type AgreementInterval = "daily" | "weekly" | "monthly";
export type AgreementStatus = "active" | "paused" | "cancelled" | "completed";

export interface CreateAgreementParams {
  payerWalletId: string;
  payeeWalletId: string;
  type: AgreementType;
  amount: number;
  unit?: string;
  interval: AgreementInterval;
  metadata?: Record<string, unknown>;
}

export interface ListAgreementsFilters {
  walletId?: string;
  type?: AgreementType;
  status?: AgreementStatus;
}

// ── Helpers ──

const VALID_TYPES: AgreementType[] = ["subscription", "usage", "retainer"];

function computeNextDueAt(interval: AgreementInterval, from?: Date): Date {
  const base = from ?? new Date();
  const next = new Date(base);
  switch (interval) {
    case "daily":
      next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setDate(next.getDate() + 7);
      break;
    case "monthly":
      next.setDate(next.getDate() + 30);
      break;
  }
  return next;
}

// ── Core functions ──

export async function createAgreement(params: CreateAgreementParams) {
  const {
    payerWalletId,
    payeeWalletId,
    type,
    amount,
    unit,
    interval,
    metadata,
  } = params;

  // Validate type
  if (!VALID_TYPES.includes(type)) {
    throw new InvalidAgreementError(
      `Invalid agreement type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`
    );
  }

  // Validate payer != payee
  if (payerWalletId === payeeWalletId) {
    throw new InvalidAgreementError(
      "Payer and payee wallets must be different"
    );
  }

  // Validate both wallets exist (will throw WalletNotFoundError if not)
  await getWallet(payerWalletId);
  await getWallet(payeeWalletId);

  // For retainer: verify payer has sufficient balance
  if (type === "retainer") {
    const payer = await getWallet(payerWalletId);
    if (parseFloat(payer.balance) < amount) {
      throw new InsufficientFundsError(payerWalletId, payer.balance, amount);
    }
  }

  const nextDueAt = computeNextDueAt(interval);

  // Insert the agreement
  const [agreement] = await db
    .insert(agreements)
    .values({
      payerWalletId,
      payeeWalletId,
      type,
      amount: amount.toString(),
      unit: unit || null,
      interval,
      nextDueAt,
      status: "active",
      metadata: metadata || {},
    })
    .returning();

  // For retainer: immediately transfer the full amount
  if (type === "retainer") {
    await sendPayment({
      from: payerWalletId,
      to: payeeWalletId,
      amount,
      idempotencyKey: `agreement_${agreement.id}_retainer_initial`,
      memo: `Retainer escrow for agreement ${agreement.id}`,
    });
  }

  return agreement;
}

export async function getAgreement(id: string) {
  const [agreement] = await db
    .select()
    .from(agreements)
    .where(eq(agreements.id, id));

  if (!agreement) {
    throw new AgreementNotFoundError(id);
  }

  return agreement;
}

export async function listAgreements(filters: ListAgreementsFilters = {}) {
  const conditions = [];

  if (filters.walletId) {
    conditions.push(
      or(
        eq(agreements.payerWalletId, filters.walletId),
        eq(agreements.payeeWalletId, filters.walletId)
      )
    );
  }

  if (filters.type) {
    conditions.push(eq(agreements.type, filters.type));
  }

  if (filters.status) {
    conditions.push(eq(agreements.status, filters.status));
  }

  const query = db.select().from(agreements);

  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(sql`${agreements.createdAt} DESC`);
  }

  return query.orderBy(sql`${agreements.createdAt} DESC`);
}

export async function cancelAgreement(id: string) {
  const agreement = await getAgreement(id);

  // For retainer: calculate remaining balance and refund
  if (agreement.type === "retainer") {
    // Sum drawdowns from the retainer (excluding the initial escrow transfer).
    // Drawdowns are transactions from payer to payee with memo referencing the
    // agreement id, but NOT the initial escrow transfer.
    const initialKey = `agreement_${id}_retainer_initial`;
    const drawdowns = await db
      .select({
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromWalletId, agreement.payerWalletId),
          eq(transactions.toWalletId, agreement.payeeWalletId),
          sql`${transactions.memo} LIKE ${"%" + agreement.id + "%"}`,
          sql`${transactions.idempotencyKey} != ${initialKey}`
        )
      );

    const totalDrawn = parseFloat(drawdowns[0].total);
    const retainerAmount = parseFloat(agreement.amount);
    const remaining = retainerAmount - totalDrawn;

    if (remaining > 0) {
      await sendPayment({
        from: agreement.payeeWalletId,
        to: agreement.payerWalletId,
        amount: remaining,
        idempotencyKey: `agreement_${id}_refund`,
        memo: `Retainer refund for agreement ${id}`,
      });
    }
  }

  const [updated] = await db
    .update(agreements)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(agreements.id, id))
    .returning();

  return updated;
}

export async function reportUsage(agreementId: string, quantity: number) {
  const agreement = await getAgreement(agreementId);

  if (agreement.type !== "usage") {
    throw new InvalidAgreementError(
      `Cannot report usage for agreement type: ${agreement.type}`
    );
  }

  if (agreement.status !== "active") {
    throw new InvalidAgreementError(
      `Cannot report usage for agreement with status: ${agreement.status}`
    );
  }

  const [record] = await db
    .insert(usageRecords)
    .values({
      agreementId,
      quantity: quantity.toString(),
    })
    .returning();

  return record;
}

export async function settleAgreement(id: string) {
  const agreement = await getAgreement(id);

  if (agreement.type === "subscription") {
    // Execute sendPayment for the fixed amount
    await sendPayment({
      from: agreement.payerWalletId,
      to: agreement.payeeWalletId,
      amount: parseFloat(agreement.amount),
      idempotencyKey: `agreement_${id}_${agreement.nextDueAt.toISOString()}`,
      memo: `Subscription payment for agreement ${id}`,
    });

    // Advance nextDueAt
    const newNextDueAt = computeNextDueAt(
      agreement.interval as AgreementInterval,
      agreement.nextDueAt
    );
    const [updated] = await db
      .update(agreements)
      .set({
        nextDueAt: newNextDueAt,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, id))
      .returning();

    return updated;
  }

  if (agreement.type === "usage") {
    // Sum unsettled usage records
    const unsettledResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.agreementId, id),
          isNull(usageRecords.settledAt)
        )
      );

    const totalQuantity = parseFloat(unsettledResult[0].total);
    const perUnitRate = parseFloat(agreement.amount);
    const chargeAmount = totalQuantity * perUnitRate;

    // Only send payment if there is a non-zero charge
    if (chargeAmount > 0) {
      await sendPayment({
        from: agreement.payerWalletId,
        to: agreement.payeeWalletId,
        amount: chargeAmount,
        idempotencyKey: `agreement_${id}_${agreement.nextDueAt.toISOString()}`,
        memo: `Usage payment for agreement ${id}: ${totalQuantity} units`,
      });
    }

    // Mark all unsettled records as settled
    await db
      .update(usageRecords)
      .set({ settledAt: new Date() })
      .where(
        and(
          eq(usageRecords.agreementId, id),
          isNull(usageRecords.settledAt)
        )
      );

    // Advance nextDueAt
    const newNextDueAt = computeNextDueAt(
      agreement.interval as AgreementInterval,
      agreement.nextDueAt
    );
    const [updated] = await db
      .update(agreements)
      .set({
        nextDueAt: newNextDueAt,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, id))
      .returning();

    return updated;
  }

  if (agreement.type === "retainer") {
    // No periodic settlement needed for retainers
    return agreement;
  }

  throw new InvalidAgreementError(
    `Unknown agreement type: ${agreement.type}`
  );
}

export async function settleDueAgreements() {
  const now = new Date();

  // Find all active agreements that are due and not retainers
  const dueAgreements = await db
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.status, "active"),
        lte(agreements.nextDueAt, now),
        ne(agreements.type, "retainer")
      )
    );

  let settled = 0;
  const errors: Array<{ agreementId: string; error: string }> = [];

  for (const agreement of dueAgreements) {
    try {
      await settleAgreement(agreement.id);
      settled++;
    } catch (error) {
      errors.push({
        agreementId: agreement.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { settled, errors };
}
