import { db } from "@/lib/db";
import { wallets, transactions, ledgerEntries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { evaluatePolicies } from "./policies";
import { logger } from "@/lib/logger";
import {
  InsufficientFundsError,
  PolicyViolationError,
  WalletNotFoundError,
} from "./errors";

export async function sendPayment(params: {
  from: string;
  to: string;
  amount: number;
  idempotencyKey: string;
  memo?: string;
}) {
  const { from, to, amount, idempotencyKey, memo } = params;

  if (amount <= 0) {
    throw new Error("Amount must be positive");
  }

  if (from === to) {
    throw new Error("Cannot send to the same wallet");
  }

  // Check for duplicate idempotency key (outside tx — idempotent return)
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));
  if (existing.length > 0) {
    return existing[0];
  }

  // Evaluate policies before entering the transaction (read-only check)
  const policyResult = await evaluatePolicies({
    walletId: from,
    amount,
    toWalletId: to,
  });
  if (!policyResult.ok) {
    throw new PolicyViolationError(policyResult.reason!);
  }

  return db.transaction(async (tx) => {
    // Lock both wallets in consistent order to prevent deadlocks
    const [first, second] = from < to ? [from, to] : [to, from];

    const [wallet1] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, first))
      .for("update");
    const [wallet2] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, second))
      .for("update");

    if (!wallet1 || !wallet2) {
      const missing = !wallet1 ? first : second;
      throw new WalletNotFoundError(missing);
    }

    const fromWallet = first === from ? wallet1 : wallet2;

    // Check balance under lock
    if (parseFloat(fromWallet.balance) < amount) {
      throw new InsufficientFundsError(from, fromWallet.balance, amount);
    }

    // Create transaction record (off-chain — settlement happens async)
    const [txRecord] = await tx
      .insert(transactions)
      .values({
        idempotencyKey,
        fromWalletId: from,
        toWalletId: to,
        amount: amount.toString(),
        memo: memo || null,
        status: "completed",
      })
      .returning();

    // Create ledger entries
    await tx.insert(ledgerEntries).values([
      {
        transactionId: txRecord.id,
        walletId: from,
        amount: amount.toString(),
        direction: "debit",
      },
      {
        transactionId: txRecord.id,
        walletId: to,
        amount: amount.toString(),
        direction: "credit",
      },
    ]);

    // Update cached balances
    await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} - ${amount.toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, from));

    await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amount.toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, to));

    logger.info("Payment sent", {
      from,
      to,
      amount,
      transactionId: txRecord.id,
    });

    return txRecord;
  });
}
