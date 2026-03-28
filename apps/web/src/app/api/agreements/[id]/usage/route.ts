import { NextRequest, NextResponse } from "next/server";
import { reportUsage } from "@/lib/core/agreements";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request);
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
      return handleApiError(error);
    }
  });
}
