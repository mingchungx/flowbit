import { NextResponse } from "next/server";
import { getRunner } from "@/lib/engine/singleton";
import { db } from "@/lib/db";
import { wallets, agreements, transactions } from "@/lib/db/schema";
import { eq, inArray, and, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const runner = getRunner();
    const state = runner.state;

    if (!state) {
      return NextResponse.json(
        { error: "Simulation not initialized." },
        { status: 400 }
      );
    }

    const walletIds = state.agents.map((a) => a.walletId);

    // Build wallet-to-agent mapping
    const walletToAgent = new Map(
      state.agents.map((a) => [a.walletId, a])
    );

    // Fetch wallet balances
    const walletRows = await db
      .select({ id: wallets.id, balance: wallets.balance })
      .from(wallets)
      .where(inArray(wallets.id, walletIds));

    const balanceMap = new Map(walletRows.map((w) => [w.id, w.balance]));

    // Build nodes
    const nodes = state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      profession: a.profession,
      balance: balanceMap.get(a.walletId) ?? "0",
    }));

    // Active agreements between simulation wallets
    const activeAgreements = await db
      .select({
        id: agreements.id,
        source: agreements.payerWalletId,
        target: agreements.payeeWalletId,
        type: agreements.type,
        amount: agreements.amount,
      })
      .from(agreements)
      .where(
        and(
          eq(agreements.status, "active"),
          inArray(agreements.payerWalletId, walletIds)
        )
      );

    // Recent transactions between simulation wallets (last 200)
    const recentTxs = await db
      .select({
        id: transactions.id,
        source: transactions.fromWalletId,
        target: transactions.toWalletId,
        amount: transactions.amount,
      })
      .from(transactions)
      .where(inArray(transactions.fromWalletId, walletIds))
      .orderBy(desc(transactions.createdAt))
      .limit(200);

    // Map wallet IDs to agent IDs for edges
    const edges: Array<{
      source: number;
      target: number;
      type: string;
      label?: string;
      amount: string;
    }> = [];

    for (const ag of activeAgreements) {
      const sourceAgent = walletToAgent.get(ag.source);
      const targetAgent = walletToAgent.get(ag.target);
      if (sourceAgent && targetAgent) {
        edges.push({
          source: sourceAgent.id,
          target: targetAgent.id,
          type: "agreement",
          label: ag.type,
          amount: ag.amount,
        });
      }
    }

    for (const tx of recentTxs) {
      if (!tx.source) continue;
      const sourceAgent = walletToAgent.get(tx.source);
      const targetAgent = walletToAgent.get(tx.target);
      if (sourceAgent && targetAgent) {
        edges.push({
          source: sourceAgent.id,
          target: targetAgent.id,
          type: "transaction",
          amount: tx.amount,
        });
      }
    }

    return NextResponse.json({ nodes, edges });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
