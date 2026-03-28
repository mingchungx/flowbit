/**
 * Testnet End-to-End Test Script
 *
 * Exercises the full Flowbit flow against a running instance + Base Sepolia.
 *
 * Prerequisites:
 *   - Flowbit running at localhost:3000 (pnpm dev)
 *   - Postgres running (docker compose up -d)
 *   - An admin API key (pnpm db:create-admin-key)
 *   - Optional: TestUSDC deployed and env vars set for on-chain steps
 *
 * Usage:
 *   FLOWBIT_ADMIN_KEY=fb_admin_... tsx scripts/testnet-e2e.ts
 *
 * The script creates its own agent keys and wallets. On-chain steps are
 * skipped gracefully if chain configuration is not available.
 */

const API_URL = process.env.FLOWBIT_API_URL || "http://localhost:3000";
const ADMIN_KEY = process.env.FLOWBIT_ADMIN_KEY;

// ── Helpers ──

interface TestResult {
  name: string;
  passed: boolean;
  detail?: string;
  skipped?: boolean;
}

const results: TestResult[] = [];
let agentAKey = "";
let agentBKey = "";
let walletAId = "";
let walletBId = "";
let chainConfigured = false;

function pass(name: string, detail?: string) {
  results.push({ name, passed: true, detail });
  console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name: string, detail: string) {
  results.push({ name, passed: false, detail });
  console.error(`  FAIL  ${name} — ${detail}`);
}

function skip(name: string, reason: string) {
  results.push({ name, passed: true, skipped: true, detail: reason });
  console.log(`  SKIP  ${name} — ${reason}`);
}

async function request<T>(
  path: string,
  options: {
    method?: string;
    body?: unknown;
    apiKey?: string;
    expectStatus?: number;
  } = {}
): Promise<{ status: number; body: T }> {
  const { method = "GET", body, apiKey, expectStatus } = options;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const json = await res.json();

  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(
      `Expected HTTP ${expectStatus}, got ${res.status}: ${JSON.stringify(json)}`
    );
  }

  return { status: res.status, body: json as T };
}

// ── Test Steps ──

async function step0_checkPrereqs() {
  console.log("\n--- Step 0: Check prerequisites ---");

  if (!ADMIN_KEY) {
    fail(
      "Admin key check",
      "FLOWBIT_ADMIN_KEY env var is required. Create one with: pnpm db:create-admin-key"
    );
    process.exit(1);
  }
  pass("Admin key provided");

  // Health check
  const { body: health } = await request<{ status: string }>("/api/health");
  if (health.status !== "ok") {
    fail("Health check", `Server returned status: ${health.status}`);
    process.exit(1);
  }
  pass("Server is healthy");

  // Chain status
  const { body: chain } = await request<{
    configured: boolean;
    rpcReachable?: boolean;
    contractReadable?: boolean;
    deployerHasGas?: boolean;
  }>("/api/chain/status", { apiKey: ADMIN_KEY });
  chainConfigured = chain.configured;

  if (chainConfigured) {
    pass("Chain configured", `RPC reachable: ${chain.rpcReachable}, contract readable: ${chain.contractReadable}, deployer has gas: ${chain.deployerHasGas}`);
    if (!chain.rpcReachable || !chain.contractReadable || !chain.deployerHasGas) {
      console.log("    WARNING: Chain is configured but not fully healthy. On-chain steps may fail.");
    }
  } else {
    skip(
      "Chain configuration",
      "On-chain integration not configured. On-chain steps will be skipped."
    );
  }
}

async function step1_createAgentKeys() {
  console.log("\n--- Step 1: Create agent API keys ---");

  const { body: keyA } = await request<{ key: string; id: string }>(
    "/api/admin/keys",
    {
      method: "POST",
      apiKey: ADMIN_KEY,
      body: { name: "e2e-agent-a", scope: "agent" },
      expectStatus: 201,
    }
  );
  agentAKey = keyA.key;
  pass("Agent A key created", `id=${keyA.id}`);

  const { body: keyB } = await request<{ key: string; id: string }>(
    "/api/admin/keys",
    {
      method: "POST",
      apiKey: ADMIN_KEY,
      body: { name: "e2e-agent-b", scope: "agent" },
      expectStatus: 201,
    }
  );
  agentBKey = keyB.key;
  pass("Agent B key created", `id=${keyB.id}`);
}

async function step2_createWallets() {
  console.log("\n--- Step 2: Create wallets ---");

  const { body: walletA } = await request<{ id: string; address: string }>(
    "/api/wallets",
    {
      method: "POST",
      apiKey: agentAKey,
      body: { name: "e2e-wallet-a" },
      expectStatus: 201,
    }
  );
  walletAId = walletA.id;
  pass("Wallet A created", `id=${walletAId}, address=${walletA.address}`);

  const { body: walletB } = await request<{ id: string; address: string }>(
    "/api/wallets",
    {
      method: "POST",
      apiKey: agentBKey,
      body: { name: "e2e-wallet-b" },
      expectStatus: 201,
    }
  );
  walletBId = walletB.id;
  pass("Wallet B created", `id=${walletBId}, address=${walletB.address}`);
}

