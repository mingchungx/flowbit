# Flowbit

Flowbit is a **programmable financial layer for autonomous agents**. It lets AI agents hold USDC in custodial wallets, send payments under policy constraints, and track everything via a double-entry ledger. The system runs off-chain for speed with optional on-chain settlement on Base Sepolia.

**Core concepts:**

- **Double-entry ledger** — every balance change creates debit + credit entries; wallet balances are cached aggregates
- **Policy engine** — payments are gated by configurable policies (`max_per_tx`, `daily_limit`, `allowlist`)
- **Idempotency** — every payment has a unique key to prevent duplicate execution (critical for agent safety)
- **Atomic transactions** — wallet locks in consistent order to prevent deadlocks

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Docker (for Postgres)

### Setup

```bash
# Install dependencies
pnpm install

# Start Postgres
docker compose up -d

# Push database schema
pnpm db:push

# Start the API server
pnpm dev
# → http://localhost:3000
```

## Surfaces

Flowbit exposes the same financial primitives through four interfaces. Pick the one that fits your use case.

### 1. REST API

The Next.js app serves the API at `http://localhost:3000/api/`.

**Wallets**

```bash
# Create a wallet (generates a real Base Sepolia address)
curl -X POST http://localhost:3000/api/wallets \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent"}'

# List all wallets
curl http://localhost:3000/api/wallets

# Get a specific wallet
curl http://localhost:3000/api/wallets/<wallet-id>
```

**Funding**

```bash
# Fund a wallet with testnet USDC
curl -X POST http://localhost:3000/api/wallets/<wallet-id>/fund \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

**Payments**

```bash
# Send USDC between wallets (idempotent)
curl -X POST http://localhost:3000/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "from": "<sender-wallet-id>",
    "to": "<receiver-wallet-id>",
    "amount": 10,
    "idempotency_key": "payment-001"
  }'
```

**Policies**

```bash
# Add a spending constraint
curl -X POST http://localhost:3000/api/wallets/<wallet-id>/policies \
  -H "Content-Type: application/json" \
  -d '{"type": "max_per_tx", "params": {"max": 25}}'

# Other policy types:
# daily_limit: {"type": "daily_limit", "params": {"limit": 100}}
# allowlist:   {"type": "allowlist", "params": {"allowed_wallets": ["<id>"]}}

# List active policies
curl http://localhost:3000/api/wallets/<wallet-id>/policies
```

**Transaction Log**

```bash
curl http://localhost:3000/api/transactions?wallet_id=<wallet-id>
```

**On-Chain Balance** (requires chain config)

```bash
curl http://localhost:3000/api/wallets/<wallet-id>/onchain
```

### 2. CLI

```bash
# Build the CLI
pnpm cli:build

# Or use the root shortcut
pnpm flowbit --help

# Wallet management
pnpm flowbit wallet create --name "my-agent"
pnpm flowbit wallet list
pnpm flowbit wallet get <wallet-id>

# Fund
pnpm flowbit fund <wallet-id> --amount 100

# Send
pnpm flowbit send --from <id> --to <id> --amount 10

# Transaction logs
pnpm flowbit logs <wallet-id>

# Policies
pnpm flowbit policy add --wallet <id> --type max_per_tx --params '{"max": 25}'
pnpm flowbit policy list <wallet-id>
```

```bash
# Agreements
pnpm flowbit agreement create --payer <id> --payee <id> --type subscription --amount 10 --interval monthly
pnpm flowbit agreement create --payer <id> --payee <id> --type usage --amount 0.01 --unit api_call --interval daily
pnpm flowbit agreement get <agreement-id>
pnpm flowbit agreement list [--wallet <id>] [--type <type>] [--status <status>]
pnpm flowbit agreement cancel <agreement-id>
pnpm flowbit agreement usage <agreement-id> --quantity 150
pnpm flowbit agreement settle <agreement-id>
pnpm flowbit agreement settle-all
```

All commands output JSON. Set `FLOWBIT_API_URL` to point at a different server.

### 3. TypeScript SDK

```typescript
import { FlowbitClient } from "@flowbit/sdk";

const pay = new FlowbitClient({ baseUrl: "http://localhost:3000" });

// Create and fund a wallet
const wallet = await pay.createWallet("my-agent");
await pay.fundWallet(wallet.id, 100);

// Send a payment
await pay.send({
  from: wallet.id,
  to: recipientId,
  amount: 10,
  memo: "API access fee",
});

// Check balance
const w = await pay.getWallet(wallet.id);
console.log(w.balance); // "90.000000"

// Add a spending policy
await pay.addPolicy(wallet.id, "daily_limit", { limit: 50 });
```

The SDK also exports tool definitions for agent frameworks:

```typescript
import { agentTools } from "@flowbit/sdk/tools";
// Array of JSON Schema tool definitions compatible with
// OpenAI function calling, Claude tool_use, etc.
```

### 4. MCP Server (for Claude, etc.)

Build and configure the MCP server so any MCP-compatible agent can use Flowbit tools natively.

```bash
# Build
cd packages/mcp && pnpm build
```

Add to your Claude Code config (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "flowbit": {
      "command": "node",
      "args": ["/absolute/path/to/flowbit/packages/mcp/dist/index.js"],
      "env": {
        "FLOWBIT_API_URL": "http://localhost:3000"
      }
    }
  }
}
```

