import { NextRequest, NextResponse } from "next/server";
import {
  cancelAgreement,
  AgreementNotFoundError,
} from "@/lib/core/agreements";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const agreement = await cancelAgreement(id);
    return NextResponse.json(agreement);
  } catch (error) {
    if (error instanceof AgreementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
