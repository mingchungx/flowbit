# TODO: Observability & Monitoring

## Status: Not started

## Problem

No logging, no metrics, no alerting. If something goes wrong in production (failed settlements, balance inconsistencies, DB connection issues), nobody knows until a user reports it.

## Requirements

### Structured Logging
- JSON-formatted logs (pino or similar)
- Every API request logged with: method, path, status, duration, API key
- Every financial operation logged with: type, walletIds, amount, success/failure
- Error logs with stack traces
- Log levels: debug, info, warn, error

### Metrics
- Request rate, latency percentiles (p50, p95, p99) per endpoint
- Transaction volume (count and USDC amount) per hour/day
- Active wallets count
- Active agreements count
- Settlement success/failure rate
- DB connection pool usage
- Export to Prometheus, Datadog, or similar

### Alerting
- Balance inconsistency: cached wallet balance != sum of ledger entries
- Settlement failures
- Error rate spike
- DB connection pool exhaustion
- API latency > threshold

### Health Check
- `GET /api/health` — returns 200 if DB is reachable, 503 if not
- Used by load balancers and uptime monitors

## Files to Change

- New: `apps/web/src/lib/logger.ts` — structured logger setup
- New: `apps/web/src/app/api/health/route.ts` — health check endpoint
- All API routes — add request logging
- `apps/web/src/lib/core/ledger.ts` — add operation logging
