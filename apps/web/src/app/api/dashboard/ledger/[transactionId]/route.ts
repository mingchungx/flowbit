import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, ledgerEntries, wallets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
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
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
