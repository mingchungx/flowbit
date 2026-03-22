import { db } from "@/lib/db";
import { wallets, transactions, ledgerEntries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { evaluatePolicies } from "./policies";
import { generateWalletKeypair, mintTestUsdc } from "@/lib/chain";

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
    super(
      `Transaction with idempotency key already exists: ${idempotencyKey}`
    );
    this.name = "DuplicateTransactionError";
  }
}

export async function createWallet(name: string) {
  // Generate a real blockchain keypair
  const { address, privateKey } = generateWalletKeypair();

  const [wallet] = await db
    .insert(wallets)
    .values({ name, address, privateKey })
    .returning({
      id: wallets.id,
      name: wallets.name,
      address: wallets.address,
      currency: wallets.currency,
      balance: wallets.balance,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
    });
  return wallet;
}

export async function getWallet(id: string) {
  const [wallet] = await db
    .select({
      id: wallets.id,
      name: wallets.name,
      address: wallets.address,
      currency: wallets.currency,
      balance: wallets.balance,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
    })
    .from(wallets)
    .where(eq(wallets.id, id));
  if (!wallet) throw new WalletNotFoundError(id);
  return wallet;
}

export async function listWallets() {
  return db
    .select({
      id: wallets.id,
      name: wallets.name,
      address: wallets.address,
      currency: wallets.currency,
      balance: wallets.balance,
      createdAt: wallets.createdAt,
      updatedAt: wallets.updatedAt,
    })
    .from(wallets)
    .orderBy(wallets.createdAt);
}

/**
 * Get the full wallet row including privateKey (internal use only).
 */
async function getWalletInternal(id: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, id));
  if (!wallet) throw new WalletNotFoundError(id);
  return wallet;
}

export async function fundWallet(
  walletId: string,
  amount: number,
  idempotencyKey: string
) {
  // Check for duplicate idempotency key first (outside tx is fine — idempotent)
  const existing = await db
    .select()
    .from(transactions)
    .where(eq(transactions.idempotencyKey, idempotencyKey));
  if (existing.length > 0) {
    return existing[0];
  }

  // Get wallet address for on-chain mint
  const wallet = await getWalletInternal(walletId);

  // Mint on-chain (if chain is configured)
  let txHash: string | null = null;
  if (process.env.TEST_USDC_ADDRESS && process.env.DEPLOYER_PRIVATE_KEY) {
    txHash = await mintTestUsdc(wallet.address as `0x${string}`, amount);
  }

  return db.transaction(async (tx) => {
    // Verify wallet exists with row lock
    const [locked] = await tx
      .select()
      .from(wallets)
      .where(eq(wallets.id, walletId))
      .for("update");
    if (!locked) throw new WalletNotFoundError(walletId);

    // Create transaction record
    const [txRecord] = await tx
      .insert(transactions)
      .values({
        idempotencyKey,
        fromWalletId: null,
        toWalletId: walletId,
        amount: amount.toString(),
        memo: "Testnet funding",
        status: "completed",
        txHash,
      })
      .returning();

    // Create credit ledger entry
    await tx.insert(ledgerEntries).values({
      transactionId: txRecord.id,
      walletId,
      amount: amount.toString(),
      direction: "credit",
    });

    // Update cached balance
    await tx
      .update(wallets)
      .set({
        balance: sql`${wallets.balance} + ${amount.toString()}`,
        updatedAt: new Date(),
      })
      .where(eq(wallets.id, walletId));

    return txRecord;
  });
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

    return txRecord;
  });
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
