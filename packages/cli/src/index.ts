#!/usr/bin/env node

import { Command } from "commander";
import { FlowbitClient } from "./client.js";

const program = new Command();
const client = new FlowbitClient(process.env.FLOWBIT_API_URL);

function output(data: unknown, format: string) {
  if (format === "json") {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

// ── wallet commands ──

const wallet = program
  .command("wallet")
  .description("Manage wallets");

wallet
  .command("create")
  .description("Create a new wallet")
  .requiredOption("--name <name>", "Wallet name")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const result = await client.createWallet(opts.name);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

wallet
  .command("get")
  .description("Get wallet details")
  .argument("<id>", "Wallet ID")
  .option("--output <format>", "Output format", "json")
  .action(async (id, opts) => {
    try {
      const result = await client.getWallet(id);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

wallet
  .command("list")
  .description("List all wallets")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const result = await client.listWallets();
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── fund command ──

program
  .command("fund")
  .description("Fund a wallet with testnet USDC")
  .argument("<wallet-id>", "Wallet ID")
  .requiredOption("--amount <amount>", "Amount to fund", parseFloat)
  .option("--idempotency-key <key>", "Idempotency key")
  .option("--output <format>", "Output format", "json")
  .action(async (walletId, opts) => {
    try {
      const result = await client.fundWallet(
        walletId,
        opts.amount,
        opts.idempotencyKey
      );
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── send command ──

program
  .command("send")
  .description("Send a payment between wallets")
  .requiredOption("--from <wallet-id>", "Source wallet ID")
  .requiredOption("--to <wallet-id>", "Destination wallet ID")
  .requiredOption("--amount <amount>", "Amount to send", parseFloat)
  .option("--memo <memo>", "Transaction memo")
  .option("--idempotency-key <key>", "Idempotency key")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const result = await client.send({
        from: opts.from,
        to: opts.to,
        amount: opts.amount,
        memo: opts.memo,
        idempotencyKey: opts.idempotencyKey,
      });
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── logs command ──

program
  .command("logs")
  .description("View transaction logs for a wallet")
  .argument("<wallet-id>", "Wallet ID")
  .option("--output <format>", "Output format", "json")
  .action(async (walletId, opts) => {
    try {
      const result = await client.getTransactions(walletId);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── policy commands ──

const policy = program
  .command("policy")
  .description("Manage wallet spending policies");

policy
  .command("add")
  .description("Add a spending policy to a wallet")
  .requiredOption("--wallet <wallet-id>", "Wallet ID")
  .requiredOption(
    "--type <type>",
    "Policy type (max_per_tx, daily_limit, allowlist)"
  )
  .requiredOption("--params <json>", "Policy parameters as JSON")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const params = JSON.parse(opts.params);
      const result = await client.addPolicy(opts.wallet, opts.type, params);
      output(result, opts.output);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("Error: --params must be valid JSON");
        process.exit(1);
      }
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

policy
  .command("list")
  .description("List policies for a wallet")
  .argument("<wallet-id>", "Wallet ID")
  .option("--output <format>", "Output format", "json")
  .action(async (walletId, opts) => {
    try {
      const result = await client.listPolicies(walletId);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

// ── agreement commands ──

const agreement = program
  .command("agreement")
  .description("Manage recurring agreements");

agreement
  .command("create")
  .description("Create a new agreement between two wallets")
  .requiredOption("--payer <wallet-id>", "Payer wallet ID")
  .requiredOption("--payee <wallet-id>", "Payee wallet ID")
  .requiredOption(
    "--type <type>",
    "Agreement type (subscription, usage, retainer)"
  )
  .requiredOption("--amount <amount>", "Amount in USDC", parseFloat)
  .requiredOption(
    "--interval <interval>",
    "Billing interval (daily, weekly, monthly)"
  )
  .option("--unit <unit>", "Unit for usage-based agreements")
  .option("--metadata <json>", "Metadata as JSON")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const metadata = opts.metadata ? JSON.parse(opts.metadata) : undefined;
      const result = await client.createAgreement({
        payerWalletId: opts.payer,
        payeeWalletId: opts.payee,
        type: opts.type,
        amount: opts.amount,
        unit: opts.unit,
        interval: opts.interval,
        metadata,
      });
      output(result, opts.output);
    } catch (err) {
      if (err instanceof SyntaxError) {
        console.error("Error: --metadata must be valid JSON");
        process.exit(1);
      }
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("get")
  .description("Get agreement details")
  .argument("<agreement-id>", "Agreement ID")
  .option("--output <format>", "Output format", "json")
  .action(async (id, opts) => {
    try {
      const result = await client.getAgreement(id);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("list")
  .description("List agreements")
  .option("--wallet <wallet-id>", "Filter by wallet ID")
  .option("--type <type>", "Filter by type (subscription, usage, retainer)")
  .option(
    "--status <status>",
    "Filter by status (active, paused, cancelled, completed)"
  )
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const result = await client.listAgreements({
        walletId: opts.wallet,
        type: opts.type,
        status: opts.status,
      });
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("cancel")
  .description("Cancel an active agreement")
  .argument("<agreement-id>", "Agreement ID")
  .option("--output <format>", "Output format", "json")
  .action(async (id, opts) => {
    try {
      const result = await client.cancelAgreement(id);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("usage")
  .description("Report metered usage for a usage-based agreement")
  .argument("<agreement-id>", "Agreement ID")
  .requiredOption("--quantity <quantity>", "Usage quantity", parseFloat)
  .option("--output <format>", "Output format", "json")
  .action(async (id, opts) => {
    try {
      const result = await client.reportUsage(id, opts.quantity);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("settle")
  .description("Settle a specific agreement")
  .argument("<agreement-id>", "Agreement ID")
  .option("--output <format>", "Output format", "json")
  .action(async (id, opts) => {
    try {
      const result = await client.settleAgreement(id);
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

agreement
  .command("settle-all")
  .description("Settle all agreements that are due for payment")
  .option("--output <format>", "Output format", "json")
  .action(async (opts) => {
    try {
      const result = await client.settleAllDue();
      output(result, opts.output);
    } catch (err) {
      console.error("Error:", (err as Error).message);
      process.exit(1);
    }
  });

program
  .name("agent-pay")
  .description("Agent-native financial infrastructure CLI")
  .version("0.0.1");

program.parse();
