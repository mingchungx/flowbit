/**
 * Agent tool interface definitions.
 *
 * These schemas can be used with OpenAI function calling, Claude tool_use,
 * MCP servers, or any agent framework that accepts JSON Schema tool definitions.
 */

export const agentTools = [
  {
    name: "create_wallet",
    description: "Create a new custodial wallet for holding USDC funds",
    parameters: {
      type: "object" as const,
      properties: {
        name: {
          type: "string",
          description: "A human-readable name for the wallet",
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_wallet",
    description:
      "Get wallet details including current balance, currency, and metadata",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The wallet ID to look up",
        },
      },
      required: ["wallet_id"],
    },
  },
  {
    name: "fund_wallet",
    description: "Add testnet USDC funds to a wallet",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The wallet ID to fund",
        },
        amount: {
          type: "number",
          description: "Amount of USDC to add",
        },
      },
      required: ["wallet_id", "amount"],
    },
  },
  {
    name: "send_payment",
    description:
      "Safely send USDC from one wallet to another within budget constraints. Idempotent — safe to retry with the same idempotency_key.",
    parameters: {
      type: "object" as const,
      properties: {
        from: {
          type: "string",
          description: "Source wallet ID",
        },
        to: {
          type: "string",
          description: "Destination wallet ID",
        },
        amount: {
          type: "number",
          description: "Amount of USDC to send",
        },
        memo: {
          type: "string",
          description: "Optional memo describing the payment purpose",
        },
        idempotency_key: {
          type: "string",
          description:
            "Unique key to ensure the payment is only processed once. Safe to retry.",
        },
      },
      required: ["from", "to", "amount"],
    },
  },
  {
    name: "get_transactions",
    description:
      "Get the transaction history for a wallet, including payments sent, received, and funding events",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The wallet ID to get transactions for",
        },
      },
      required: ["wallet_id"],
    },
  },
  {
    name: "add_spending_policy",
    description:
      "Attach a spending constraint to a wallet. Policies are enforced on every outgoing payment.",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The wallet ID to attach the policy to",
        },
        type: {
          type: "string",
          enum: ["max_per_tx", "daily_limit", "allowlist"],
          description:
            "Policy type: max_per_tx (cap per transaction), daily_limit (daily spend cap), allowlist (restrict recipients)",
        },
        params: {
          type: "object",
          description:
            'Policy parameters. max_per_tx: {"max": number}, daily_limit: {"limit": number}, allowlist: {"allowed_wallets": string[]}',
        },
      },
      required: ["wallet_id", "type", "params"],
    },
  },
  {
    name: "list_policies",
    description: "List all active spending policies for a wallet",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description: "The wallet ID to list policies for",
        },
      },
      required: ["wallet_id"],
    },
  },
  {
    name: "create_agreement",
    description:
      "Create a recurring financial agreement between two wallets",
    parameters: {
      type: "object" as const,
      properties: {
        payer_wallet_id: {
          type: "string",
          description: "The wallet ID of the payer",
        },
        payee_wallet_id: {
          type: "string",
          description: "The wallet ID of the payee",
        },
        type: {
          type: "string",
          enum: ["subscription", "usage", "retainer"],
          description:
            "Agreement type: subscription (fixed recurring), usage (metered), retainer (upfront escrow)",
        },
        amount: {
          type: "number",
          description:
            "Amount in USDC. For subscription/retainer: the fixed amount. For usage: the per-unit rate.",
        },
        unit: {
          type: "string",
          description:
            "Unit of measurement for usage-based agreements (e.g., api_call, gb, hour)",
        },
        interval: {
          type: "string",
          enum: ["daily", "weekly", "monthly"],
          description: "Billing interval for the agreement",
        },
        metadata: {
          type: "object",
          description: "Optional metadata to attach to the agreement",
        },
      },
      required: ["payer_wallet_id", "payee_wallet_id", "type", "amount", "interval"],
    },
  },
  {
    name: "get_agreement",
    description: "Get agreement details",
    parameters: {
      type: "object" as const,
      properties: {
        agreement_id: {
          type: "string",
          description: "The agreement ID to look up",
        },
      },
      required: ["agreement_id"],
    },
  },
  {
    name: "list_agreements",
    description:
      "List agreements, optionally filtered by wallet, type, or status",
    parameters: {
      type: "object" as const,
      properties: {
        wallet_id: {
          type: "string",
          description:
            "Filter by wallet ID (returns agreements where wallet is payer or payee)",
        },
        type: {
          type: "string",
          enum: ["subscription", "usage", "retainer"],
          description: "Filter by agreement type",
        },
        status: {
          type: "string",
          enum: ["active", "paused", "cancelled", "completed"],
          description: "Filter by agreement status",
        },
      },
      required: [],
    },
  },
  {
    name: "cancel_agreement",
    description: "Cancel an active agreement",
    parameters: {
      type: "object" as const,
      properties: {
        agreement_id: {
          type: "string",
          description: "The agreement ID to cancel",
        },
      },
      required: ["agreement_id"],
    },
  },
  {
    name: "report_usage",
    description: "Report metered usage for a usage-based agreement",
    parameters: {
      type: "object" as const,
      properties: {
        agreement_id: {
          type: "string",
          description: "The usage-based agreement ID",
        },
        quantity: {
          type: "number",
          description: "The quantity of usage to report",
        },
      },
      required: ["agreement_id", "quantity"],
    },
  },
  {
    name: "settle_agreement",
    description: "Settle a specific agreement (execute pending payment)",
    parameters: {
      type: "object" as const,
      properties: {
        agreement_id: {
          type: "string",
          description: "The agreement ID to settle",
        },
      },
      required: ["agreement_id"],
    },
  },
  {
    name: "settle_all_due",
    description: "Settle all agreements that are due for payment",
    parameters: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
] as const;
