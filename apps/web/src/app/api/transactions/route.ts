import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
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
      return handleApiError(error);
    }
  });
}
