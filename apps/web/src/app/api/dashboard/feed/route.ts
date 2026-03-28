import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, wallets } from "@/lib/db/schema";
import { sql, lt, desc, eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export const dynamic = "force-dynamic";

/**
 * Cursor-based paginated feed for loading transaction history.
 *
 * Query params:
 *   before  -- ISO timestamp cursor (load transactions older than this)
 *   limit   -- page size (default 50, max 200)
 *   wallet_id -- optional filter
 *
 * Returns { transactions, nextCursor } where nextCursor is null if no more pages.
 */
export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request, { scope: "admin" });

      const before = request.nextUrl.searchParams.get("before");
      const walletId = request.nextUrl.searchParams.get("wallet_id");
      const limit = Math.min(
        parseInt(request.nextUrl.searchParams.get("limit") || "50", 10),
        200
      );

      const fromWallet = db
        .select({ id: wallets.id, name: wallets.name })
        .from(wallets)
        .as("from_wallet");
      const toWallet = db
        .select({ id: wallets.id, name: wallets.name })
        .from(wallets)
        .as("to_wallet");

      const conditions = [];
      if (before) {
        conditions.push(lt(transactions.createdAt, new Date(before)));
      }
      if (walletId) {
        conditions.push(
          sql`(${transactions.fromWalletId} = ${walletId} OR ${transactions.toWalletId} = ${walletId})`
        );
      }

      let query = db
        .select({
          id: transactions.id,
          amount: transactions.amount,
          memo: transactions.memo,
          status: transactions.status,
          txHash: transactions.txHash,
          createdAt: transactions.createdAt,
          fromWalletId: transactions.fromWalletId,
          toWalletId: transactions.toWalletId,
          fromWalletName: fromWallet.name,
          toWalletName: toWallet.name,
        })
        .from(transactions)
        .leftJoin(fromWallet, eq(transactions.fromWalletId, fromWallet.id))
        .innerJoin(toWallet, eq(transactions.toWalletId, toWallet.id))
        .orderBy(desc(transactions.createdAt))
        .limit(limit + 1)
        .$dynamic();

      if (conditions.length > 0) {
        query = query.where(and(...conditions));
      }

      const rows = await query;

      const hasMore = rows.length > limit;
      const page = hasMore ? rows.slice(0, limit) : rows;

      const result = page.map((row) => ({
        id: row.id,
        amount: row.amount,
        memo: row.memo,
        status: row.status,
        txHash: row.txHash,
        createdAt: row.createdAt,
        type: row.fromWalletId ? "send" : "fund",
        fromWallet: row.fromWalletId
          ? { id: row.fromWalletId, name: row.fromWalletName }
          : null,
        toWallet: { id: row.toWalletId, name: row.toWalletName },
      }));

      const nextCursor =
        hasMore && page.length > 0
          ? page[page.length - 1].createdAt.toISOString()
          : null;

      return NextResponse.json({ transactions: result, nextCursor });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
