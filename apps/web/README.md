# @flowbit/web

Next.js 16 application that serves the Flowbit API and will eventually host the frontend dashboard.

## What's here

- **API routes** (`src/app/api/`) — REST endpoints for wallets, payments, policies, transactions
- **Core engine** (`src/lib/core/`) — double-entry ledger, policy engine, wallet operations
- **DB layer** (`src/lib/db/`) — Drizzle ORM schema and Postgres connection
- **Chain layer** (`src/lib/chain/`) — viem integration for Base Sepolia (keypair generation, TestUSDC minting)

## Setup

```bash
# From repo root
docker compose up -d   # Start Postgres
pnpm db:push           # Push schema
pnpm dev               # Start dev server at :3000
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallets` | `GET` | List all wallets |
| `/api/wallets` | `POST` | Create a wallet `{ name }` |
| `/api/wallets/:id` | `GET` | Get wallet details |
| `/api/wallets/:id/fund` | `POST` | Fund with testnet USDC `{ amount }` |
| `/api/wallets/:id/policies` | `GET` | List active policies |
| `/api/wallets/:id/policies` | `POST` | Add a policy `{ type, params }` |
| `/api/wallets/:id/onchain` | `GET` | Ledger vs on-chain balance |
| `/api/send` | `POST` | Send payment `{ from, to, amount, idempotency_key }` |
| `/api/transactions` | `GET` | Transaction log `?wallet_id=` |

## Scripts

```bash
pnpm dev              # Start dev server
pnpm build            # Production build
pnpm test             # Run integration tests
pnpm test:watch       # Watch mode
pnpm db:push          # Push schema directly (dev only)
pnpm db:gen <name>    # Generate a named migration
pnpm db:migrate       # Run pending migrations
pnpm db:check         # Verify migrations match schema
pnpm db:drop          # Drop a migration
pnpm db:studio        # Open Drizzle Studio
pnpm deploy:usdc      # Deploy TestUSDC to Base Sepolia
```

## Environment Variables

Copy `.env.example` to `.env.local`:

```bash
DATABASE_URL=postgres://flowbit:flowbit@localhost:5432/flowbit

# Optional — on-chain integration
DEPLOYER_PRIVATE_KEY=0x...
TEST_USDC_ADDRESS=0x...
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```
