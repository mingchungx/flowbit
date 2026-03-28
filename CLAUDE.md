# CLAUDE.md

## What is this repo

Flowbit is a programmable financial layer for autonomous agents. It lets agents hold USDC in custodial wallets, send payments under policy constraints, and track everything via a double-entry ledger. The system runs off-chain for speed with optional on-chain settlement on Base Sepolia.

## Repo layout

```
flowbit/
├── apps/web/            # Next.js 16 — API server + monitoring dashboard (:3000)
├── apps/simulation/     # Next.js 16 — agent economy simulation (:3001)
├── packages/cli/        # `flowbit` CLI (Commander.js, hits the API)
├── packages/sdk/        # TypeScript client + agent tool schemas
├── packages/mcp/        # MCP server (stdio transport, wraps SDK)
├── contracts/           # TestUSDC.sol (mintable ERC20 for testnet)
├── docs/                # Design docs, TODOs, and production requirements
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
docker compose up -d          # Postgres
pnpm db:push                  # Push schema
pnpm db:create-admin-key      # Create first admin API key
pnpm dev                      # Start main app at :3000
pnpm sim:dev                  # Start simulation at :3001
pnpm test                     # Run tests (needs Postgres)
pnpm typecheck                # Typecheck all apps + packages
pnpm lint                     # ESLint with autofix (web)
pnpm lint:check               # ESLint without fix (CI)
```

Pre-commit hook (Husky) runs `lint-staged` which typechecks any changed package automatically.

## Architecture decisions to know

**Double-entry ledger.** Every balance change creates ledger entries (debit + credit). The `wallets.balance` column is a cached aggregate. Never mutate it directly — always go through `ledger.ts` functions which update it inside a DB transaction.

**Atomic transactions.** `sendPayment` and `fundWallet` use Postgres transactions with `SELECT FOR UPDATE`. Wallet rows are locked in consistent ID order to prevent deadlocks.

**Idempotency.** Every payment has an `idempotency_key` (unique index). Replaying the same key returns the original transaction without re-executing. This is critical for agent safety.

**Policy engine.** Before any outgoing payment, all active policies on the sender wallet are evaluated. If any fails, the payment is rejected. Policy types: `max_per_tx`, `daily_limit`, `allowlist`. Add new types in `apps/web/src/lib/core/policies.ts`.

**On-chain is optional.** The system works fully off-chain. When `TEST_USDC_ADDRESS` and `DEPLOYER_PRIVATE_KEY` env vars are set, funding mints real testnet USDC. Payments stay off-chain; settlement is a future phase.

**API key authentication.** Every API request requires `Authorization: Bearer <key>`. Keys are SHA-256 hashed before storage. Two scopes: `agent` (wallet-scoped access) and `admin` (full read, dashboard access). Bootstrap with `pnpm db:create-admin-key`. Create further keys via `POST /api/admin/keys`.

**Wallet ownership.** Each wallet is bound to the API key that created it via `owner_key_id`. Agents can only access their own wallets. Admins can read all wallets but don't own any.

**Private keys are encrypted.** When `KEY_ENCRYPTION_SECRET` is set, private keys are encrypted with AES-256-GCM before storage. The column is never returned by the API.

**Rate limiting.** Per-API-key (100 req/s) and per-IP (20 req/s) sliding window limiters. In-memory — resets on restart.

**Financial rate limits.** DB-backed limits prevent abuse: max 100 wallets per API key, max 60 transactions per wallet per hour, max 100,000 USDC volume per API key per day. These are checked in route handlers before financial operations and return 429 when exceeded. See `apps/web/src/lib/core/financial-limits.ts`.

**Request logging.** All API routes are wrapped with `withRequestLogging` which logs method, path, status code, duration, and abbreviated API key ID for every request. See `apps/web/src/lib/core/request-logger.ts`.

**Standardized error handling.** All API routes use `handleApiError` from `apps/web/src/lib/core/api-errors.ts` which maps known error types to HTTP status codes and never leaks internal details for unknown errors.

## Where to find things

