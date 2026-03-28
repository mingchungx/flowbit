# TODO: Observability & Monitoring

## Status: Partial

**Done:** Structured JSON logger, health check endpoint, financial operation logging, per-request logging.
**Not done:** Metrics export, alerting.

## Done

- [x] JSON structured logger (`apps/web/src/lib/logger.ts`) — zero dependencies, log levels (debug/info/warn/error), child loggers, configurable via `LOG_LEVEL` env
- [x] Financial operation logging — wallet creation, funding, and payments log to stdout with context (walletId, amount, transactionId)
- [x] Errors write to stderr, everything else to stdout
- [x] `GET /api/health` — returns 200 if DB reachable, 503 if not; suitable for load balancer probes
- [x] Per-request logging via `withRequestLogging` wrapper (`apps/web/src/lib/core/request-logger.ts`) — logs method, path, status code, duration ms, and abbreviated API key ID (first 8 chars of SHA-256 hash) for every API request
- [x] All 20 route handlers wrapped with `withRequestLogging` for uniform coverage

## Not Done

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
