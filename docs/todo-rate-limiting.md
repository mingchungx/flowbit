# TODO: Rate Limiting & Abuse Prevention

## Status: Partial (request rate limiting done)

## Completed

### Request Rate Limiting
- [x] Per-API-key rate limiter: 100 requests/second (sliding window)
- [x] Per-IP rate limiter for unauthenticated endpoints: 20 requests/second
- [x] Rate limit enforced during authentication (auth.ts)
- [x] In-memory implementation with automatic cleanup of expired entries
- [x] Returns 401 with retry-after message when exceeded

## Remaining

### Financial Rate Limiting
- [ ] Max wallets per API key (e.g., 100)
- [ ] Max transactions per wallet per hour
- [ ] Max total volume per API key per day
- [ ] These should be separate from request rate limits

### Persistent Rate Limiting
- [ ] Redis/Valkey backend for multi-server deployments
- [ ] Upstash for serverless environments
- [ ] Currently in-memory — resets on server restart

### DDoS Protection
- [ ] Cloudflare or similar CDN/WAF in front of the API
- [ ] Challenge suspicious traffic before it reaches the app

## Files Changed

- `apps/web/src/lib/core/rate-limit.ts` — sliding window rate limiter
- `apps/web/src/lib/core/auth.ts` — integrates rate limiting with auth
