import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import { wallets, transactions, ledgerEntries, policies, usageRecords, agreements, apiKeys } from "@/lib/db/schema";
import {
  createWallet,
  getWallet,
  listWallets,
  fundWallet,
  sendPayment,
  getTransactions,
  WalletNotFoundError,
  InsufficientFundsError,
  PolicyViolationError,
} from "../ledger";

beforeEach(async () => {
  // Clean all tables before each test (order matters for FK constraints)
  await db.delete(usageRecords);
  await db.delete(agreements);
  await db.delete(ledgerEntries);
  await db.delete(transactions);
  await db.delete(policies);
  await db.delete(wallets);
  await db.delete(apiKeys);
});

// ── Wallet CRUD ──

describe("createWallet", () => {
  it("creates a wallet with default USDC balance of 0", async () => {
    const wallet = await createWallet("test-agent");

    expect(wallet.id).toBeDefined();
    expect(wallet.name).toBe("test-agent");
    expect(wallet.currency).toBe("USDC");
    expect(wallet.balance).toBe("0.000000");
  });
});

describe("getWallet", () => {
  it("returns an existing wallet", async () => {
    const created = await createWallet("lookup-test");
    const fetched = await getWallet(created.id);

    expect(fetched.id).toBe(created.id);
    expect(fetched.name).toBe("lookup-test");
  });

  it("throws WalletNotFoundError for non-existent ID", async () => {
    await expect(
      getWallet("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(WalletNotFoundError);
  });
});

describe("listWallets", () => {
  it("returns all wallets ordered by createdAt", async () => {
    await createWallet("first");
    await createWallet("second");

    const all = await listWallets();
    expect(all).toHaveLength(2);
    expect(all[0].name).toBe("first");
    expect(all[1].name).toBe("second");
  });
});

// ── Funding ──

describe("fundWallet", () => {
  it("credits the wallet balance", async () => {
    const wallet = await createWallet("fund-test");
    await fundWallet(wallet.id, 100, "fund-key-1");

    const updated = await getWallet(wallet.id);
    expect(parseFloat(updated.balance)).toBe(100);
  });

  it("creates a transaction and ledger entry", async () => {
    const wallet = await createWallet("fund-ledger-test");
    const tx = await fundWallet(wallet.id, 50, "fund-key-2");

    expect(tx.fromWalletId).toBeNull();
    expect(tx.toWalletId).toBe(wallet.id);
    expect(tx.amount).toBe("50.000000");
    expect(tx.status).toBe("completed");

    const txs = await getTransactions(wallet.id);
    expect(txs).toHaveLength(1);
  });

  it("is idempotent — same key returns same transaction", async () => {
    const wallet = await createWallet("idempotent-fund");
    const tx1 = await fundWallet(wallet.id, 100, "idem-fund-1");
    const tx2 = await fundWallet(wallet.id, 100, "idem-fund-1");

    expect(tx1.id).toBe(tx2.id);

    // Balance should only be 100, not 200
    const updated = await getWallet(wallet.id);
    expect(parseFloat(updated.balance)).toBe(100);
  });

  it("throws WalletNotFoundError for non-existent wallet", async () => {
    await expect(
      fundWallet("00000000-0000-0000-0000-000000000000", 100, "no-wallet")
    ).rejects.toThrow(WalletNotFoundError);
  });
});

// ── Payments ──

describe("sendPayment", () => {
  it("transfers funds between wallets", async () => {
    const sender = await createWallet("sender");
    const receiver = await createWallet("receiver");
    await fundWallet(sender.id, 100, "send-fund-1");

    const tx = await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 30,
      idempotencyKey: "send-1",
    });

    expect(tx.amount).toBe("30.000000");
    expect(tx.status).toBe("completed");

    const s = await getWallet(sender.id);
    const r = await getWallet(receiver.id);
    expect(parseFloat(s.balance)).toBe(70);
    expect(parseFloat(r.balance)).toBe(30);
  });

  it("rejects when sender has insufficient funds", async () => {
    const sender = await createWallet("broke-sender");
    const receiver = await createWallet("receiver-2");
    await fundWallet(sender.id, 10, "send-fund-2");

    await expect(
      sendPayment({
        from: sender.id,
        to: receiver.id,
        amount: 50,
        idempotencyKey: "send-fail-1",
      })
    ).rejects.toThrow(InsufficientFundsError);

    // Balances unchanged
    const s = await getWallet(sender.id);
    expect(parseFloat(s.balance)).toBe(10);
  });

  it("rejects negative amounts", async () => {
    const w1 = await createWallet("neg-1");
    const w2 = await createWallet("neg-2");

    await expect(
      sendPayment({
        from: w1.id,
        to: w2.id,
        amount: -5,
        idempotencyKey: "neg-send",
      })
    ).rejects.toThrow("Amount must be positive");
  });

  it("rejects zero amount", async () => {
    const w1 = await createWallet("zero-1");
    const w2 = await createWallet("zero-2");

    await expect(
      sendPayment({
        from: w1.id,
        to: w2.id,
        amount: 0,
        idempotencyKey: "zero-send",
      })
    ).rejects.toThrow("Amount must be positive");
  });

  it("rejects sending to self", async () => {
    const w = await createWallet("self-send");
    await fundWallet(w.id, 100, "self-fund");

    await expect(
      sendPayment({
        from: w.id,
        to: w.id,
        amount: 10,
        idempotencyKey: "self-send-1",
      })
    ).rejects.toThrow("Cannot send to the same wallet");
  });

  it("is idempotent — same key returns same transaction", async () => {
    const sender = await createWallet("idem-sender");
    const receiver = await createWallet("idem-receiver");
    await fundWallet(sender.id, 100, "idem-send-fund");

    const tx1 = await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 25,
      idempotencyKey: "idem-send-1",
    });
    const tx2 = await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 25,
      idempotencyKey: "idem-send-1",
    });

    expect(tx1.id).toBe(tx2.id);

    // Balance should reflect only one transfer
    const s = await getWallet(sender.id);
    expect(parseFloat(s.balance)).toBe(75);
  });

  it("creates debit and credit ledger entries", async () => {
    const sender = await createWallet("ledger-sender");
    const receiver = await createWallet("ledger-receiver");
    await fundWallet(sender.id, 100, "ledger-fund");

    await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 40,
      idempotencyKey: "ledger-send-1",
    });

    // Sender should have fund tx + send tx
    const senderTxs = await getTransactions(sender.id);
    expect(senderTxs).toHaveLength(2);

    // Receiver should have send tx
    const receiverTxs = await getTransactions(receiver.id);
    expect(receiverTxs).toHaveLength(1);
  });
});

