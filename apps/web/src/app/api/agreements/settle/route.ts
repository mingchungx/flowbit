import { NextRequest, NextResponse } from "next/server";
import { settleDueAgreements } from "@/lib/core/agreements";
import { requireAuth } from "@/lib/core/auth";
import { handleApiError } from "@/lib/core/api-errors";
import { withRequestLogging } from "@/lib/core/request-logger";

export async function POST(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await requireAuth(request);
      const result = await settleDueAgreements();
      return NextResponse.json(result);
    } catch (error) {
      return handleApiError(error);
    }
  });
}
