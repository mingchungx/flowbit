# @flowbit/cli

Command-line interface for Flowbit. Wraps the REST API for use by developers and shell-based agents.

## Build

```bash
pnpm build
```

## Usage

```bash
# Use via the root shortcut
pnpm agent-pay <command>

# Or run directly
node packages/cli/dist/index.js <command>
```

### Commands

```bash
# Wallets
agent-pay wallet create --name "my-agent"
agent-pay wallet list
agent-pay wallet get <wallet-id>

# Funding
agent-pay fund <wallet-id> --amount 100

# Payments
agent-pay send --from <id> --to <id> --amount 10 --memo "payment for data"

# Transaction logs
agent-pay logs <wallet-id>

# Policies
agent-pay policy add --wallet <id> --type max_per_tx --params '{"max": 25}'
agent-pay policy add --wallet <id> --type daily_limit --params '{"limit": 100}'
agent-pay policy add --wallet <id> --type allowlist --params '{"allowed_wallets": ["<id>"]}'
agent-pay policy list <wallet-id>
```

All commands output JSON. Set `FLOWBIT_API_URL` to point at a different server (defaults to `http://localhost:3000`).

### Options

- `--output json` — output format (default: json)
- `--idempotency-key <key>` — set idempotency key for fund/send commands
