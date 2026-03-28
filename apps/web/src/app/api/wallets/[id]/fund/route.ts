import { NextRequest, NextResponse } from "next/server";
import { fundWallet } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";
import { enforceFundingLimits } from "@/lib/core/financial-limits";
import { randomUUID } from "crypto";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
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

      // Financial limit: daily USDC volume
      await enforceFundingLimits({
        keyId: auth.keyId,
        amount,
      });

      const key = idempotency_key || `fund_${id}_${randomUUID()}`;
      const tx = await fundWallet(id, amount, key);
      return NextResponse.json(tx, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
