import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { policies, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, handleAuthError } from "@/lib/core/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { scope: "admin" });

    const walletLookup = db
      .select({ id: wallets.id, name: wallets.name })
      .from(wallets)
      .as("wallet_lookup");

    const result = await db
      .select({
        id: policies.id,
        walletId: policies.walletId,
        walletName: walletLookup.name,
        type: policies.type,
        params: policies.params,
        active: policies.active,
        createdAt: policies.createdAt,
      })
      .from(policies)
      .innerJoin(walletLookup, eq(policies.walletId, walletLookup.id))
      .where(eq(policies.active, true));

    return NextResponse.json(result);
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
