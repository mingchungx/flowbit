#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FlowbitClient } from "@flowbit/sdk";

const baseUrl = process.env.FLOWBIT_API_URL || "http://localhost:3000";
const client = new FlowbitClient({ baseUrl });

const server = new McpServer({
  name: "flowbit",
  version: "0.0.1",
});

// ── create_wallet ──

server.registerTool("create_wallet", {
  title: "Create Wallet",
  description: "Create a new custodial wallet for holding USDC funds",
  inputSchema: {
    name: z.string().describe("A human-readable name for the wallet"),
  },
}, async ({ name }) => {
  const wallet = await client.createWallet(name);
  return {
    content: [{ type: "text", text: JSON.stringify(wallet, null, 2) }],
  };
});

// ── get_wallet ──

server.registerTool("get_wallet", {
  title: "Get Wallet",
  description:
    "Get wallet details including current balance, currency, and metadata",
  inputSchema: {
    wallet_id: z.string().describe("The wallet ID to look up"),
  },
}, async ({ wallet_id }) => {
  const wallet = await client.getWallet(wallet_id);
  return {
    content: [{ type: "text", text: JSON.stringify(wallet, null, 2) }],
  };
});

// ── list_wallets ──

server.registerTool("list_wallets", {
  title: "List Wallets",
  description: "List all wallets",
  inputSchema: {},
}, async () => {
  const wallets = await client.listWallets();
  return {
    content: [{ type: "text", text: JSON.stringify(wallets, null, 2) }],
  };
});

// ── fund_wallet ──

server.registerTool("fund_wallet", {
  title: "Fund Wallet",
  description: "Add testnet USDC funds to a wallet",
  inputSchema: {
    wallet_id: z.string().describe("The wallet ID to fund"),
    amount: z.number().positive().describe("Amount of USDC to add"),
  },
}, async ({ wallet_id, amount }) => {
  const tx = await client.fundWallet(wallet_id, amount);
  return {
    content: [{ type: "text", text: JSON.stringify(tx, null, 2) }],
  };
});

// ── send_payment ──

server.registerTool("send_payment", {
  title: "Send Payment",
  description:
    "Safely send USDC from one wallet to another within budget constraints. Idempotent — safe to retry with the same idempotency_key.",
  inputSchema: {
    from: z.string().describe("Source wallet ID"),
    to: z.string().describe("Destination wallet ID"),
    amount: z.number().positive().describe("Amount of USDC to send"),
    memo: z
      .string()
      .optional()
      .describe("Optional memo describing the payment purpose"),
    idempotency_key: z
      .string()
      .optional()
      .describe(
        "Unique key to ensure the payment is only processed once. Safe to retry."
      ),
  },
}, async ({ from, to, amount, memo, idempotency_key }) => {
  const tx = await client.send({
    from,
    to,
    amount,
    memo,
    idempotencyKey: idempotency_key,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(tx, null, 2) }],
  };
});

// ── get_transactions ──

server.registerTool("get_transactions", {
  title: "Get Transactions",
  description:
    "Get the transaction history for a wallet, including payments sent, received, and funding events",
  inputSchema: {
    wallet_id: z
      .string()
      .describe("The wallet ID to get transactions for"),
  },
}, async ({ wallet_id }) => {
  const txs = await client.getTransactions(wallet_id);
  return {
    content: [{ type: "text", text: JSON.stringify(txs, null, 2) }],
  };
});

// ── add_spending_policy ──

server.registerTool("add_spending_policy", {
  title: "Add Spending Policy",
  description:
    "Attach a spending constraint to a wallet. Policies are enforced on every outgoing payment.",
  inputSchema: {
    wallet_id: z
      .string()
      .describe("The wallet ID to attach the policy to"),
    type: z
      .enum(["max_per_tx", "daily_limit", "allowlist"])
      .describe(
        "Policy type: max_per_tx (cap per transaction), daily_limit (daily spend cap), allowlist (restrict recipients)"
      ),
    params: z
      .record(z.string(), z.unknown())
      .describe(
        'Policy parameters. max_per_tx: {"max": number}, daily_limit: {"limit": number}, allowlist: {"allowed_wallets": string[]}'
      ),
  },
}, async ({ wallet_id, type, params }) => {
  const policy = await client.addPolicy(
    wallet_id,
    type,
    params as Record<string, unknown>
  );
  return {
    content: [{ type: "text", text: JSON.stringify(policy, null, 2) }],
  };
});

// ── list_policies ──

server.registerTool("list_policies", {
  title: "List Policies",
  description: "List all active spending policies for a wallet",
  inputSchema: {
    wallet_id: z
      .string()
      .describe("The wallet ID to list policies for"),
  },
}, async ({ wallet_id }) => {
  const policies = await client.listPolicies(wallet_id);
  return {
    content: [{ type: "text", text: JSON.stringify(policies, null, 2) }],
  };
});

// ── Start ──

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Flowbit MCP server running on stdio");
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
