import { NextResponse } from "next/server";
import { getRunner } from "@/lib/engine/singleton";
import { db } from "@/lib/db";
import { wallets } from "@/lib/db/schema";
import { inArray } from "drizzle-orm";

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

    const walletRows = await db
      .select({ id: wallets.id, balance: wallets.balance })
      .from(wallets)
      .where(inArray(wallets.id, walletIds));

    const balanceMap = new Map(walletRows.map((w) => [w.id, w.balance]));

    const agents = state.agents.map((a) => ({
      id: a.id,
      name: a.name,
      profession: a.profession,
      riskTolerance: a.riskTolerance,
      servicePrice: a.servicePrice,
      balance: balanceMap.get(a.walletId) ?? "0",
      walletId: a.walletId,
    }));

    return NextResponse.json({ agents });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
