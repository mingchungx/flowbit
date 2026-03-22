# TODO: Observability & Monitoring

## Status: Partial

**Done:** Structured JSON logger, health check endpoint, financial operation logging.
**Not done:** Per-request logging middleware, metrics export, alerting.

## Done

- [x] JSON structured logger (`apps/web/src/lib/logger.ts`) — zero dependencies, log levels (debug/info/warn/error), child loggers, configurable via `LOG_LEVEL` env
- [x] Financial operation logging — wallet creation, funding, and payments log to stdout with context (walletId, amount, transactionId)
- [x] Errors write to stderr, everything else to stdout
- [x] `GET /api/health` — returns 200 if DB reachable, 503 if not; suitable for load balancer probes

## Not Done

### Request Logging
- [ ] Log every API request with: method, path, status code, duration ms, API key ID
- [ ] Next.js middleware or route wrapper for uniform coverage

### Metrics Export
- [ ] Request rate, latency percentiles (p50/p95/p99) per endpoint
- [ ] Transaction volume (count + USDC amount) per hour/day
- [ ] Active wallets, active agreements, settlement success/failure rate
- [ ] DB connection pool usage
- [ ] Export to Prometheus, Datadog, or similar

### Alerting
- [ ] Balance inconsistency: cached wallet balance != SUM(ledger entries)
- [ ] Settlement failures
- [ ] Error rate spike
- [ ] DB connection pool exhaustion
- [ ] API latency > threshold
