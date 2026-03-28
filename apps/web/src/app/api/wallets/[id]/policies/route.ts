import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { policies } from "@/lib/db/schema";
import { getWallet } from "@/lib/core/ledger";
import { requireAuth, assertWalletOwnership } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";
import { eq, and } from "drizzle-orm";
import type { PolicyType, PolicyParams } from "@/lib/core/policies";

const VALID_TYPES: PolicyType[] = ["max_per_tx", "daily_limit", "allowlist"];

function validateParams(
  type: PolicyType,
  params: PolicyParams
): string | null {
  switch (type) {
    case "max_per_tx":
      if (
        !("max" in params) ||
        typeof params.max !== "number" ||
        params.max <= 0
      ) {
        return "max_per_tx requires params.max as a positive number";
      }
      break;
    case "daily_limit":
      if (
        !("limit" in params) ||
        typeof params.limit !== "number" ||
        params.limit <= 0
      ) {
        return "daily_limit requires params.limit as a positive number";
      }
      break;
    case "allowlist":
      if (
        !("allowed_wallets" in params) ||
        !Array.isArray(params.allowed_wallets) ||
        params.allowed_wallets.length === 0
      ) {
        return "allowlist requires params.allowed_wallets as a non-empty array";
      }
      break;
  }
  return null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);
      const { id } = await params;
      await assertWalletOwnership(id, auth);
      await getWallet(id);

      const body = await request.json();
      const { type, params: policyParams } = body;

      if (!type || !VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `type must be one of: ${VALID_TYPES.join(", ")}` },
          { status: 400 }
        );
      }

      if (!policyParams || typeof policyParams !== "object") {
        return NextResponse.json(
          { error: "params is required and must be an object" },
          { status: 400 }
        );
      }

      const validationError = validateParams(type, policyParams);
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 });
      }

      const [policy] = await db
        .insert(policies)
        .values({
          walletId: id,
          type,
          params: policyParams,
        })
        .returning();

      return NextResponse.json(policy, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);
      const { id } = await params;
      await assertWalletOwnership(id, auth);
      await getWallet(id);

      const result = await db
        .select()
        .from(policies)
        .where(and(eq(policies.walletId, id), eq(policies.active, true)));

      return NextResponse.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