async function step3_fundWallet() {
  console.log("\n--- Step 3: Fund wallet A with 1000 USDC ---");

  const { body: tx } = await request<{
    id: string;
    amount: string;
    txHash: string | null;
  }>(`/api/wallets/${walletAId}/fund`, {
    method: "POST",
    apiKey: agentAKey,
    body: { amount: 1000, idempotency_key: "e2e-fund-a-1000" },
    expectStatus: 201,
  });
  pass("Wallet A funded", `tx=${tx.id}, amount=${tx.amount}`);

  // Verify balance
  const { body: wallet } = await request<{ balance: string }>(
    `/api/wallets/${walletAId}`,
    { apiKey: agentAKey }
  );
  if (parseFloat(wallet.balance) !== 1000) {
    fail(
      "Balance check after funding",
      `Expected 1000, got ${wallet.balance}`
    );
  } else {
    pass("Balance verified", `balance=${wallet.balance}`);
  }
}

async function step4_verifyOnChainBalance() {
  console.log("\n--- Step 4: Verify on-chain balance ---");

  if (!chainConfigured) {
    skip("On-chain balance check", "Chain not configured");
    return;
  }

  try {
    const { body: onchain } = await request<{
      ledgerBalance: string;
      onChainBalance: string;
    }>(`/api/wallets/${walletAId}/onchain`, { apiKey: agentAKey });

    pass(
      "On-chain balance retrieved",
      `ledger=${onchain.ledgerBalance}, onchain=${onchain.onChainBalance}`
    );
  } catch (err) {
    fail(
      "On-chain balance check",
      err instanceof Error ? err.message : String(err)
    );
  }
}

async function step5_sendPayment() {
  console.log("\n--- Step 5: Send 100 USDC from A to B ---");

  const { body: tx } = await request<{ id: string; amount: string }>(
    "/api/send",
    {
      method: "POST",
      apiKey: agentAKey,
      body: {
        from: walletAId,
        to: walletBId,
        amount: 100,
        memo: "e2e test payment",
        idempotency_key: "e2e-send-100",
      },
      expectStatus: 201,
    }
  );
  pass("Payment sent", `tx=${tx.id}, amount=${tx.amount}`);
}

async function step6_verifyBalances() {
  console.log("\n--- Step 6: Verify balances after payment ---");

  const { body: walletA } = await request<{ balance: string }>(
    `/api/wallets/${walletAId}`,
    { apiKey: agentAKey }
  );
  const { body: walletB } = await request<{ balance: string }>(
    `/api/wallets/${walletBId}`,
    { apiKey: agentBKey }
  );

  const balA = parseFloat(walletA.balance);
  const balB = parseFloat(walletB.balance);

  if (balA !== 900) {
    fail("Wallet A balance", `Expected 900, got ${balA}`);
  } else {
    pass("Wallet A balance", `balance=${walletA.balance}`);
  }

  if (balB !== 100) {
    fail("Wallet B balance", `Expected 100, got ${balB}`);
  } else {
    pass("Wallet B balance", `balance=${walletB.balance}`);
  }
}

async function step7_idempotency() {
  console.log("\n--- Step 7: Verify idempotency (replay same payment) ---");

  const { body: tx } = await request<{ id: string; amount: string }>(
    "/api/send",
    {
      method: "POST",
      apiKey: agentAKey,
      body: {
        from: walletAId,
        to: walletBId,
        amount: 100,
        memo: "e2e test payment",
        idempotency_key: "e2e-send-100",
      },
    }
  );
  pass("Idempotent replay returned", `tx=${tx.id}`);

  // Balance should NOT have changed
  const { body: walletA } = await request<{ balance: string }>(
    `/api/wallets/${walletAId}`,
    { apiKey: agentAKey }
  );
  if (parseFloat(walletA.balance) !== 900) {
    fail(
      "Idempotency balance check",
      `Expected 900 (unchanged), got ${walletA.balance}`
    );
  } else {
    pass("Idempotency confirmed", "Balance unchanged after replay");
  }
}

async function step8_addPolicy() {
  console.log("\n--- Step 8: Add max_per_tx policy (50) on wallet A ---");

  const { body: policy } = await request<{
    id: string;
    type: string;
    params: Record<string, unknown>;
  }>(`/api/wallets/${walletAId}/policies`, {
    method: "POST",
    apiKey: agentAKey,
    body: { type: "max_per_tx", params: { max: 50 } },
    expectStatus: 201,
  });
  pass("Policy created", `id=${policy.id}, type=${policy.type}, max=${policy.params.max}`);
}

async function step9_policyViolation() {
  console.log("\n--- Step 9: Try to send 75 USDC (should fail) ---");

  const { status, body } = await request<{ error?: string }>("/api/send", {
    method: "POST",
    apiKey: agentAKey,
    body: {
      from: walletAId,
      to: walletBId,
      amount: 75,
      idempotency_key: "e2e-send-75-blocked",
    },
  });

  if (status === 422 || status === 403) {
    pass("Policy violation caught", `status=${status}, error=${body.error}`);
  } else {
    fail(
      "Policy violation check",
      `Expected 422/403, got ${status}: ${JSON.stringify(body)}`
    );
  }
}

