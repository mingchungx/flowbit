import { NextRequest, NextResponse } from "next/server";
import { createWallet, listWallets } from "@/lib/core/ledger";
import { requireAuth, handleAuthError } from "@/lib/core/auth";

export async function POST(request: NextRequest) {
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

    const wallet = await createWallet(name, auth.keyId);
    return NextResponse.json(wallet, { status: 201 });
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);

    // Agents see only their wallets; admins see all
    const ownerFilter = auth.scope === "admin" ? undefined : auth.keyId;
    const result = await listWallets(ownerFilter);
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
