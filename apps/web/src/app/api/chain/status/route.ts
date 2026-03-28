import { NextRequest, NextResponse } from "next/server";
import { requireAuth, handleAuthError } from "@/lib/core/auth";
import { getChainStatus } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request, { scope: "admin" });

    const status = await getChainStatus();

    return NextResponse.json({
      ...status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
