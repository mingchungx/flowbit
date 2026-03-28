# Testnet Setup Guide

Step-by-step instructions for testing Flowbit with real testnet stablecoins on Base Sepolia. By the end of this guide you will have the full off-chain + on-chain flow working locally.

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Node.js | 20+ | `node --version` |
| pnpm | 9+ | `pnpm --version` |
| Docker | Any recent | `docker --version` |
| Git | Any | `git --version` |

You will also need a **Base Sepolia RPC URL**. The default public endpoint (`https://sepolia.base.org`) works but is rate-limited. For better reliability, get a free RPC from one of these providers:

- [Alchemy](https://www.alchemy.com/) -- create an app on Base Sepolia
- [Infura](https://www.infura.io/) -- create a Base Sepolia endpoint
- [QuickNode](https://www.quicknode.com/) -- free tier supports Base Sepolia

## 1. Clone and install

```bash
git clone <repo-url> flowbit
cd flowbit
pnpm install
```

## 2. Start Postgres

```bash
docker compose up -d
```

Verify with `docker compose ps` -- the postgres container should be running on port 5432.

## 3. Push the database schema

```bash
pnpm db:push
```

## 4. Generate a deployer wallet

The deployer wallet owns the TestUSDC contract and can mint tokens. Generate a private key:

```bash
node -e "console.log('0x' + require('crypto').randomBytes(32).toString('hex'))"
```

Save this key securely. You will need it for the next steps.

To find the corresponding Ethereum address:

```bash
node -e "
const { privateKeyToAccount } = require('viem/accounts');
const account = privateKeyToAccount('0xYOUR_PRIVATE_KEY_HERE');
console.log('Address:', account.address);
"
```

## 5. Get Base Sepolia ETH

Your deployer address needs ETH on Base Sepolia to pay for gas. Use one of these faucets:

- **Coinbase Developer Platform**: https://portal.cdp.coinbase.com/products/faucet
  - Select "Base Sepolia" network, paste your deployer address
- **Alchemy Faucet**: https://www.alchemy.com/faucets/base-sepolia
- **Superchain Faucet**: https://app.optimism.io/faucet

You need a small amount (0.01 ETH is more than enough for many transactions).

Verify your balance:

```bash
# Using the Flowbit server (after starting it)
# Or check directly on https://sepolia.basescan.org/address/YOUR_ADDRESS
```

## 6. Deploy TestUSDC

```bash
DEPLOYER_PRIVATE_KEY=0x... pnpm --filter web deploy:usdc
```

The script will:
1. Compile `contracts/TestUSDC.sol`
2. Deploy it to Base Sepolia
3. Print the contract address

Save the contract address from the output.

## 7. Configure environment variables

Create `apps/web/.env.local`:

```bash
# Required
DATABASE_URL=postgres://flowbit:flowbit@localhost:5432/flowbit

# On-chain integration
DEPLOYER_PRIVATE_KEY=0x...your_deployer_private_key...
TEST_USDC_ADDRESS=0x...contract_address_from_step_6...

# Optional: custom RPC (recommended for reliability)
BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY

# Optional: encrypt wallet private keys at rest
KEY_ENCRYPTION_SECRET=any-secret-string-at-least-32-chars-long
```

## 8. Start the API server

```bash
pnpm dev
```

The server starts at http://localhost:3000. Verify it is healthy:

```bash
curl http://localhost:3000/api/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}
```

Check chain configuration:

```bash
curl http://localhost:3000/api/health?include=chain
# Expected: chain.configured=true, chain.rpcReachable=true, etc.
```

## 9. Create an admin API key

```bash
pnpm db:create-admin-key
```

This prints a key like `fb_admin_...`. Save it -- it cannot be recovered.

## 10. Create agent API keys

Use the admin key to create agent keys:

```bash
curl -X POST http://localhost:3000/api/admin/keys \
  -H "Authorization: Bearer fb_admin_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "my-agent", "scope": "agent"}'
```

The response includes the raw API key. Save it.

## 11. Create a wallet

```bash
curl -X POST http://localhost:3000/api/wallets \
  -H "Authorization: Bearer fb_live_..." \
  -H "Content-Type: application/json" \
  -d '{"name": "my-wallet"}'
```

The response includes the wallet `id` and `address` (a real Ethereum address on Base Sepolia).

## 12. Fund the wallet with test USDC

```bash
curl -X POST http://localhost:3000/api/wallets/WALLET_ID/fund \
  -H "Authorization: Bearer fb_live_..." \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "idempotency_key": "my-first-fund"}'
```

This does two things:
1. Credits 100 USDC in the off-chain ledger
2. Mints 100 tUSDC on-chain to the wallet's Ethereum address (if chain is configured)

## 13. Send a test payment

Create a second wallet (with a second agent key or the same one), then:

```bash
curl -X POST http://localhost:3000/api/send \
  -H "Authorization: Bearer fb_live_..." \
  -H "Content-Type: application/json" \
  -d '{
    "from": "WALLET_A_ID",
    "to": "WALLET_B_ID",
    "amount": 10,
    "memo": "Test payment",
    "idempotency_key": "test-payment-001"
  }'
```

Payments are off-chain (instant, no gas cost). The ledger is the source of truth.

## 14. Verify on-chain vs off-chain balance

```bash
curl http://localhost:3000/api/wallets/WALLET_ID/onchain \
  -H "Authorization: Bearer fb_live_..."
```

Response shows both `ledgerBalance` (off-chain) and `onChainBalance` (from the blockchain). After sending payments, the on-chain balance will be higher than the ledger balance because payments are off-chain.

## 15. Run the E2E test

The automated E2E test exercises the full flow:

```bash
FLOWBIT_ADMIN_KEY=fb_admin_... pnpm --filter web testnet:e2e
```

This creates its own agent keys, wallets, and runs through:
- Funding (with optional on-chain minting)
- Payments (off-chain)
- Idempotency verification
- Policy creation and enforcement
- Agreement creation and settlement
- Transaction log verification

If chain configuration is not set, on-chain steps are skipped gracefully.

## Troubleshooting

### "DEPLOYER_PRIVATE_KEY is not set"

On-chain operations require this env var. Add it to `apps/web/.env.local`. If you only want to test the off-chain system, you can skip this -- everything except minting and on-chain balance checks works without it.

### "TEST_USDC_ADDRESS is not set"

Deploy the TestUSDC contract first (Step 6), then add the contract address to `.env.local`.

### "Deployer has no ETH"

Get testnet ETH from a faucet (Step 5). The deployer needs ETH to pay gas for minting and deploying contracts.

### "Database unreachable"

Make sure Postgres is running: `docker compose up -d`. Check that `DATABASE_URL` in `.env.local` matches the docker-compose configuration.

### "Rate limit exceeded"

The API enforces rate limits of 100 req/s per API key and 20 req/s per IP. If running automated tests rapidly, add small delays between requests.

### Chain status shows contractReadable=false

The contract address in `TEST_USDC_ADDRESS` might be wrong, or the contract might not have been deployed successfully. Check the address on https://sepolia.basescan.org.

## Architecture Notes

The system is designed so that:

1. **Off-chain works independently.** If you never configure chain env vars, the full ledger system works with simulated funding.
2. **On-chain is a proof layer.** Funding mints real testnet tokens. Payments stay off-chain for speed. The ledger is authoritative.
3. **Everything is idempotent.** You can safely replay any operation using the same `idempotency_key`.
4. **Policies are enforced.** All outgoing payments go through the policy engine. No bypass.
