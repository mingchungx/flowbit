import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { transactions, wallets } from "@/lib/db/schema";
import { gt, desc, eq, sql, and } from "drizzle-orm";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export const dynamic = "force-dynamic";

function buildQuery(walletId: string | null, since: Date) {
  const fromWallet = db
    .select({ id: wallets.id, name: wallets.name })
    .from(wallets)
    .as("from_wallet");
  const toWallet = db
    .select({ id: wallets.id, name: wallets.name })
    .from(wallets)
    .as("to_wallet");

  const conditions = [gt(transactions.createdAt, since)];
  if (walletId) {
    conditions.push(
      sql`(${transactions.fromWalletId} = ${walletId} OR ${transactions.toWalletId} = ${walletId})`
    );
  }

  return db
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
    .where(and(...conditions))
    .orderBy(desc(transactions.createdAt))
    .limit(50);
}

function formatRow(row: {
  id: string;
  amount: string;
  memo: string | null;
  status: string;
  txHash: string | null;
  createdAt: Date;
  fromWalletId: string | null;
  toWalletId: string;
  fromWalletName: string | null;
  toWalletName: string;
}) {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
    // Authenticate before opening the stream
    try {
      await requireAuth(request, { scope: "admin" });
    } catch (error) {
      return handleApiError(error);
    }

    const walletId = request.nextUrl.searchParams.get("wallet_id");

    const encoder = new TextEncoder();
    let cancelled = false;

    const stream = new ReadableStream({
      async start(controller) {
        let cursor = new Date();
        const sentIds = new Set<string>();

        const poll = async () => {
          if (cancelled) return;

          try {
            const rows = await buildQuery(walletId, cursor);
            if (rows.length > 0) {
              cursor = rows[0].createdAt;

              for (const row of rows.reverse()) {
                if (sentIds.has(row.id)) continue;
                sentIds.add(row.id);
                const data = JSON.stringify(formatRow(row));
                controller.enqueue(
                  encoder.encode(`data: ${data}\n\n`)
                );
              }

              if (sentIds.size > 1000) {
                const arr = Array.from(sentIds);
                for (let i = 0; i < arr.length - 500; i++) {
                  sentIds.delete(arr[i]);
                }
              }
            }
          } catch {
            // DB error — skip this tick
          }

          if (!cancelled) {
            setTimeout(poll, 2000);
          }
        };

        controller.enqueue(encoder.encode(`: connected\n\n`));
        poll();
      },
      cancel() {
        cancelled = true;
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  });
}
