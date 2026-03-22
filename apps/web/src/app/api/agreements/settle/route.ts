import { NextResponse } from "next/server";
import { settleDueAgreements } from "@/lib/core/agreements";

export async function POST() {
  try {
    const result = await settleDueAgreements();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
