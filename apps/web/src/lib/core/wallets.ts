import { db } from "@/lib/db";
import { wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { generateWalletKeypair } from "@/lib/chain";
import { encryptPrivateKey } from "@/lib/crypto/keys";
import { logger } from "@/lib/logger";
import { WalletNotFoundError } from "./errors";

export const WALLET_PUBLIC_COLUMNS = {
  id: wallets.id,
  name: wallets.name,
  address: wallets.address,
  currency: wallets.currency,
  balance: wallets.balance,
  createdAt: wallets.createdAt,
  updatedAt: wallets.updatedAt,
} as const;

export async function createWallet(name: string, ownerKeyId?: string) {
  // Generate a real blockchain keypair
  const { address, privateKey } = generateWalletKeypair();

  // Encrypt private key before storage
  const storedKey = encryptPrivateKey(privateKey);

  const [wallet] = await db
    .insert(wallets)
    .values({ name, address, privateKey: storedKey, ownerKeyId: ownerKeyId || null })
    .returning(WALLET_PUBLIC_COLUMNS);

  logger.info("Wallet created", { walletId: wallet.id, name });
  return wallet;
}

export async function getWallet(id: string) {
  const [wallet] = await db
    .select(WALLET_PUBLIC_COLUMNS)
    .from(wallets)
    .where(eq(wallets.id, id));
  if (!wallet) throw new WalletNotFoundError(id);
  return wallet;
}

export async function listWallets(ownerKeyId?: string) {
  const query = db
    .select(WALLET_PUBLIC_COLUMNS)
    .from(wallets)
    .orderBy(wallets.createdAt)
    .$dynamic();

  if (ownerKeyId) {
    return query.where(eq(wallets.ownerKeyId, ownerKeyId));
  }
  return query;
}

/**
 * Get the full wallet row including privateKey (internal use only).
 */
export async function getWalletInternal(id: string) {
  const [wallet] = await db
    .select()
    .from(wallets)
    .where(eq(wallets.id, id));
  if (!wallet) throw new WalletNotFoundError(id);
  return wallet;
}
