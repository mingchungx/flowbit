import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { wallets, transactions, policies } from "@/lib/db/schema";
import { sql, gte, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [walletStats] = await db
      .select({
        totalWallets: sql<number>`COUNT(*)::int`,
        totalBalance: sql<string>`COALESCE(SUM(${wallets.balance}), 0)`,
      })
      .from(wallets);

    const [txLast24h] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .where(gte(transactions.createdAt, oneDayAgo));

    const [txLastHour] = await db
      .select({
        count: sql<number>`COUNT(*)::int`,
      })
      .from(transactions)
      .where(gte(transactions.createdAt, oneHourAgo));

    const [policyStats] = await db
      .select({
        activePolicies: sql<number>`COUNT(*)::int`,
      })
      .from(policies)
      .where(eq(policies.active, true));

    const [lastActivity] = await db
      .select({
        lastActivityAt: sql<string | null>`MAX(${transactions.createdAt})`,
      })
      .from(transactions);

    return NextResponse.json({
      totalWallets: walletStats.totalWallets,
      totalBalance: walletStats.totalBalance,
      transactionsLast24h: txLast24h.count,
      transactionsLastHour: txLastHour.count,
      activePolicies: policyStats.activePolicies,
      lastActivityAt: lastActivity.lastActivityAt,
    });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
