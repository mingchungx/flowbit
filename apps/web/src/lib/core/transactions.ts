import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import { sql } from "drizzle-orm";

export async function getTransactions(walletId: string) {
  return db
    .select()
    .from(transactions)
    .where(
      sql`${transactions.fromWalletId} = ${walletId} OR ${transactions.toWalletId} = ${walletId}`
    )
    .orderBy(sql`${transactions.createdAt} DESC`);
}
