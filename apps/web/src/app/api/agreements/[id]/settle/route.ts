import { NextRequest, NextResponse } from "next/server";
import { settleAgreement } from "@/lib/core/agreements";
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
      const agreement = await settleAgreement(id);
      return NextResponse.json(agreement);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
