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

program
  .name("agent-pay")
  .description("Agent-native financial infrastructure CLI")
  .version("0.0.1");

program.parse();
