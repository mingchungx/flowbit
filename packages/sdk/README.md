# @flowbit/sdk

TypeScript SDK for Flowbit. Provides a typed client and agent tool definitions.

## Build

```bash
pnpm build
```

## Client Usage

```typescript
import { FlowbitClient } from "@flowbit/sdk";

const pay = new FlowbitClient({ baseUrl: "http://localhost:3000" });

// Wallets
const wallet = await pay.createWallet("my-agent");
const w = await pay.getWallet(wallet.id);
const all = await pay.listWallets();

// Funding
await pay.fundWallet(wallet.id, 100);

// Payments
await pay.send({
  from: wallet.id,
  to: recipientId,
  amount: 10,
  memo: "API access fee",
  idempotencyKey: "unique-key-123",
});

// Transactions
const txs = await pay.getTransactions(wallet.id);

// Policies
await pay.addPolicy(wallet.id, "max_per_tx", { max: 25 });
const policies = await pay.listPolicies(wallet.id);
```

## Agent Tool Definitions

The SDK exports tool schemas compatible with OpenAI function calling, Claude tool_use, and any framework that accepts JSON Schema:

```typescript
import { agentTools } from "@flowbit/sdk/tools";

// agentTools is an array of:
// { name: string, description: string, parameters: JSONSchema }
//
// Tools: create_wallet, get_wallet, fund_wallet, send_payment,
//        get_transactions, add_spending_policy, list_policies
```

## Types

```typescript
import type {
  Wallet,
  Transaction,
  Policy,
  SendPaymentParams,
  FlowbitClientConfig,
} from "@flowbit/sdk";
```
