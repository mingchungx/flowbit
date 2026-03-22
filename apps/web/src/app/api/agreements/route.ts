import { NextRequest, NextResponse } from "next/server";
import {
  createAgreement,
  listAgreements,
  InvalidAgreementError,
} from "@/lib/core/agreements";
import {
  WalletNotFoundError,
  InsufficientFundsError,
} from "@/lib/core/ledger";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { payer_wallet_id, payee_wallet_id, type, amount, unit, interval, metadata } = body;

    if (!payer_wallet_id || typeof payer_wallet_id !== "string") {
      return NextResponse.json(
        { error: "payer_wallet_id is required and must be a string" },
        { status: 400 }
      );
    }

    if (!payee_wallet_id || typeof payee_wallet_id !== "string") {
      return NextResponse.json(
        { error: "payee_wallet_id is required and must be a string" },
        { status: 400 }
      );
    }

    if (!type || typeof type !== "string") {
      return NextResponse.json(
        { error: "type is required and must be a string" },
        { status: 400 }
      );
    }

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    if (type === "usage" && (!unit || typeof unit !== "string")) {
      return NextResponse.json(
        { error: "unit is required for usage agreements" },
        { status: 400 }
      );
    }

    if (!interval || typeof interval !== "string") {
      return NextResponse.json(
        { error: "interval is required and must be a string" },
        { status: 400 }
      );
    }

    const agreement = await createAgreement({
      payerWalletId: payer_wallet_id,
      payeeWalletId: payee_wallet_id,
      type: type as "subscription" | "usage" | "retainer",
      amount,
      unit,
      interval: interval as "daily" | "weekly" | "monthly",
      metadata,
    });

    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    if (error instanceof InvalidAgreementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof WalletNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InsufficientFundsError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const wallet_id = searchParams.get("wallet_id") || undefined;
    const type = searchParams.get("type") || undefined;
    const status = searchParams.get("status") || undefined;

    const result = await listAgreements({
      walletId: wallet_id,
      type: type as "subscription" | "usage" | "retainer" | undefined,
      status: status as "active" | "paused" | "cancelled" | "completed" | undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
