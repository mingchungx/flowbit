import { db } from "@/lib/db";
import { wallets, transactions, ledgerEntries } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { mintTestUsdc } from "@/lib/chain";
import { logger } from "@/lib/logger";
import { WalletNotFoundError } from "./errors";
import { getWalletInternal } from "./wallets";

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

    logger.info("Wallet funded", {
      walletId,
      amount,
      transactionId: txRecord.id,
      onChain: !!txHash,
    });

    return txRecord;
  });
}
