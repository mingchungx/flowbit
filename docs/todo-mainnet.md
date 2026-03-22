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

## Prerequisites (must be done first)

1. [Authentication](./todo-auth.md)
2. [Private key security](./todo-private-keys.md)
3. [On-chain settlement](./todo-onchain-settlement.md)
4. [Rate limiting](./todo-rate-limiting.md)
5. [Observability](./todo-observability.md)
6. [Deployment](./todo-deployment.md)

## This is the final milestone. Do not attempt mainnet without completing all prerequisites.