| What | Where |
|------|-------|
| DB schema | `apps/web/src/lib/db/schema.ts` |
| DB connection | `apps/web/src/lib/db/index.ts` |
| Auth + API keys | `apps/web/src/lib/core/auth.ts` |
| Rate limiting | `apps/web/src/lib/core/rate-limit.ts` |
| Ledger (barrel re-export) | `apps/web/src/lib/core/ledger.ts` |
| Error classes | `apps/web/src/lib/core/errors.ts` |
| Wallet CRUD | `apps/web/src/lib/core/wallets.ts` |
| Funding logic | `apps/web/src/lib/core/funding.ts` |
| Payment logic | `apps/web/src/lib/core/payments.ts` |
| Transaction queries | `apps/web/src/lib/core/transactions.ts` |
| Financial rate limits | `apps/web/src/lib/core/financial-limits.ts` |
| Request logging | `apps/web/src/lib/core/request-logger.ts` |
| API error handler | `apps/web/src/lib/core/api-errors.ts` |
| Policy engine | `apps/web/src/lib/core/policies.ts` |
| Key encryption | `apps/web/src/lib/crypto/keys.ts` |
| Structured logger | `apps/web/src/lib/logger.ts` |
| Chain integration | `apps/web/src/lib/chain/` |
| API routes | `apps/web/src/app/api/` |
| Admin key API | `apps/web/src/app/api/admin/keys/route.ts` |
| Health check | `apps/web/src/app/api/health/route.ts` |
| Tests | `apps/web/src/lib/core/__tests__/` |
| CLI source | `packages/cli/src/` |
| SDK source | `packages/sdk/src/` |
| MCP server | `packages/mcp/src/index.ts` |
| Agreements (barrel re-export) | `apps/web/src/lib/core/agreements/index.ts` |
| Agreement types + errors | `apps/web/src/lib/core/agreements/types.ts` |
| Agreement helpers | `apps/web/src/lib/core/agreements/helpers.ts` |
| Agreement creation | `apps/web/src/lib/core/agreements/create.ts` |
| Agreement queries | `apps/web/src/lib/core/agreements/query.ts` |
| Agreement settlement | `apps/web/src/lib/core/agreements/settle.ts` |
| Agreement cancellation | `apps/web/src/lib/core/agreements/cancel.ts` |
| Usage reporting | `apps/web/src/lib/core/agreements/usage.ts` |
| Dashboard components | `apps/web/src/components/dashboard/` |
| Dashboard API routes | `apps/web/src/app/api/dashboard/` |
| Bootstrap script | `apps/web/scripts/create-admin-key.ts` |
| Deploy script | `apps/web/scripts/deploy-test-usdc.ts` |
| Simulation engine | `apps/simulation/src/lib/engine/` |
| Simulation dashboard | `apps/simulation/src/components/` |
| Simulation API | `apps/simulation/src/app/api/simulation/` |

## How to make changes

**Adding a new API endpoint:** Create a `route.ts` in the appropriate `apps/web/src/app/api/` directory. Follow the pattern of existing routes — call `requireAuth(request)` first, validate input, call core functions, handle auth errors with `handleAuthError()`, return appropriate HTTP status codes. Dashboard routes require `{ scope: "admin" }`. Use `assertWalletOwnership()` for wallet-specific operations.

**Adding a new policy type:** Add the check function in `policies.ts`, add the case to the switch in `evaluatePolicies`, add param validation in the policies API route handler.

**Changing the DB schema:** Edit `apps/web/src/lib/db/schema.ts`, then:
- Dev: `pnpm db:push` to apply directly
- Production: `pnpm db:gen <migration-name>` to generate a named migration, then `pnpm db:migrate` to run it
- Verify: `pnpm db:check` to confirm migrations are consistent with the schema

**Adding SDK methods:** Add the method to `packages/sdk/src/index.ts`, update types in `types.ts`, rebuild with `pnpm --filter @flowbit/sdk build`.

**Adding MCP tools:** Add a `server.registerTool(...)` call in `packages/mcp/src/index.ts`. Use zod schemas for input validation. Rebuild with `pnpm --filter @flowbit/mcp build`.

**After changes to CLI/SDK/MCP:** These are compiled TypeScript packages. Rebuild before testing: `pnpm --filter <package> build`.

## docs/ directory

The `docs/` folder contains design documents and production readiness TODOs:

| File | Content |
|------|---------|
| `design.md` | Architecture, schema, policy engine, security model, phase status |
| `todo-deployment.md` | Hosting, managed Postgres, CI/CD |
| `todo-sdk-publish.md` | npm publishing, versioning |
| `todo-private-keys.md` | Key encryption, KMS, HSM migration |
| `todo-onchain-settlement.md` | Batch netting, withdrawals, deposits |
| `todo-rate-limiting.md` | Request + financial rate limits |
| `todo-observability.md` | Logging, metrics, alerting |
| `todo-mainnet.md` | Real USDC, compliance, audit (depends on all others) |

## Keeping docs up to date

**When making code changes, always update the relevant markdown files in the same commit.** Do not make a code change in one commit and a doc update in a separate commit. Batch them together.

Files to check on every change:
- `README.md` — if you add/change API endpoints, CLI commands, or project structure
- `CLAUDE.md` — if you add new files, directories, env vars, or change conventions
- `AGENTS.md` — if you change invariants, safety rules, or the dependency graph
- `docs/design.md` — if you implement a planned phase or change architecture
- `docs/todo-*.md` — if you complete or partially complete a TODO item
- `apps/web/README.md` — if you change web app endpoints or scripts
- Package READMEs — if you change CLI commands, SDK methods, or MCP tools

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
| `KEY_ENCRYPTION_SECRET` | Prod | `apps/web/.env.local` | AES-256-GCM master key for private key encryption |
| `LOG_LEVEL` | No | `apps/web/.env.local` | Logging level: debug, info, warn, error (default: info) |
| `DEPLOYER_PRIVATE_KEY` | No | `apps/web/.env.local` | On-chain minting |
| `TEST_USDC_ADDRESS` | No | `apps/web/.env.local` | TestUSDC contract address |
| `BASE_SEPOLIA_RPC_URL` | No | `apps/web/.env.local` | Base Sepolia RPC (defaults to public) |
| `FLOWBIT_API_URL` | No | CLI/MCP env | API base URL (defaults to localhost:3000) |
| `FLOWBIT_API_KEY` | Yes | CLI/MCP env | API key for authentication |
