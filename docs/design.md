# Flowbit Design Document

## Problem

Today's AI agents have no native financial capabilities. They cannot hold money, make payments, or manage budgets. When an agent needs to pay for an API call, purchase data, or compensate another agent, a human must intervene. This creates a bottleneck that prevents truly autonomous agent workflows.

## Solution

Flowbit is a programmable financial layer purpose-built for autonomous agents. It provides:

1. **Wallets** — custodial accounts with real blockchain addresses
2. **Policies** — spending constraints that prevent runaway agents
3. **Payments** — deterministic, idempotent transaction execution
4. **Audit trail** — full double-entry ledger for every balance change

## Architecture

```
Agent ──→ SDK / CLI / MCP ──→ API (Next.js) ──→ Core Engine ──→ Postgres Ledger
                                                      │
                                                      ↓ (async, when configured)
                                                 Base Sepolia (TestUSDC)
```

### Off-Chain Layer (Primary)

The off-chain system is the real-time source of truth. It handles:

- **Wallet management** — create, fund, query balances
- **Double-entry ledger** — every balance change produces a debit entry and a credit entry. The `wallets.balance` column is a cached total; the ledger entries are the authoritative record.
- **Policy evaluation** — before any outgoing payment, all active policies on the sender wallet are checked. If any policy rejects, the payment fails before touching the ledger.
- **Atomic execution** — payments run inside Postgres transactions with row-level locking (`SELECT FOR UPDATE`) to prevent double-spending under concurrent access.
- **Idempotency** — every transaction carries a unique `idempotency_key`. Replaying the same key returns the original result without re-executing. This is critical for agents that retry on network failures.

### On-Chain Layer (Settlement)

The blockchain is used for settlement and proof, not as the primary ledger. This is a deliberate design choice:

- **Speed**: Off-chain ledger updates are sub-millisecond. On-chain transactions take seconds.
- **Cost**: Ledger writes are free. On-chain writes cost gas.
- **Flexibility**: Policy logic, billing rules, and agreement structures can change without deploying new contracts.

When on-chain integration is configured:
- Each wallet gets a real Ethereum address (keypair generated via viem)
- `fund` mints TestUSDC (an ERC20 we deploy) to the wallet's on-chain address
- On-chain balance can be compared to the ledger balance via the `/onchain` endpoint
- Future: batch settlement of off-chain payments to on-chain transfers

### Database Schema

Four tables:

**wallets** — one row per agent wallet
- `id` (uuid, PK), `name`, `address` (Ethereum), `private_key` (custodial), `balance` (cached), `currency` (default USDC)

**transactions** — one row per financial event (fund, send)
- `id`, `idempotency_key` (unique), `from_wallet_id` (null for funding), `to_wallet_id`, `amount`, `status`, `tx_hash` (on-chain, nullable)

**ledger_entries** — two rows per transaction (debit + credit)
- `id`, `transaction_id` (FK), `wallet_id` (FK), `amount`, `direction` (debit/credit)

**policies** — spending constraints attached to wallets
- `id`, `wallet_id` (FK), `type`, `params` (JSONB), `active`

### Policy Engine

Policies are evaluated synchronously before every outgoing payment. The engine loads all active policies for the sender wallet and runs them in sequence. If any policy returns `{ ok: false }`, the payment is rejected with a `PolicyViolationError`.

Current policy types:

| Type | Params | Behavior |
|------|--------|----------|
| `max_per_tx` | `{ max: number }` | Rejects if amount exceeds max |
| `daily_limit` | `{ limit: number }` | Rejects if today's total spend + amount exceeds limit |
| `allowlist` | `{ allowed_wallets: string[] }` | Rejects if recipient is not in the list |

Adding a new policy type requires:
1. A check function in `policies.ts`
2. A case in the `evaluatePolicies` switch
3. Param validation in the policies API route

### Security Model

- **Private keys are never exposed.** All API queries use explicit column selection that excludes `private_key`. The key exists only in the DB for custodial signing.
- **Input validation** at the API layer — types, ranges, and required fields are checked before reaching core logic.
- **Policy enforcement** is mandatory — there is no bypass. Every `sendPayment` call goes through `evaluatePolicies`.
- **Atomic balance updates** — balances are modified inside Postgres transactions with row locks. No race conditions.
- **Idempotency prevents double-spend** from retries.

Note: This is testnet infrastructure. For production, private keys would need HSM/KMS-backed storage, and the system would need API key authentication, rate limiting, and encryption at rest.

## Integration Surfaces

### SDK

The `@flowbit/sdk` package provides a typed TypeScript client:

```typescript
const pay = new FlowbitClient({ baseUrl: "http://localhost:3000" });
const wallet = await pay.createWallet("my-agent");
await pay.send({ from: wallet.id, to: vendorId, amount: 5 });
```

It also exports `agentTools` — an array of JSON Schema tool definitions that plug into OpenAI function calling, Claude tool_use, or any tool-using framework.

### CLI

The `agent-pay` CLI wraps the API with a shell interface. All output is JSON, making it parseable by agents that can execute shell commands.

### MCP Server

The `@flowbit/mcp` package implements a Model Context Protocol server over stdio. Any MCP-compatible agent (Claude Code, etc.) can use Flowbit tools natively without custom integration code.

## Design Principles

1. **Deterministic** — same inputs always produce the same outputs. No ambiguity.
2. **Idempotent** — safe to retry any operation. Critical for unreliable networks.
3. **Constrained** — policies prevent agents from spending beyond their limits.
4. **Observable** — full audit trail via double-entry ledger. Every cent is traceable.
5. **Agent-native** — designed for programmatic access, not human UIs. JSON in, JSON out.

## Implemented Phases

### Phase 2: Agreements (Implemented)

Three agreement types for recurring financial relationships:

- **Subscriptions** — fixed recurring payments (daily/weekly/monthly). Settled via `settleDueAgreements()`.
- **Usage-based billing** — metered consumption. Agents `reportUsage()`, settlement sums unsettled records and charges `quantity * rate`.
- **Retainers** — upfront escrow transferred immediately on creation. Cancellation refunds remaining balance.

Schema: `agreements` table (payer, payee, type, amount, unit, interval, nextDueAt, status) + `usage_records` table (agreementId, quantity, settledAt). All settlements go through `sendPayment` so policies are enforced.

Exposed via API (`/api/agreements/`), CLI (`agent-pay agreement`), SDK (`FlowbitClient`), and MCP tools.

### Agent Economy Simulation (Implemented)

100-agent simulation at `apps/simulation/` demonstrating the full financial system:

- 20 professions with interdependent service needs
- Rule-based agents with conservative/moderate/aggressive risk profiles
- Each agent starts with 1000 USDC in a closed 100,000 USDC economy
- Agents buy food, pay housing, hire each other, form subscriptions and usage agreements
- Dashboard with force-directed graph, SSE event feed, and live leaderboard
- Runs 100 simulated years at configurable speed (1x to 100x)

## Future Phases

### Phase 3: On-Chain Settlement

Batch settlement of off-chain ledger entries to on-chain transfers:
- Periodic batching to reduce gas costs
- Proof of payment on-chain for dispute resolution
- Optional escrow contracts for conditional payments

### Phase 4: Multi-Agent Economies

- Agent-to-agent service discovery and payment negotiation
- Revenue sharing agreements
- Conditional payments (pay on completion, pay on verification)
- Cross-chain settlement