// ── Policy enforcement ──

describe("sendPayment with policies", () => {
  it("blocks payments exceeding max_per_tx", async () => {
    const sender = await createWallet("policy-sender-1");
    const receiver = await createWallet("policy-receiver-1");
    await fundWallet(sender.id, 100, "policy-fund-1");

    // Add max_per_tx policy of 20
    await db.insert(policies).values({
      walletId: sender.id,
      type: "max_per_tx",
      params: { max: 20 },
    });

    // Should succeed (15 < 20)
    await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 15,
      idempotencyKey: "policy-send-ok",
    });

    // Should fail (25 > 20)
    await expect(
      sendPayment({
        from: sender.id,
        to: receiver.id,
        amount: 25,
        idempotencyKey: "policy-send-fail",
      })
    ).rejects.toThrow(PolicyViolationError);
  });

  it("blocks payments exceeding daily_limit", async () => {
    const sender = await createWallet("daily-sender");
    const receiver = await createWallet("daily-receiver");
    await fundWallet(sender.id, 100, "daily-fund");

    await db.insert(policies).values({
      walletId: sender.id,
      type: "daily_limit",
      params: { limit: 30 },
    });

    // First send: 20 (total: 20, under 30)
    await sendPayment({
      from: sender.id,
      to: receiver.id,
      amount: 20,
      idempotencyKey: "daily-send-1",
    });

    // Second send: 15 (total would be 35, over 30)
    await expect(
      sendPayment({
        from: sender.id,
        to: receiver.id,
        amount: 15,
        idempotencyKey: "daily-send-2",
      })
    ).rejects.toThrow(PolicyViolationError);
  });

  it("blocks payments to wallets not on allowlist", async () => {
    const sender = await createWallet("allow-sender");
    const allowed = await createWallet("allowed-receiver");
    const blocked = await createWallet("blocked-receiver");
    await fundWallet(sender.id, 100, "allow-fund");

    await db.insert(policies).values({
      walletId: sender.id,
      type: "allowlist",
      params: { allowed_wallets: [allowed.id] },
    });

    // Should succeed (allowed wallet)
    await sendPayment({
      from: sender.id,
      to: allowed.id,
      amount: 10,
      idempotencyKey: "allow-send-ok",
    });

    // Should fail (blocked wallet)
    await expect(
      sendPayment({
        from: sender.id,
        to: blocked.id,
        amount: 10,
        idempotencyKey: "allow-send-fail",
      })
    ).rejects.toThrow(PolicyViolationError);
  });
});