The agent then sees these tools: `create_wallet`, `get_wallet`, `list_wallets`, `fund_wallet`, `send_payment`, `get_transactions`, `add_spending_policy`, `list_policies`, `create_agreement`, `get_agreement`, `list_agreements`, `cancel_agreement`, `report_usage`, `settle_agreement`, `settle_all_due`.

## On-Chain Integration (Base Sepolia)

By default, everything runs off-chain against the Postgres ledger. To connect real testnet USDC:

```bash
# 1. Generate a deployer private key
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"

# 2. Fund the deployer address with Base Sepolia ETH
#    Use https://portal.cdp.coinbase.com/products/faucet

# 3. Deploy the TestUSDC contract
DEPLOYER_PRIVATE_KEY=0x... pnpm --filter web deploy:usdc

# 4. Add to apps/web/.env.local
DEPLOYER_PRIVATE_KEY=0x...
TEST_USDC_ADDRESS=0x...   # from deploy output
BASE_SEPOLIA_RPC_URL=https://sepolia.base.org
```

With these set, `fund` mints real testnet tUSDC on-chain to the wallet's address. Payments remain off-chain for speed; the ledger is the source of truth, the chain is the proof layer.

## API Reference

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/wallets` | `GET` | List all wallets |
| `/api/wallets` | `POST` | Create a wallet |
| `/api/wallets/:id` | `GET` | Get wallet details |
| `/api/wallets/:id/fund` | `POST` | Fund with testnet USDC |
| `/api/wallets/:id/policies` | `GET` | List active policies |
| `/api/wallets/:id/policies` | `POST` | Add a spending policy |
| `/api/wallets/:id/onchain` | `GET` | Compare ledger vs on-chain balance |
| `/api/send` | `POST` | Execute a payment |
| `/api/transactions` | `GET` | Transaction log (requires `wallet_id` param) |
| `/api/agreements` | `GET, POST` | List/create agreements |
| `/api/agreements/:id` | `GET` | Get agreement details |
| `/api/agreements/:id/cancel` | `POST` | Cancel an agreement |
| `/api/agreements/:id/usage` | `POST` | Report metered usage |
| `/api/agreements/:id/settle` | `POST` | Settle a specific agreement |
| `/api/agreements/settle` | `POST` | Settle all due agreements |
| `/api/chain/status` | `GET` | Chain configuration and health (admin) |
| `/api/health` | `GET` | Health check (`?include=chain` for chain health) |

## Testing

```bash
# Run integration tests (requires Postgres running)
pnpm test
```

35 tests run against real Postgres (not mocks) covering wallet CRUD, double-entry ledger, idempotent payments, policy enforcement, and all three agreement types (subscription, usage, retainer).

### Testnet E2E Test

Run a comprehensive end-to-end test against a live Flowbit instance with optional Base Sepolia integration:

```bash
# Start the server first
docker compose up -d && pnpm db:push && pnpm dev

# In another terminal — create an admin key if you don't have one
pnpm db:create-admin-key

# Run the E2E test
FLOWBIT_ADMIN_KEY=fb_admin_... pnpm --filter web testnet:e2e
```

The E2E test exercises: wallet creation, funding (with optional on-chain minting), payments, idempotency, policy enforcement, agreement creation and settlement, and transaction log verification. On-chain steps are skipped gracefully if chain configuration is not set.

See [docs/testnet-guide.md](docs/testnet-guide.md) for the full testnet setup guide including deploying TestUSDC to Base Sepolia.

## Project Structure

```
flowbit/
├── apps/web/                  # Next.js app (API + monitoring dashboard)
│   ├── src/app/api/           # Route handlers
│   ├── src/components/        # Dashboard UI components
│   ├── src/lib/core/          # Ledger, policy engine, agreements
│   ├── src/lib/db/            # Drizzle schema, connection
│   ├── src/lib/chain/         # viem, on-chain operations
│   └── scripts/               # Deploy scripts
├── apps/simulation/           # Agent economy simulation (port 3001)
│   ├── src/app/api/           # Simulation control + SSE events
│   ├── src/components/        # Graph, feed, leaderboard UI
│   └── src/lib/engine/        # 100-agent simulation engine
├── packages/cli/              # flowbit CLI
├── packages/sdk/              # TypeScript SDK + tool definitions
├── packages/mcp/              # MCP server for agent frameworks
├── contracts/                 # Solidity (TestUSDC)
└── docs/                      # Design documents
```

## Agent Economy Simulation

Run a 100-agent economy simulation to observe emergent financial behavior:

```bash
# Start both apps (requires Postgres running)
pnpm dev          # Main API + dashboard on :3000
pnpm sim:dev      # Simulation dashboard on :3001
```

Open http://localhost:3001, click **init** then **start**. 100 agents with different professions and risk profiles will begin trading, forming subscriptions, and competing for wealth over 100 simulated years.

- **Left panel**: force-directed graph showing agent relationships
- **Right top**: live event feed (SSE-powered)
- **Right bottom**: leaderboard sorted by balance
- **Top bar**: year/day progress, speed controls (1x to 100x)

## License

[MIT](LICENSE)
