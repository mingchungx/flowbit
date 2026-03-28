import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";
import { isChainConfigured, getChainStatus } from "@/lib/chain";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const include = searchParams.get("include");

  let dbOk = false;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch {
    // Database unreachable
  }

  const result: Record<string, unknown> = {
    status: dbOk ? "ok" : "error",
    timestamp: new Date().toISOString(),
    database: dbOk ? "connected" : "unreachable",
  };

  // Include chain health if requested
  if (include === "chain") {
    if (!isChainConfigured()) {
      result.chain = {
        configured: false,
        message:
          "On-chain integration is not configured. " +
          "Set DEPLOYER_PRIVATE_KEY and TEST_USDC_ADDRESS in apps/web/.env.local to enable.",
      };
    } else {
      try {
        const chainStatus = await getChainStatus();
        result.chain = {
          configured: true,
          rpcReachable: chainStatus.rpcReachable,
          contractReadable: chainStatus.contractReadable,
          deployerHasGas: chainStatus.deployerHasGas,
          deployerEthBalance: chainStatus.deployerEthBalance,
        };
        // Degrade overall status if chain is requested but unhealthy
        if (
          !chainStatus.rpcReachable ||
          !chainStatus.contractReadable ||
          !chainStatus.deployerHasGas
        ) {
          result.status = "degraded";
        }
      } catch {
        result.chain = { configured: true, error: "Chain health check failed" };
        result.status = "degraded";
      }
    }
  }

  if (!dbOk) {
    return NextResponse.json(result, { status: 503 });
  }

  const httpStatus = result.status === "ok" ? 200 : 207;
  return NextResponse.json(result, { status: httpStatus });
}
