import { NextRequest, NextResponse } from "next/server";
import { getWallet, WalletNotFoundError } from "@/lib/core/ledger";
import { getOnChainBalance } from "@/lib/chain";
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

    const onChainBalance = await getOnChainBalance(
      wallet.address as `0x${string}`
    );

    return NextResponse.json({
      walletId: wallet.id,
      address: wallet.address,
      ledgerBalance: wallet.balance,
      onChainBalance,
    });
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
