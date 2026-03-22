# TODO: Rate Limiting & Abuse Prevention

## Status: Partial

**Done:** Per-key and per-IP request rate limiting (in-memory sliding window).
**Not done:** Financial rate limits, Redis backend, DDoS protection.

## Done

- [x] Per-API-key rate limiter: 100 requests/second sliding window (`apps/web/src/lib/core/rate-limit.ts`)
- [x] Per-IP rate limiter for unauthenticated endpoints: 20 requests/second
- [x] Integrated into auth middleware — checked on every authenticated request
- [x] Automatic cleanup of expired entries every 60s
- [x] Returns retry-after guidance when limit exceeded

## Not Done

### Financial Rate Limits
- [ ] Max wallets per API key (e.g., 100)
- [ ] Max transactions per wallet per hour
- [ ] Max total USDC volume per API key per day
- [ ] These are separate from request limits — a 200 request can still reject the financial operation

### Persistent Rate Limiting
- [ ] Redis/Valkey backend for multi-server deployments (current in-memory store resets on restart)
- [ ] Upstash option for serverless environments

### DDoS Protection
- [ ] Cloudflare or similar CDN/WAF in front of the API
- [ ] Challenge suspicious traffic before it reaches the app
