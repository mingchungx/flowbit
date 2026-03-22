# @flowbit/web

Next.js 16 application that serves the Flowbit API and the real-time monitoring dashboard.

## What's here

- **Dashboard** (`src/components/dashboard/`) — terminal-style real-time monitor at `/`
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

Open http://localhost:3000 to see the monitoring dashboard.

## Dashboard

The dashboard at `/` is a terminal-style real-time monitor with 5 panels:

- **Status bar** — total wallets, system balance, tx counts (1h/24h), last activity
- **Wallet table** — click a wallet to filter the transaction feed
- **Transaction feed** — live log (3s polling), color-coded FUND (green) / SEND (amber)
- **Ledger inspector** — click a transaction to see double-entry debit/credit detail
- **Policy overview** — collapsible view of all active spending constraints

Keyboard: `Esc` to deselect. Toggle dark/light mode with the button in the top-right.

To see data in the dashboard, create wallets and send payments via the CLI or API:

```bash
pnpm agent-pay wallet create --name "my-agent"
pnpm agent-pay fund <wallet-id> --amount 100
pnpm agent-pay wallet create --name "vendor"
pnpm agent-pay send --from <agent-id> --to <vendor-id> --amount 25
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
| `/api/dashboard/overview` | `GET` | Aggregated system stats |
| `/api/dashboard/feed` | `GET` | Transaction feed `?since=&wallet_id=&limit=` |
| `/api/dashboard/ledger/:txId` | `GET` | Double-entry ledger detail |
| `/api/dashboard/policies` | `GET` | All policies with wallet names |

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
