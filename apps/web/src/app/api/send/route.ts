import { NextRequest, NextResponse } from "next/server";
import {
  sendPayment,
  InsufficientFundsError,
  PolicyViolationError,
  WalletNotFoundError,
  DuplicateTransactionError,
} from "@/lib/core/ledger";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { from, to, amount, idempotency_key, memo } = body;

    if (!from || typeof from !== "string") {
      return NextResponse.json(
        { error: "from wallet ID is required" },
        { status: 400 }
      );
    }

    if (!to || typeof to !== "string") {
      return NextResponse.json(
        { error: "to wallet ID is required" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    const key = idempotency_key || randomUUID();

    const tx = await sendPayment({
      from,
      to,
      amount,
      idempotencyKey: key,
      memo,
    });

    return NextResponse.json(tx, { status: 201 });
  } catch (error) {
    if (error instanceof WalletNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof PolicyViolationError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof DuplicateTransactionError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
