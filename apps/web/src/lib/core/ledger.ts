import { db } from "@/lib/db";
import { wallets, transactions, ledgerEntries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { evaluatePolicies } from "./policies";

export class InsufficientFundsError extends Error {
  constructor(walletId: string, balance: string, amount: number) {
    super(
      `Wallet ${walletId} has insufficient funds: balance ${balance}, attempted ${amount}`
    );
    this.name = "InsufficientFundsError";
  }
}

export class PolicyViolationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PolicyViolationError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(walletId: string) {
    super(`Wallet not found: ${walletId}`);
    this.name = "WalletNotFoundError";
  }
}

export class DuplicateTransactionError extends Error {
  constructor(idempotencyKey: string) {
    super(`Transaction with idempotency key already exists: ${idempotencyKey}`);
    this.name = "DuplicateTransactionError";
  }
}

export async function createWallet(name: string) {
  const [wallet] = await db.insert(wallets).values({ name }).returning();
  return wallet;
}

export async function getWallet(id: string) {
  const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
  if (!wallet) throw new WalletNotFoundError(id);
  return wallet;
}

export async function listWallets() {
  return db.select().from(wallets).orderBy(wallets.createdAt);
}

export async function fundWallet(
  walletId: string,
  amount: number,
  idempotencyKey: string
) {
  const wallet = await getWallet(walletId);
  if (!wallet) throw new WalletNotFoundError(walletId);

  // Check for duplicate idempotency key
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));
  if (existing.length > 0) {
    return existing[0];
  }

  // Create transaction record (fromWalletId is null for funding)
  const [tx] = await db
    .insert(transactions)
    .values({
      idempotencyKey,
      fromWalletId: null,
      toWalletId: walletId,
      amount: amount.toString(),
      memo: "Testnet funding",
      status: "completed",
    })
    .returning();

  // Create credit ledger entry
  await db.insert(ledgerEntries).values({
    transactionId: tx.id,
    walletId,
    amount: amount.toString(),
    direction: "credit",
  });

  // Update cached balance
  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} + ${amount.toString()}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, walletId));

  return tx;
}

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

  // Check for duplicate idempotency key
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));
  if (existing.length > 0) {
    return existing[0];
  }

  // Validate both wallets exist
  const fromWallet = await getWallet(from);
  const toWallet = await getWallet(to);
  if (!fromWallet) throw new WalletNotFoundError(from);
  if (!toWallet) throw new WalletNotFoundError(to);

  // Check balance
  if (parseFloat(fromWallet.balance) < amount) {
    throw new InsufficientFundsError(from, fromWallet.balance, amount);
  }

  // Evaluate policies
  const policyResult = await evaluatePolicies({
    walletId: from,
    amount,
    toWalletId: to,
  });
  if (!policyResult.ok) {
    throw new PolicyViolationError(policyResult.reason!);
  }

  // Execute the transfer atomically using a transaction
  const [tx] = await db
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

  // Create debit entry for sender
  await db.insert(ledgerEntries).values({
    transactionId: tx.id,
    walletId: from,
    amount: amount.toString(),
    direction: "debit",
  });

  // Create credit entry for receiver
  await db.insert(ledgerEntries).values({
    transactionId: tx.id,
    walletId: to,
    amount: amount.toString(),
    direction: "credit",
  });

  // Update cached balances
  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} - ${amount.toString()}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, from));

  await db
    .update(wallets)
    .set({
      balance: sql`${wallets.balance} + ${amount.toString()}`,
      updatedAt: new Date(),
    })
    .where(eq(wallets.id, to));

  return tx;
}

export async function getTransactions(walletId: string) {
  return db
    .select()
    .from(transactions)
    .where(
      sql`${transactions.fromWalletId} = ${walletId} OR ${transactions.toWalletId} = ${walletId}`
    )
    .orderBy(sql`${transactions.createdAt} DESC`);
}
