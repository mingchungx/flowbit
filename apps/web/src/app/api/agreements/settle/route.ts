import { NextRequest, NextResponse } from "next/server";
import { settleDueAgreements } from "@/lib/core/agreements";
import { requireAuth, handleAuthError } from "@/lib/core/auth";

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);
    const result = await settleDueAgreements();
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
