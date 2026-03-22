# TODO: Authentication & API Keys

## Status: Not started

## Problem

The API has zero authentication. Any HTTP request can create wallets, move funds, and cancel agreements. This is fine for local development but unusable in production.

## Requirements

### API Key System
- Generate API keys per tenant/agent (stored hashed in a new `api_keys` table)
- Every request must include `Authorization: Bearer <key>` header
- Keys are scoped: a key can only access wallets it created
- Rate limiting per key (e.g., 100 req/s)
- Key rotation: create new key, deprecate old key with a grace period

### Wallet Ownership
- Each wallet is owned by the API key that created it
- A key can only `sendPayment` FROM wallets it owns
- A key can send TO any wallet (you need to be able to pay strangers)
- Listing wallets returns only the caller's wallets
- Agreements require the payer wallet to belong to the caller

### Admin Keys
- A separate admin key type that can see all wallets, all transactions
- Used for the monitoring dashboard
- Cannot move funds

## Implementation Notes

- Add `api_keys` table: `id, key_hash, name, scope (agent|admin), rate_limit, created_at, revoked_at`
- Add `owner_key_id` FK to `wallets` table
- Middleware function that extracts + validates the key on every API route
- Dashboard routes (`/api/dashboard/*`) require admin key
- SDK/CLI pass the key via config: `new FlowbitClient({ apiKey: "..." })`
- MCP server reads key from env: `FLOWBIT_API_KEY`

## Files to Change

- `apps/web/src/lib/db/schema.ts` — add `apiKeys` table, add `ownerKeyId` to wallets
- `apps/web/src/lib/core/auth.ts` — new: key validation, ownership checks
- `apps/web/src/app/api/**` — all routes need auth middleware
- `packages/sdk/src/index.ts` — already supports `apiKey` in config (just unused)
- `packages/cli/src/client.ts` — pass key from env/flag
