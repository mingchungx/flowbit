import { NextRequest, NextResponse } from "next/server";
import { getTransactions } from "@/lib/core/ledger";

export async function GET(request: NextRequest) {
  try {
    const walletId = request.nextUrl.searchParams.get("wallet_id");

    if (!walletId) {
      return NextResponse.json(
        { error: "wallet_id query parameter is required" },
        { status: 400 }
      );
    }

    const result = await getTransactions(walletId);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 }
    );
  }
}
