import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership, handleAuthError } from "@/lib/core/auth";

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    const walletId = request.nextUrl.searchParams.get("wallet_id");

    if (!walletId) {
      return NextResponse.json(
        { error: "wallet_id query parameter is required" },
        { status: 400 }
      );
    }

    await assertWalletOwnership(walletId, auth);

    const result = await getTransactions(walletId);
    return NextResponse.json(result);
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
