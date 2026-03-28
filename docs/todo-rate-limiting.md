# TODO: Rate Limiting & Abuse Prevention

## Status: Partial

**Done:** Per-key and per-IP request rate limiting (in-memory sliding window), DB-backed financial rate limits.
**Not done:** Redis backend, DDoS protection.

## Done

- [x] Per-API-key rate limiter: 100 requests/second sliding window (`apps/web/src/lib/core/rate-limit.ts`)
- [x] Per-IP rate limiter for unauthenticated endpoints: 20 requests/second
- [x] Integrated into auth middleware — checked on every authenticated request
- [x] Automatic cleanup of expired entries every 60s
- [x] Returns retry-after guidance when limit exceeded
- [x] Max wallets per API key: 100 (DB-backed, `apps/web/src/lib/core/financial-limits.ts`)
- [x] Max transactions per wallet per hour: 60 (DB-backed, queries `transactions` table)
- [x] Max total USDC volume per API key per day: 100,000 (DB-backed, sums across all owned wallets)
- [x] Financial limits are separate from request limits — enforced in route handlers before financial operations
- [x] Returns HTTP 429 with descriptive reason when financial limit exceeded
- [x] Centralized error handling via `handleApiError` (`apps/web/src/lib/core/api-errors.ts`) — maps known errors to HTTP status codes, never leaks internals for unknown errors

## Not Done

### Persistent Rate Limiting
- [ ] Redis/Valkey backend for multi-server deployments (current in-memory store resets on restart)
- [ ] Upstash option for serverless environments

### DDoS Protection
- [ ] Cloudflare or similar CDN/WAF in front of the API
- [ ] Challenge suspicious traffic before it reaches the app
