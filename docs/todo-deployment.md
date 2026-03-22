# TODO: Deployment

## Status: Partial

**Done:** Dockerfile, CI pipeline (GitHub Actions), env template, standalone Next.js output.
**Not done:** Deploy-on-merge pipeline, managed Postgres, DNS/TLS.

## Done

- [x] Multi-stage Dockerfile: deps -> build -> production (non-root `nextjs` user)
- [x] `next.config.ts` set to `output: "standalone"` for minimal Docker image
- [x] `.github/workflows/ci.yml` — lint, typecheck, test on every PR and push to main
- [x] CI tests run against real Postgres via service container
- [x] SDK built before typecheck to satisfy cross-package type resolution
- [x] `apps/web/.env.production.example` with all required/optional vars

## Not Done

### Deploy Pipeline
- [ ] `.github/workflows/deploy.yml` — auto-deploy on merge to main
- [ ] Target platform decision: Railway, Fly.io, Render, or self-hosted VPS
- [ ] Run `pnpm db:migrate` as part of deploy (not `db:push`)

### Managed Database
- [ ] Managed Postgres: Neon, Supabase, Railway Postgres, or RDS
- [ ] Connection pooling for production load (PgBouncer or built-in)
- [ ] Automated backups
- [ ] SSL required for connections

### DNS & TLS
- [ ] Custom domain with HTTPS (e.g., `api.flowbit.dev`)
- [ ] API versioning strategy (start with flat `/api/` or move to `/api/v1/`)
