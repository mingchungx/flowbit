import { NextRequest, NextResponse } from "next/server";
import { getWallet, WalletNotFoundError } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership, handleAuthError } from "@/lib/core/auth";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    const { id } = await params;
    await assertWalletOwnership(id, auth);

    const wallet = await getWallet(id);
    return NextResponse.json(wallet);
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
