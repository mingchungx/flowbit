# TODO: Observability & Monitoring

## Status: Partial (structured logging + health check done)

## Completed

### Structured Logging
- [x] JSON-formatted logger in `apps/web/src/lib/logger.ts` (zero-dependency)
- [x] Log levels: debug, info, warn, error (configurable via `LOG_LEVEL` env)
- [x] Child loggers with bound context
- [x] Financial operations logged: wallet creation, funding, payments
- [x] Errors write to stderr, info/debug/warn to stdout

### Health Check
- [x] `GET /api/health` — returns 200 + `{ status: "ok" }` if DB is reachable, 503 if not
- [x] Suitable for load balancer and uptime monitor health probes

## Remaining

### Request Logging
- [ ] Log every API request with method, path, status, duration, API key ID
- [ ] Consider a Next.js middleware or wrapper for uniform request logging

### Metrics
- [ ] Request rate, latency percentiles (p50, p95, p99) per endpoint
- [ ] Transaction volume (count and USDC amount) per hour/day
- [ ] Active wallets count, active agreements count
- [ ] Settlement success/failure rate
- [ ] DB connection pool usage
- [ ] Export to Prometheus, Datadog, or similar

### Alerting
- [ ] Balance inconsistency: cached wallet balance != sum of ledger entries
- [ ] Settlement failures
- [ ] Error rate spike
- [ ] DB connection pool exhaustion
- [ ] API latency > threshold

## Files Changed

- `apps/web/src/lib/logger.ts` — structured logger
- `apps/web/src/app/api/health/route.ts` — health check endpoint
- `apps/web/src/lib/core/ledger.ts` — operation logging
