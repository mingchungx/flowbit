# TODO: Deployment

## Status: Not started

## Problem

Everything runs on localhost. No agent outside your machine can reach the API.

## Requirements

### API Server
- Deploy `apps/web` to a platform with persistent server process (not pure serverless — SSE needs long-lived connections)
- Options: Railway, Fly.io, Render, self-hosted VPS
- Vercel works for the API routes but SSE streams will hit function timeout limits
- Needs a public URL (e.g., `https://api.flowbit.dev`)

### Database
- Managed Postgres (Neon, Supabase, Railway Postgres, or RDS)
- Connection pooling for production load (PgBouncer or Neon's built-in)
- Automated backups
- SSL required

### Environment
- `DATABASE_URL` pointing to managed Postgres
- `DEPLOYER_PRIVATE_KEY` and `TEST_USDC_ADDRESS` for on-chain ops
- `BASE_SEPOLIA_RPC_URL` — use a dedicated RPC (Alchemy, Infura) instead of the public endpoint which rate-limits

### CI/CD
- GitHub Actions: lint, typecheck, test on every PR
- Deploy on merge to main
- Run `pnpm db:migrate` as part of deploy (not `db:push`)

### DNS & TLS
- Custom domain with HTTPS
- API versioning strategy (start with `/api/v1/` prefix or accept the current flat structure for now)

## Files to Change

- Add `Dockerfile` for the web app
- Add `.github/workflows/ci.yml` — lint + typecheck + test
- Add `.github/workflows/deploy.yml` — deploy on merge
- Switch from `db:push` to `db:migrate` in production
- Add `apps/web/.env.production` template
