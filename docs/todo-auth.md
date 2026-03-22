# TODO: Authentication & API Keys

## Status: Done

## Completed

### API Key System
- [x] `api_keys` table: id, key_hash (SHA-256), name, scope (agent|admin), revoked_at, created_at
- [x] Key format: `fb_live_<random>` for agents, `fb_admin_<random>` for admins
- [x] Keys hashed with SHA-256 before storage — raw key returned once on creation
- [x] Key revocation: set `revoked_at` timestamp, key immediately invalid
- [x] Rate limiting per key: 100 req/s (in-memory sliding window)

### Wallet Ownership
- [x] `owner_key_id` FK on wallets table — each wallet owned by the key that created it
- [x] Agents can only access/modify their own wallets
- [x] Agents can send TO any wallet (pay strangers)
- [x] Listing wallets returns only the caller's wallets
- [x] Agreements require payer wallet to belong to the caller

### Admin Keys
- [x] Separate admin scope that can see all wallets, all transactions
- [x] Dashboard routes (`/api/dashboard/*`) require admin key
- [x] Admin keys cannot be used to move funds (no ownership restriction)

### Key Management API
- [x] `POST /api/admin/keys` — create new keys (admin only)
- [x] `GET /api/admin/keys` — list all keys (admin only)
- [x] `DELETE /api/admin/keys` — revoke a key (admin only)

### Bootstrap
- [x] `pnpm db:create-admin-key` script creates the first admin key directly in DB

### Integration
- [x] Every API route requires `Authorization: Bearer <key>` header
- [x] SDK already supports `apiKey` in `FlowbitConfig` — now used
- [x] CLI reads `FLOWBIT_API_KEY` from env
- [x] MCP server reads `FLOWBIT_API_KEY` from env
- [x] Health endpoint (`/api/health`) is unauthenticated

## Files Changed

- `apps/web/src/lib/db/schema.ts` — `apiKeys` table, `ownerKeyId` on wallets
- `apps/web/src/lib/core/auth.ts` — key validation, ownership checks, key management
- `apps/web/src/app/api/admin/keys/route.ts` — key CRUD API
- `apps/web/scripts/create-admin-key.ts` — bootstrap script
- All API routes — auth middleware added
- `packages/cli/src/client.ts` — passes API key
- `packages/mcp/src/index.ts` — reads API key from env
