import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { hashApiKey } from "./auth";

/**
 * Extract a safe API key identifier from the Authorization header.
 *
 * Returns the first 8 characters of the SHA-256 hash of the raw key,
 * so the full key is never logged. Returns "anonymous" when no valid
 * Bearer token is present.
 */
function extractKeyId(request: NextRequest): string {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return "anonymous";
  }
  const rawKey = authHeader.slice(7);
  const hash = hashApiKey(rawKey);
  return hash.slice(0, 8);
}

/**
 * Wrap a route handler with structured request logging.
 *
 * Logs at the start and end of each request with method, path,
 * status code, duration, and an abbreviated API key identifier.
 *
 * Usage:
 * ```ts
 * export async function POST(request: NextRequest) {
 *   return withRequestLogging(request, async () => {
 *     // ... handler logic, return NextResponse
 *   });
 * }
 * ```
 */
export async function withRequestLogging(
  request: NextRequest,
  handler: () => Promise<NextResponse | Response>
): Promise<NextResponse | Response> {
  const start = Date.now();
  const method = request.method;
  const path = request.nextUrl.pathname;
  const keyId = extractKeyId(request);

  logger.info("request.start", { method, path, keyId });

  let response: NextResponse | Response;
  try {
    response = await handler();
  } catch (error) {
    // If the handler throws without returning a response, log and re-throw.
    // In practice route handlers should catch errors and return responses,
    // but this is a safety net.
    const durationMs = Date.now() - start;
    logger.error("request.error", {
      method,
      path,
      keyId,
      durationMs,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  const durationMs = Date.now() - start;
  logger.info("request.end", { method, path, keyId, status: response.status, durationMs });

  return response;
}
