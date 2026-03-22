import { NextRequest, NextResponse } from "next/server";
import { fundWallet, WalletNotFoundError } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership, handleAuthError } from "@/lib/core/auth";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    await assertWalletOwnership(id, auth);

    const body = await request.json();
    const { amount, idempotency_key } = body;

    if (!amount || typeof amount !== "number" || amount <= 0) {
      return NextResponse.json(
        { error: "amount must be a positive number" },
        { status: 400 }
      );
    }

    const key = idempotency_key || `fund_${id}_${randomUUID()}`;
    const tx = await fundWallet(id, amount, key);
    return NextResponse.json(tx, { status: 201 });
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    if (error instanceof WalletNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
