# CLAUDE.md

## What is this repo

Flowbit is a programmable financial layer for autonomous agents. It lets agents hold USDC in custodial wallets, send payments under policy constraints, and track everything via a double-entry ledger. The system runs off-chain for speed with optional on-chain settlement on Base Sepolia.

## Repo layout

```
flowbit/
├── apps/web/            # Next.js 16 — API server + monitoring dashboard (:3000)
├── apps/simulation/     # Next.js 16 — agent economy simulation (:3001)
├── packages/cli/        # `agent-pay` CLI (Commander.js, hits the API)
├── packages/sdk/        # TypeScript client + agent tool schemas
├── packages/mcp/        # MCP server (stdio transport, wraps SDK)
├── contracts/           # TestUSDC.sol (mintable ERC20 for testnet)
├── docs/                # Design documents
└── docker-compose.yml   # Postgres 16
```

Monorepo managed by **pnpm workspaces**. The workspace root is `pnpm-workspace.yaml`.

## Key tech

- **Next.js 16** with App Router — API lives at `apps/web/src/app/api/`
- **Drizzle ORM** with `postgres` driver — schema at `apps/web/src/lib/db/schema.ts`
- **Postgres 16** — run via `docker compose up -d`
- **viem** — blockchain interaction (Base Sepolia), keypair generation
- **vitest** — integration tests (run against real Postgres, no mocks)

## How to run

```bash
docker compose up -d     # Postgres
pnpm db:push             # Push schema
pnpm dev                 # Start main app at :3000
pnpm sim:dev             # Start simulation at :3001
pnpm test                # Run tests (needs Postgres)
```

## Architecture decisions to know

**Double-entry ledger.** Every balance change creates ledger entries (debit + credit). The `wallets.balance` column is a cached aggregate. Never mutate it directly — always go through `ledger.ts` functions which update it inside a DB transaction.

**Atomic transactions.** `sendPayment` and `fundWallet` use Postgres transactions with `SELECT FOR UPDATE`. Wallet rows are locked in consistent ID order to prevent deadlocks.

**Idempotency.** Every payment has an `idempotency_key` (unique index). Replaying the same key returns the original transaction without re-executing. This is critical for agent safety.

**Policy engine.** Before any outgoing payment, all active policies on the sender wallet are evaluated. If any fails, the payment is rejected. Policy types: `max_per_tx`, `daily_limit`, `allowlist`. Add new types in `apps/web/src/lib/core/policies.ts`.

**On-chain is optional.** The system works fully off-chain. When `TEST_USDC_ADDRESS` and `DEPLOYER_PRIVATE_KEY` env vars are set, funding mints real testnet USDC. Payments stay off-chain; settlement is a future phase.

**Private keys are internal.** The `privateKey` column exists in the DB but is never returned by the API. All public-facing queries use explicit column selection that excludes it.

## Where to find things

| What | Where |
|------|-------|
| DB schema | `apps/web/src/lib/db/schema.ts` |
| DB connection | `apps/web/src/lib/db/index.ts` |
| Ledger + wallet ops | `apps/web/src/lib/core/ledger.ts` |
| Policy engine | `apps/web/src/lib/core/policies.ts` |
| Chain integration | `apps/web/src/lib/chain/` |
| API routes | `apps/web/src/app/api/` |
| Tests | `apps/web/src/lib/core/__tests__/` |
| CLI source | `packages/cli/src/` |
| SDK source | `packages/sdk/src/` |
| MCP server | `packages/mcp/src/index.ts` |
| Agreements engine | `apps/web/src/lib/core/agreements.ts` |
| Dashboard components | `apps/web/src/components/dashboard/` |
| Dashboard API routes | `apps/web/src/app/api/dashboard/` |
| Deploy script | `apps/web/scripts/deploy-test-usdc.ts` |
| Simulation engine | `apps/simulation/src/lib/engine/` |
| Simulation dashboard | `apps/simulation/src/components/` |
| Simulation API | `apps/simulation/src/app/api/simulation/` |

## How to make changes

**Adding a new API endpoint:** Create a `route.ts` in the appropriate `apps/web/src/app/api/` directory. Follow the pattern of existing routes — validate input, call core functions, return appropriate HTTP status codes.

**Adding a new policy type:** Add the check function in `policies.ts`, add the case to the switch in `evaluatePolicies`, add param validation in the policies API route handler.

**Changing the DB schema:** Edit `apps/web/src/lib/db/schema.ts`, then:
- Dev: `pnpm db:push` to apply directly
- Production: `pnpm db:gen <migration-name>` to generate a named migration, then `pnpm db:migrate` to run it
- Verify: `pnpm db:check` to confirm migrations are consistent with the schema

**Adding SDK methods:** Add the method to `packages/sdk/src/index.ts`, update types in `types.ts`, rebuild with `pnpm --filter @flowbit/sdk build`.

**Adding MCP tools:** Add a `server.registerTool(...)` call in `packages/mcp/src/index.ts`. Use zod schemas for input validation. Rebuild with `pnpm --filter @flowbit/mcp build`.

**After changes to CLI/SDK/MCP:** These are compiled TypeScript packages. Rebuild before testing: `pnpm --filter <package> build`.

## Git rules

- **NEVER push to remote.** You may `git add` and `git commit` freely, but never run `git push`.
- **NEVER amend commits.** Always create a new commit. No `git commit --amend`.
- Commit messages follow **conventional commits** with a scope indicating the module:
  ```
  feat(web): add agreement settlement endpoint
  fix(cli): handle missing wallet ID gracefully
  chore(sdk): bump viem dependency
  perf(web): add index on ledger_entries.created_at
  test(web): add daily_limit policy edge cases
  refactor(core): extract policy evaluation into pipeline
  ```
- Allowed prefixes: `feat`, `fix`, `chore`, `perf`, `test`, `refactor`, `docs`
- Scopes: `web`, `cli`, `sdk`, `mcp`, `core`, `chain`, `db`, `simulation`, or omit for repo-wide changes
- Keep the description short (under 72 chars). Use the commit body for detail if needed.

## Testing conventions

- Tests are integration tests against real Postgres (not mocks)
- Each test file cleans all tables in `beforeEach`
- Run with `pnpm test` from root or `npx vitest run` from `apps/web/`
- Tests do not require on-chain env vars — chain operations are skipped when not configured

## Env vars

| Var | Required | Where | Purpose |
|-----|----------|-------|---------|
| `DATABASE_URL` | Yes | `apps/web/.env.local` | Postgres connection |
| `DEPLOYER_PRIVATE_KEY` | No | `apps/web/.env.local` | On-chain minting |
| `TEST_USDC_ADDRESS` | No | `apps/web/.env.local` | TestUSDC contract address |
| `BASE_SEPOLIA_RPC_URL` | No | `apps/web/.env.local` | Base Sepolia RPC (defaults to public) |
| `FLOWBIT_API_URL` | No | CLI/MCP env | API base URL (defaults to localhost:3000) |
