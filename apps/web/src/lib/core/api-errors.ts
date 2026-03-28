import { NextResponse } from "next/server";
import { AuthenticationError, AuthorizationError } from "./auth";
import {
  WalletNotFoundError,
  InsufficientFundsError,
  PolicyViolationError,
  DuplicateTransactionError,
} from "./ledger";
import {
  AgreementNotFoundError,
  InvalidAgreementError,
} from "./agreements";
import { FinancialLimitExceededError } from "./financial-limits";
import { logger } from "@/lib/logger";

/**
 * Centralized API error handler.
 *
 * Maps known error types to appropriate HTTP status codes with safe messages.
 * Unknown errors return 500 with a generic message — internal details are
 * never leaked to the client.
 */
export function handleApiError(error: unknown): NextResponse {
  // ── Authentication / Authorization ──
  if (error instanceof AuthenticationError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // ── Not Found ──
  if (error instanceof WalletNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AgreementNotFoundError) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }

  // ── Client Errors (validation / policy) ──
  if (error instanceof InvalidAgreementError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof PolicyViolationError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }

  // ── Conflict ──
  if (error instanceof DuplicateTransactionError) {
    return NextResponse.json({ error: error.message }, { status: 409 });
  }

  // ── Unprocessable (financial) ──
  if (error instanceof InsufficientFundsError) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }

  // ── Financial rate limits ──
  if (error instanceof FinancialLimitExceededError) {
    return NextResponse.json({ error: error.message }, { status: 429 });
  }

  // ── Unknown errors: log and return generic message ──
  logger.error("Unhandled error in API route", {
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });

  return NextResponse.json(
    { error: "Internal server error" },
    { status: 500 }
  );
}
