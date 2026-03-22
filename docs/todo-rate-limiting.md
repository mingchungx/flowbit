# TODO: Rate Limiting & Abuse Prevention

## Status: Not started

## Problem

No rate limiting, no abuse prevention. A single client can hammer the API with unlimited requests, create unlimited wallets, or attempt to drain funds via rapid-fire payments.

## Requirements

### Request Rate Limiting
- Per-API-key rate limits (e.g., 100 requests/second, 10,000/hour)
- Per-IP rate limits for unauthenticated endpoints
- Return `429 Too Many Requests` with `Retry-After` header
- Use sliding window or token bucket algorithm

### Financial Rate Limiting
- Max wallets per API key (e.g., 100)
- Max transactions per wallet per hour
- Max total volume per API key per day
- These are separate from request rate limits — a request can succeed (200) but the financial operation can be rejected (429)

### Implementation Options
- **In-memory**: Simple Map with timestamps. Works for single-server. Resets on restart.
- **Redis/Valkey**: Persistent, works across multiple server instances. Use `INCR` + `EXPIRE`.
- **Upstash**: Serverless Redis, works well with Vercel/serverless deploys.

### DDoS Protection
- Put Cloudflare or similar in front of the API
- Challenge suspicious traffic before it reaches the app

## Files to Change

- New: `apps/web/src/lib/core/rate-limit.ts` — rate limiter implementation
- All API routes — add rate limit check (ideally as middleware)
- `docker-compose.yml` — add Redis if going that route
