import { randomBytes, createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { apiKeys, wallets } from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { logger } from "@/lib/logger";
import { apiKeyLimiter, ipLimiter, getClientIp } from "./rate-limit";

// ── Types ──

export interface AuthContext {
  keyId: string;
  scope: "agent" | "admin";
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

// ── Key generation ──

export function generateApiKey(scope: "agent" | "admin"): {
  raw: string;
  hash: string;
} {
  const prefix = scope === "admin" ? "fb_admin_" : "fb_live_";
  const random = randomBytes(24).toString("base64url");
  const raw = `${prefix}${random}`;
  const hash = hashApiKey(raw);
  return { raw, hash };
}

export function hashApiKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

// ── Authentication ──

export async function requireAuth(
  request: NextRequest,
  options?: { scope?: "agent" | "admin" }
): Promise<AuthContext> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new AuthenticationError(
      "Missing or invalid Authorization header"
    );
  }

  const rawKey = authHeader.slice(7);
  const keyHash = hashApiKey(rawKey);

  const [key] = await db
    .select({
      id: apiKeys.id,
      scope: apiKeys.scope,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)));

  if (!key) {
    throw new AuthenticationError("Invalid API key");
  }

  // Check rate limit for this key
  const rl = apiKeyLimiter.check(key.id);
  if (!rl.allowed) {
    throw new AuthenticationError(
      `Rate limit exceeded. Retry after ${Math.ceil(rl.retryAfterMs / 1000)}s`
    );
  }

  // Scope check
  if (options?.scope === "admin" && key.scope !== "admin") {
    throw new AuthorizationError("Admin access required");
  }

  return { keyId: key.id, scope: key.scope as "agent" | "admin" };
}

// ── Wallet ownership ──

export async function assertWalletOwnership(
  walletId: string,
  auth: AuthContext
): Promise<void> {
  if (auth.scope === "admin") return;

  const [wallet] = await db
    .select({ ownerKeyId: wallets.ownerKeyId })
    .from(wallets)
    .where(eq(wallets.id, walletId));

  if (!wallet) return; // Let WalletNotFoundError handle this downstream
  if (wallet.ownerKeyId !== auth.keyId) {
    throw new AuthorizationError("Not authorized to access this wallet");
  }
}

// ── Key management (used by admin endpoints) ──

export async function createApiKey(
  name: string,
  scope: "agent" | "admin"
): Promise<{ id: string; key: string; name: string; scope: string }> {
  const { raw, hash } = generateApiKey(scope);
  const [record] = await db
    .insert(apiKeys)
    .values({ keyHash: hash, name, scope })
    .returning({ id: apiKeys.id, name: apiKeys.name, scope: apiKeys.scope });

  logger.info("API key created", { keyId: record.id, name, scope });
  return { id: record.id, key: raw, name: record.name, scope: record.scope };
}

export async function revokeApiKey(keyId: string): Promise<void> {
  await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(eq(apiKeys.id, keyId));

  logger.info("API key revoked", { keyId });
}

export async function listApiKeys() {
  return db
    .select({
      id: apiKeys.id,
      name: apiKeys.name,
      scope: apiKeys.scope,
      createdAt: apiKeys.createdAt,
      revokedAt: apiKeys.revokedAt,
    })
    .from(apiKeys)
    .orderBy(apiKeys.createdAt);
}

// ── Helpers for route handlers ──

/**
 * Standard auth error handler for catch blocks.
 */
export function handleAuthError(error: unknown): NextResponse | null {
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  return null;
}

/**
 * Rate limit check for unauthenticated endpoints (health, etc.).
 */
export function checkIpRateLimit(request: NextRequest): NextResponse | null {
  const ip = getClientIp(request);
  const rl = ipLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      {
        status: 429,
        headers: {
          "Retry-After": String(Math.ceil(rl.retryAfterMs / 1000)),
        },
      }
    );
  }
  return null;
}
