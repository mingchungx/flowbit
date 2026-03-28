import { NextRequest, NextResponse } from "next/server";
import { getAgreement } from "@/lib/core/agreements";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request);
      const { id } = await params;
      const agreement = await getAgreement(id);
      return NextResponse.json(agreement);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
