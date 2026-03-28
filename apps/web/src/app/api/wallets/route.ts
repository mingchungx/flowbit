import { NextRequest, NextResponse } from "next/server";
import { createWallet, listWallets } from "@/lib/core/ledger";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";
import { enforceWalletCreationLimit } from "@/lib/core/financial-limits";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);

      const body = await request.json();
      const { name } = body;

      if (!name || typeof name !== "string") {
        return NextResponse.json(
          { error: "name is required and must be a string" },
          { status: 400 }
        );
      }

      // Financial limit: max wallets per API key
      await enforceWalletCreationLimit(auth.keyId);

      const wallet = await createWallet(name, auth.keyId);
      return NextResponse.json(wallet, { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  });
}

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      const auth = await requireAuth(request);

      // Agents see only their wallets; admins see all
      const ownerFilter = auth.scope === "admin" ? undefined : auth.keyId;
      const result = await listWallets(ownerFilter);
      return NextResponse.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
