import { NextRequest, NextResponse } from "next/server";
import { sendPayment } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";
import { enforcePaymentLimits } from "@/lib/core/financial-limits";
import { randomUUID } from "crypto";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);

      const body = await request.json();
      const { from, to, amount, idempotency_key, memo } = body;

      if (!from || typeof from !== "string") {
        return NextResponse.json(
          { error: "from wallet ID is required" },
          { status: 400 }
        );
      }

      if (!to || typeof to !== "string") {
        return NextResponse.json(
          { error: "to wallet ID is required" },
          { status: 400 }
        );
      }

      if (!amount || typeof amount !== "number" || amount <= 0) {
        return NextResponse.json(
          { error: "amount must be a positive number" },
          { status: 400 }
        );
      }

      // Only the owner of the source wallet can send from it
      await assertWalletOwnership(from, auth);

      // Financial limits: tx rate + daily volume
      await enforcePaymentLimits({
        keyId: auth.keyId,
        fromWalletId: from,
        amount,
      });

      const key = idempotency_key || randomUUID();

      const tx = await sendPayment({
        from,
        to,
        amount,
        idempotencyKey: key,
        memo,
      });

      return NextResponse.json(tx, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  });
}
