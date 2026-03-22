# Flowbit

Programmable financial infrastructure for autonomous agents. Agents can hold funds, spend safely under constraints, and operate without human intervention.

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
pnpm agent-pay --help

# Wallet management
pnpm agent-pay wallet create --name "my-agent"
pnpm agent-pay wallet list
pnpm agent-pay wallet get <wallet-id>

# Fund
pnpm agent-pay fund <wallet-id> --amount 100

# Send
pnpm agent-pay send --from <id> --to <id> --amount 10

# Transaction logs
pnpm agent-pay logs <wallet-id>

# Policies
pnpm agent-pay policy add --wallet <id> --type max_per_tx --params '{"max": 25}'
pnpm agent-pay policy list <wallet-id>
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

The agent then sees these tools: `create_wallet`, `get_wallet`, `list_wallets`, `fund_wallet`, `send_payment`, `get_transactions`, `add_spending_policy`, `list_policies`.

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

## Testing

```bash
# Run integration tests (requires Postgres running)
pnpm test
```

Tests run against real Postgres, not mocks. They cover wallet CRUD, double-entry ledger, idempotent payments, and policy enforcement.

## Project Structure

```
flowbit/
├── apps/web/                  # Next.js app (API + future frontend)
│   ├── src/app/api/           # Route handlers
│   ├── src/lib/core/          # Ledger, policy engine
│   ├── src/lib/db/            # Drizzle schema, connection
│   ├── src/lib/chain/         # viem, on-chain operations
│   └── scripts/               # Deploy scripts
├── packages/cli/              # agent-pay CLI
├── packages/sdk/              # TypeScript SDK + tool definitions
├── packages/mcp/              # MCP server for agent frameworks
├── contracts/                 # Solidity (TestUSDC)
└── docs/                      # Design documents
```
