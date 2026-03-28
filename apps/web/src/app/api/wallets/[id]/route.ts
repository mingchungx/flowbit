import { NextRequest, NextResponse } from "next/server";
import { getWallet } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);
      const { id } = await params;
      await assertWalletOwnership(id, auth);

      const wallet = await getWallet(id);
      return NextResponse.json(wallet);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
