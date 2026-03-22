import { NextRequest, NextResponse } from "next/server";
import {
  reportUsage,
  AgreementNotFoundError,
  InvalidAgreementError,
} from "@/lib/core/agreements";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { quantity } = body;

    if (!quantity || typeof quantity !== "number" || quantity <= 0) {
      return NextResponse.json(
        { error: "quantity must be a positive number" },
        { status: 400 }
      );
    }

    const record = await reportUsage(id, quantity);
    return NextResponse.json(record, { status: 201 });
  } catch (error) {
    if (error instanceof AgreementNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidAgreementError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
