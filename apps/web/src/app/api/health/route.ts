import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { withRequestLogging } from "@/lib/core/request-logger";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  return withRequestLogging(request, async () => {
    try {
      await db.execute(sql`SELECT 1`);
      return NextResponse.json({
        status: "ok",
        timestamp: new Date().toISOString(),
      });
    } catch {
      return NextResponse.json(
        { status: "error", error: "Database unreachable" },
        { status: 503 }
      );
    }
  });
}
