import { NextRequest, NextResponse } from "next/server";
import { getWallet, WalletNotFoundError } from "@/lib/core/ledger";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const wallet = await getWallet(id);
    return NextResponse.json(wallet);
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
