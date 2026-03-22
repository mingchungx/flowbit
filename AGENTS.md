# AGENTS.md

Rules and invariants for any AI coding agent working in this repo. Violations of these rules can cause financial inconsistencies, double-spending, or leaked secrets.

## Hard Invariants

### 1. Never mutate `wallets.balance` directly

All balance changes MUST go through `ledger.ts` functions (`fundWallet`, `sendPayment`) which create ledger entries and update the cached balance inside a Postgres transaction. Writing a raw `UPDATE wallets SET balance = ...` anywhere will cause the ledger to diverge from the cached balance.

### 2. Never expose `privateKey` in API responses

The `privateKey` column exists in the wallets table but must NEVER appear in any API response, log output, or error message. All public-facing wallet queries use explicit column selection that excludes it. If you add a new query that touches the wallets table, use the same select pattern — do not use `SELECT *`.

### 3. Every outgoing payment must go through `evaluatePolicies`

There is no code path that should bypass the policy engine for sends. If you add a new way to move money out of a wallet, it must call `evaluatePolicies` before executing.

### 4. Every financial operation must be idempotent

All endpoints that create transactions require an `idempotency_key`. The system checks for an existing transaction with that key before executing. If you add a new financial operation, follow this pattern — check first, execute only if no duplicate exists.

### 5. Wallet locks must be acquired in consistent order

When locking multiple wallets (as in `sendPayment`), always acquire locks in ascending ID order (`from < to ? [from, to] : [to, from]`). Locking in arbitrary order will cause deadlocks under concurrent load.

## Package Dependency Graph

```
apps/web (Next.js API)      ←  does not depend on packages/*
apps/simulation             ←  copies core modules from apps/web (same DB)
packages/sdk                ←  standalone, no internal deps
packages/cli                ←  standalone, calls API over HTTP
packages/mcp                ←  depends on @flowbit/sdk
```

Changes to `apps/web` API response shapes must be reflected in `packages/sdk/src/types.ts`. The MCP server and CLI consume through the SDK/HTTP — they do not import from `apps/web` directly.

`apps/simulation` has its own copies of `lib/core/`, `lib/db/`, and `lib/chain/` from `apps/web`. If you change schema or core logic in web, you must update the simulation copies too.

## Before Submitting Changes

1. **Run `pnpm test`** — all 35+ tests must pass. Tests require Postgres to be running.
2. **Run `npx tsc --noEmit`** in both `apps/web/` and `apps/simulation/` — must have zero type errors.
3. **If you changed the DB schema** — run `pnpm db:push` and verify tests still pass against the new schema.
4. **If you changed SDK types** — rebuild with `pnpm --filter @flowbit/sdk build`, then rebuild MCP (`pnpm --filter @flowbit/mcp build`) since it depends on the SDK.
5. **If you changed API response shapes** — update `packages/sdk/src/types.ts` to match.

## Common Mistakes to Avoid

- **Returning full wallet rows from new endpoints.** Always use explicit column selection to exclude `privateKey`. Copy the select pattern from `getWallet` in `ledger.ts`.
- **Forgetting to handle `WalletNotFoundError` in route handlers.** Every route that takes a wallet ID should catch this and return 404.
- **Adding financial operations without idempotency.** If it creates a transaction, it needs an idempotency key.
- **Using `db.delete()` in production code.** Deleting ledger entries or transactions destroys the audit trail. Mark records as cancelled/reversed instead.
- **Putting business logic in route handlers.** Routes should validate input and call core functions. All financial logic belongs in `apps/web/src/lib/core/`.
- **Importing from `apps/web` in packages.** The packages (`cli`, `sdk`, `mcp`) communicate with the API over HTTP. They never import server-side code directly.

## File Conventions

- **API routes:** `apps/web/src/app/api/<resource>/route.ts` — Next.js 16 App Router. The `params` argument is a `Promise` and must be awaited.
- **Core logic:** `apps/web/src/lib/core/` — pure business logic, no HTTP concerns.
- **DB layer:** `apps/web/src/lib/db/` — Drizzle schema and connection. Schema is the single source of truth for table structure.
- **Chain layer:** `apps/web/src/lib/chain/` — all viem/blockchain code is isolated here. The rest of the app imports from `@/lib/chain` and does not use viem directly.
- **Tests:** colocated in `__tests__/` directories next to the code they test. Integration tests, not unit tests — they hit real Postgres.

## Financial Safety Checklist

When reviewing or writing code that touches money:

- [ ] Does every balance change create corresponding ledger entries?
- [ ] Is the operation wrapped in a `db.transaction()`?
- [ ] Are wallet rows locked with `SELECT FOR UPDATE` before balance checks?
- [ ] Is there an idempotency key check before execution?
- [ ] Are policies evaluated before any outgoing transfer?
- [ ] Is `privateKey` excluded from all returned data?
- [ ] Do error cases leave balances unchanged (atomic rollback)?