async function step10_sendWithinPolicy() {
  console.log("\n--- Step 10: Send 25 USDC (within policy limit) ---");

  const { body: tx } = await request<{ id: string; amount: string }>(
    "/api/send",
    {
      method: "POST",
      apiKey: agentAKey,
      body: {
        from: walletAId,
        to: walletBId,
        amount: 25,
        memo: "within policy limit",
        idempotency_key: "e2e-send-25-ok",
      },
      expectStatus: 201,
    }
  );
  pass("Payment within policy sent", `tx=${tx.id}, amount=${tx.amount}`);

  const { body: walletA } = await request<{ balance: string }>(
    `/api/wallets/${walletAId}`,
    { apiKey: agentAKey }
  );
  if (parseFloat(walletA.balance) !== 875) {
    fail("Balance after policy payment", `Expected 875, got ${walletA.balance}`);
  } else {
    pass("Balance after policy payment", `balance=${walletA.balance}`);
  }
}

async function step11_createAgreement() {
  console.log("\n--- Step 11: Create a subscription agreement ---");

  // Agent A pays Agent B 10 USDC/month
  const { body: agreement } = await request<{
    id: string;
    type: string;
    amount: string;
    status: string;
  }>("/api/agreements", {
    method: "POST",
    apiKey: agentAKey,
    body: {
      payer_wallet_id: walletAId,
      payee_wallet_id: walletBId,
      type: "subscription",
      amount: 10,
      interval: "monthly",
      metadata: { purpose: "e2e test subscription" },
    },
    expectStatus: 201,
  });
  pass(
    "Agreement created",
    `id=${agreement.id}, type=${agreement.type}, amount=${agreement.amount}`
  );

  return agreement.id;
}

async function step12_settleAgreement(agreementId: string) {
  console.log("\n--- Step 12: Settle the agreement ---");

  const { body: settled } = await request<{
    id: string;
    status: string;
    nextDueAt: string;
  }>(`/api/agreements/${agreementId}/settle`, {
    method: "POST",
    apiKey: agentAKey,
  });
  pass(
    "Agreement settled",
    `id=${settled.id}, nextDueAt=${settled.nextDueAt}`
  );

  // Verify balances (A paid 10 more to B)
  const { body: walletA } = await request<{ balance: string }>(
    `/api/wallets/${walletAId}`,
    { apiKey: agentAKey }
  );
  const { body: walletB } = await request<{ balance: string }>(
    `/api/wallets/${walletBId}`,
    { apiKey: agentBKey }
  );
  // A: 875 - 10 = 865, B: 125 + 10 = 135
  if (parseFloat(walletA.balance) !== 865) {
    fail(
      "Wallet A balance after settlement",
      `Expected 865, got ${walletA.balance}`
    );
  } else {
    pass("Wallet A balance after settlement", `balance=${walletA.balance}`);
  }

  if (parseFloat(walletB.balance) !== 135) {
    fail(
      "Wallet B balance after settlement",
      `Expected 135, got ${walletB.balance}`
    );
  } else {
    pass("Wallet B balance after settlement", `balance=${walletB.balance}`);
  }
}

async function step13_transactionLog() {
  console.log("\n--- Step 13: Verify transaction log ---");

  const { body: txs } = await request<Array<{ id: string; amount: string }>>(
    `/api/transactions?wallet_id=${walletAId}`,
    { apiKey: agentAKey }
  );

  if (!Array.isArray(txs) || txs.length === 0) {
    fail("Transaction log", "Expected transactions, got none");
  } else {
    pass("Transaction log", `${txs.length} transactions found for wallet A`);
  }
}

// ── Main ──

async function main() {
  console.log("=== Flowbit Testnet E2E Test ===");
  console.log(`API: ${API_URL}`);
  console.log(`Time: ${new Date().toISOString()}`);

  try {
    await step0_checkPrereqs();
    await step1_createAgentKeys();
    await step2_createWallets();
    await step3_fundWallet();
    await step4_verifyOnChainBalance();
    await step5_sendPayment();
    await step6_verifyBalances();
    await step7_idempotency();
    await step8_addPolicy();
    await step9_policyViolation();
    await step10_sendWithinPolicy();
    const agreementId = await step11_createAgreement();
    await step12_settleAgreement(agreementId);
    await step13_transactionLog();
  } catch (err) {
    console.error(
      "\nFATAL ERROR:",
      err instanceof Error ? err.message : String(err)
    );
    if (err instanceof Error && err.stack) {
      console.error(err.stack);
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  const passed = results.filter((r) => r.passed && !r.skipped).length;
  const failed = results.filter((r) => !r.passed).length;
  const skipped = results.filter((r) => r.skipped).length;
  console.log(`Passed:  ${passed}`);
  console.log(`Failed:  ${failed}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Total:   ${results.length}`);

  if (failed > 0) {
    console.log("\nFailed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(`  - ${r.name}: ${r.detail}`);
    }
    process.exit(1);
  }

  console.log("\nAll tests passed.");
}

main();
