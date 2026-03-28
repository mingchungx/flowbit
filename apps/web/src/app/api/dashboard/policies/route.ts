import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { policies, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
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
      return handleApiError(error);
    }
  });
}
