import { NextRequest, NextResponse } from "next/server";
import { getWallet, WalletNotFoundError } from "@/lib/core/ledger";
import { getOnChainBalance } from "@/lib/chain";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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
    if (error instanceof WalletNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
