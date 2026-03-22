# TODO: Deployment

## Status: Partial (Dockerfile + CI done)

## Completed

### Dockerfile
- [x] Multi-stage Docker build: deps → build → production
- [x] Uses Next.js standalone output for minimal image size
- [x] Runs as non-root `nextjs` user
- [x] `next.config.ts` set to `output: "standalone"`

### CI/CD
- [x] `.github/workflows/ci.yml` — lint, typecheck, test on every PR and push to main
- [x] Tests run against real Postgres (service container)
- [x] Uses pnpm caching for fast installs

### Environment Template
- [x] `apps/web/.env.production.example` with all required/optional vars

## Remaining

### Deploy Pipeline
- [ ] `.github/workflows/deploy.yml` — deploy on merge to main
- [ ] Target platform: Railway, Fly.io, Render, or self-hosted VPS
- [ ] Run `pnpm db:migrate` as part of deploy

### Database
- [ ] Managed Postgres (Neon, Supabase, Railway Postgres, or RDS)
- [ ] Connection pooling for production load
- [ ] Automated backups
- [ ] SSL required

### DNS & TLS
- [ ] Custom domain with HTTPS
- [ ] API versioning strategy

## Files Changed

- `Dockerfile` — multi-stage production build
- `.github/workflows/ci.yml` — CI pipeline
- `apps/web/.env.production.example` — env var template
- `apps/web/next.config.ts` — standalone output
