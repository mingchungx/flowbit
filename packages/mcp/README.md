# @flowbit/mcp

Model Context Protocol server for Flowbit. Exposes all financial operations as MCP tools over stdio transport. Any MCP-compatible agent (Claude Code, Claude Desktop, etc.) can use these tools natively.

## Build

```bash
pnpm build
```

## Configuration

Add to your MCP client config (e.g. `~/.claude/settings.json` for Claude Code):

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

## Available Tools

| Tool | Description |
|------|-------------|
| `create_wallet` | Create a new custodial wallet |
| `get_wallet` | Get wallet details and balance |
| `list_wallets` | List all wallets |
| `fund_wallet` | Add testnet USDC to a wallet |
| `send_payment` | Send USDC between wallets (policy-enforced, idempotent) |
| `get_transactions` | Get transaction history for a wallet |
| `add_spending_policy` | Attach a spending constraint to a wallet |
| `list_policies` | List active policies for a wallet |

## Prerequisites

The MCP server connects to the Flowbit API over HTTP. The API server must be running:

```bash
# In the repo root
docker compose up -d
pnpm db:push
pnpm dev
```

## Environment

- `FLOWBIT_API_URL` — API base URL (default: `http://localhost:3000`)
