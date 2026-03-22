import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { transactions, wallets } from "@/lib/db/schema";
import { sql, gt, desc, eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const since = request.nextUrl.searchParams.get("since");
    const limit = parseInt(
      request.nextUrl.searchParams.get("limit") || "50",
      10
    );
    const walletId = request.nextUrl.searchParams.get("wallet_id");

    const fromWallet = db
      .select({ id: wallets.id, name: wallets.name })
      .from(wallets)
      .as("from_wallet");
    const toWallet = db
      .select({ id: wallets.id, name: wallets.name })
      .from(wallets)
      .as("to_wallet");

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
      .limit(limit)
      .$dynamic();

    if (since) {
      query = query.where(gt(transactions.createdAt, new Date(since)));
    }

    if (walletId) {
      query = query.where(
        sql`(${transactions.fromWalletId} = ${walletId} OR ${transactions.toWalletId} = ${walletId})`
      );
    }

    const rows = await query;

    const result = rows.map((row) => ({
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

    return NextResponse.json({ transactions: result });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
