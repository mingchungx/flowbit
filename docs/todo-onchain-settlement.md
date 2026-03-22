# TODO: On-Chain Settlement (Phase 3)

## Status: Not started

## Problem

Payments are fully off-chain. The ledger is the only record. For real financial operations, there needs to be periodic on-chain settlement so that:
- Payments are provable on a public blockchain
- Disputes can be resolved with on-chain evidence
- Agents can withdraw funds to external wallets

## Requirements

### Batch Settlement
- A settlement worker runs periodically (every hour, daily, or on-demand)
- Collects unsettled transactions between wallets
- Nets them out (if A owes B $50 and B owes A $30, settle the net $20)
- Executes a single on-chain transfer for the net amount
- Marks transactions as settled with the on-chain tx hash

### Settlement Table
- `settlement_batches`: `id, status, created_at, settled_at, tx_hash, total_amount, transaction_count`
- `settlement_items`: `id, batch_id, transaction_id`
- Link settled transactions back to their batch

### Withdrawal
- Agents should be able to withdraw USDC to an external wallet address
- `POST /api/wallets/:id/withdraw { to_address, amount }`
- Executes an on-chain ERC20 transfer from the custodial wallet
- Deducts from ledger balance

### Deposit Detection
- Watch for incoming ERC20 transfers to wallet addresses
- Credit the ledger when USDC arrives on-chain
- Polling or event-based (listen to Transfer events)

## Implementation Notes

- Settlement netting reduces on-chain transactions dramatically (100 payments might net to 10 transfers)
- Use `viem` to batch multiple transfers in one transaction if possible
- Gas costs come from a funded deployer/relayer wallet
- Need gas estimation before execution — reject if gas exceeds threshold

## Files to Change

- `apps/web/src/lib/db/schema.ts` — add `settlementBatches`, `settlementItems`
- New: `apps/web/src/lib/core/settlement.ts` — netting logic, batch execution
- New: `apps/web/src/app/api/settlements/` — API routes
- New: `apps/web/src/app/api/wallets/[id]/withdraw/route.ts`
- `apps/web/src/lib/chain/index.ts` — add batch transfer function
