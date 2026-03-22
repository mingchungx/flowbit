# @flowbit/cli

Command-line interface for Flowbit. Wraps the REST API for use by developers and shell-based agents.

## Build

```bash
pnpm build
```

## Usage

```bash
# Use via the root shortcut
pnpm flowbit <command>

# Or run directly
node packages/cli/dist/index.js <command>
```

### Commands

```bash
# Wallets
flowbit wallet create --name "my-agent"
flowbit wallet list
flowbit wallet get <wallet-id>

# Funding
flowbit fund <wallet-id> --amount 100

# Payments
flowbit send --from <id> --to <id> --amount 10 --memo "payment for data"

# Transaction logs
flowbit logs <wallet-id>

# Policies
flowbit policy add --wallet <id> --type max_per_tx --params '{"max": 25}'
flowbit policy add --wallet <id> --type daily_limit --params '{"limit": 100}'
flowbit policy add --wallet <id> --type allowlist --params '{"allowed_wallets": ["<id>"]}'
flowbit policy list <wallet-id>
```

All commands output JSON. Set `FLOWBIT_API_URL` to point at a different server (defaults to `http://localhost:3000`).

### Options

- `--output json` — output format (default: json)
- `--idempotency-key <key>` — set idempotency key for fund/send commands
