import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, ledgerEntries, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request, { scope: "admin" });

      const { transactionId } = await params;

      const [tx] = await db
        .select()
        .from(transactions)
        .where(eq(transactions.id, transactionId));

      if (!tx) {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }

      const walletLookup = db
        .select({ id: wallets.id, name: wallets.name })
        .from(wallets)
        .as("wallet_lookup");

      const entries = await db
        .select({
          id: ledgerEntries.id,
          walletId: ledgerEntries.walletId,
          walletName: walletLookup.name,
          amount: ledgerEntries.amount,
          direction: ledgerEntries.direction,
          createdAt: ledgerEntries.createdAt,
        })
        .from(ledgerEntries)
        .innerJoin(walletLookup, eq(ledgerEntries.walletId, walletLookup.id))
        .where(eq(ledgerEntries.transactionId, transactionId));

      return NextResponse.json({
        transaction: {
          id: tx.id,
          idempotencyKey: tx.idempotencyKey,
          amount: tx.amount,
          memo: tx.memo,
          status: tx.status,
          txHash: tx.txHash,
          createdAt: tx.createdAt,
        },
        entries,
      });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
