#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { FlowbitClient } from "@flowbit/sdk";

const baseUrl = process.env.FLOWBIT_API_URL || "http://localhost:3000";
const apiKey = process.env.FLOWBIT_API_KEY;
const client = new FlowbitClient({ baseUrl, apiKey });

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

// ── create_agreement ──

server.registerTool("create_agreement", {
  title: "Create Agreement",
  description:
    "Create a recurring financial agreement between two wallets",
  inputSchema: {
    payer_wallet_id: z.string().describe("The wallet ID of the payer"),
    payee_wallet_id: z.string().describe("The wallet ID of the payee"),
    type: z
      .enum(["subscription", "usage", "retainer"])
      .describe(
        "Agreement type: subscription (fixed recurring), usage (metered), retainer (upfront escrow)"
      ),
    amount: z
      .number()
      .positive()
      .describe(
        "Amount in USDC. For subscription/retainer: the fixed amount. For usage: the per-unit rate."
      ),
    unit: z
      .string()
      .optional()
      .describe(
        "Unit of measurement for usage-based agreements (e.g., api_call, gb, hour)"
      ),
    interval: z
      .enum(["daily", "weekly", "monthly"])
      .describe("Billing interval for the agreement"),
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe("Optional metadata to attach to the agreement"),
  },
}, async ({ payer_wallet_id, payee_wallet_id, type, amount, unit, interval, metadata }) => {
  const agreement = await client.createAgreement({
    payerWalletId: payer_wallet_id,
    payeeWalletId: payee_wallet_id,
    type,
    amount,
    unit,
    interval,
    metadata: metadata as Record<string, unknown> | undefined,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(agreement, null, 2) }],
  };
});

// ── get_agreement ──

server.registerTool("get_agreement", {
  title: "Get Agreement",
  description: "Get agreement details",
  inputSchema: {
    agreement_id: z.string().describe("The agreement ID to look up"),
  },
}, async ({ agreement_id }) => {
  const agreement = await client.getAgreement(agreement_id);
  return {
    content: [{ type: "text", text: JSON.stringify(agreement, null, 2) }],
  };
});

// ── list_agreements ──

server.registerTool("list_agreements", {
  title: "List Agreements",
  description:
    "List agreements, optionally filtered by wallet, type, or status",
  inputSchema: {
    wallet_id: z
      .string()
      .optional()
      .describe(
        "Filter by wallet ID (returns agreements where wallet is payer or payee)"
      ),
    type: z
      .enum(["subscription", "usage", "retainer"])
      .optional()
      .describe("Filter by agreement type"),
    status: z
      .enum(["active", "paused", "cancelled", "completed"])
      .optional()
      .describe("Filter by agreement status"),
  },
}, async ({ wallet_id, type, status }) => {
  const agreements = await client.listAgreements({
    walletId: wallet_id,
    type,
    status,
  });
  return {
    content: [{ type: "text", text: JSON.stringify(agreements, null, 2) }],
  };
});

// ── cancel_agreement ──

server.registerTool("cancel_agreement", {
  title: "Cancel Agreement",
  description: "Cancel an active agreement",
  inputSchema: {
    agreement_id: z.string().describe("The agreement ID to cancel"),
  },
}, async ({ agreement_id }) => {
  const agreement = await client.cancelAgreement(agreement_id);
  return {
    content: [{ type: "text", text: JSON.stringify(agreement, null, 2) }],
  };
});

// ── report_usage ──

server.registerTool("report_usage", {
  title: "Report Usage",
  description: "Report metered usage for a usage-based agreement",
  inputSchema: {
    agreement_id: z.string().describe("The usage-based agreement ID"),
    quantity: z
      .number()
      .positive()
      .describe("The quantity of usage to report"),
  },
}, async ({ agreement_id, quantity }) => {
  const record = await client.reportUsage(agreement_id, quantity);
  return {
    content: [{ type: "text", text: JSON.stringify(record, null, 2) }],
  };
});

// ── settle_agreement ──

server.registerTool("settle_agreement", {
  title: "Settle Agreement",
  description: "Settle a specific agreement (execute pending payment)",
  inputSchema: {
    agreement_id: z.string().describe("The agreement ID to settle"),
  },
}, async ({ agreement_id }) => {
  const result = await client.settleAgreement(agreement_id);
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  };
});

// ── settle_all_due ──

server.registerTool("settle_all_due", {
  title: "Settle All Due",
  description: "Settle all agreements that are due for payment",
  inputSchema: {},
}, async () => {
  const result = await client.settleAllDue();
  return {
    content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
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
