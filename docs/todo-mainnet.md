# TODO: Mainnet Readiness

## Status: Not started (depends on all other TODOs)

## Problem

The system currently uses testnet USDC on Base Sepolia with a custom mintable ERC20. Moving to mainnet with real USDC requires significant changes.

## Requirements

### Real USDC Integration
- Switch from TestUSDC to Circle's official USDC contract on Base (or Ethereum, Arbitrum, etc.)
- No more minting — funding comes from real deposits
- Contract address changes per network
- Multi-chain support (configurable per deployment)

### Deposit Flow
- Watch wallet addresses for incoming USDC transfers
- Credit ledger on confirmed deposit (wait for N block confirmations)
- `POST /api/wallets/:id/deposit` returns the wallet address for the user to send to

### Compliance
- KYC/AML requirements for custodial wallets holding real funds
- Transaction monitoring for suspicious patterns
- Reporting obligations vary by jurisdiction
- May need a money transmitter license depending on the deployment model

### Audit
- External security audit of smart contracts and core financial logic
- Penetration testing of the API
- Review of private key management

### Insurance / Risk
- What happens if the deployer key is compromised?
- What happens if the DB is corrupted?
- Cold storage for reserves vs. hot wallet for operations
- Maximum exposure limits

## Prerequisites

| # | Prerequisite | Status |
|---|-------------|--------|
| 1 | Authentication & API keys | **Done** — SHA-256 hashed keys, agent/admin scopes, wallet ownership |
| 2 | [Private key security](./todo-private-keys.md) | **Partial** — AES-256-GCM at rest done; KMS/HSM remaining |
| 3 | [On-chain settlement](./todo-onchain-settlement.md) | **Not started** — batch netting, withdrawals, deposits |
| 4 | [Rate limiting](./todo-rate-limiting.md) | **Partial** — request limits done; financial limits remaining |
| 5 | [Observability](./todo-observability.md) | **Partial** — logging + health done; metrics/alerting remaining |
| 6 | [Deployment](./todo-deployment.md) | **Partial** — Dockerfile + CI done; deploy pipeline/managed DB remaining |

## This is the final milestone. Do not attempt mainnet without completing all prerequisites.
