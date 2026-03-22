import { NextRequest, NextResponse } from "next/server";
import {
  cancelAgreement,
  AgreementNotFoundError,
} from "@/lib/core/agreements";
import { requireAuth, handleAuthError } from "@/lib/core/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(request);
    const { id } = await params;
    const agreement = await cancelAgreement(id);
    return NextResponse.json(agreement);
  } catch (error) {
    const authResp = handleAuthError(error);
    if (authResp) return authResp;
    if (error instanceof AgreementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
