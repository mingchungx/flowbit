import { describe, it, expect, beforeEach } from "vitest";
import { db } from "@/lib/db";
import {
  wallets,
  transactions,
  ledgerEntries,
  policies,
  agreements,
  usageRecords,
  apiKeys,
} from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import {
  createWallet,
  getWallet,
  fundWallet,
  InsufficientFundsError,
} from "../ledger";
import {
  createAgreement,
  getAgreement,
  listAgreements,
  cancelAgreement,
  reportUsage,
  settleAgreement,
  settleDueAgreements,
  AgreementNotFoundError,
  InvalidAgreementError,
} from "../agreements";

// ── Helpers ──

async function createFundedWalletPair(
  payerFunds: number
): Promise<{ payer: Awaited<ReturnType<typeof createWallet>>; payee: Awaited<ReturnType<typeof createWallet>> }> {
  const payer = await createWallet(`payer-${Date.now()}-${Math.random()}`);
  const payee = await createWallet(`payee-${Date.now()}-${Math.random()}`);
  if (payerFunds > 0) {
    await fundWallet(payer.id, payerFunds, `fund-${payer.id}`);
  }
  return { payer, payee };
}

beforeEach(async () => {
  // Clean all tables before each test (FK order matters)
  await db.delete(usageRecords);
  await db.delete(agreements);
  await db.delete(ledgerEntries);
  await db.delete(transactions);
  await db.delete(policies);
  await db.delete(wallets);
  await db.delete(apiKeys);
});

// ── Subscription ──

describe("Subscription agreements", () => {
  it("creates agreement with correct nextDueAt", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const before = new Date();
    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 100,
      interval: "monthly",
    });

    expect(agreement.type).toBe("subscription");
    expect(agreement.status).toBe("active");
    expect(parseFloat(agreement.amount)).toBe(100);
    expect(agreement.interval).toBe("monthly");

    // nextDueAt should be ~30 days from now
    const expectedMin = new Date(before);
    expectedMin.setDate(expectedMin.getDate() + 29);
    const expectedMax = new Date(before);
    expectedMax.setDate(expectedMax.getDate() + 31);
    expect(agreement.nextDueAt.getTime()).toBeGreaterThanOrEqual(
      expectedMin.getTime()
    );
    expect(agreement.nextDueAt.getTime()).toBeLessThanOrEqual(
      expectedMax.getTime()
    );
  });

  it("settleAgreement executes payment and advances nextDueAt", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 50,
      interval: "weekly",
    });

    // Backdate nextDueAt so it's due now
    const backdatedDue = new Date(Date.now() - 60000);
    await db
      .update(agreements)
      .set({ nextDueAt: backdatedDue })
      .where(sql`${agreements.id} = ${agreement.id}`);

    const settled = await settleAgreement(agreement.id);

    // Payment should have been executed
    const payerWallet = await getWallet(payer.id);
    const payeeWallet = await getWallet(payee.id);
    expect(parseFloat(payerWallet.balance)).toBe(950);
    expect(parseFloat(payeeWallet.balance)).toBe(50);

    // nextDueAt should have advanced by 7 days from the backdated due date
    expect(settled.nextDueAt.getTime()).toBeGreaterThan(
      backdatedDue.getTime()
    );
  });

  it("rejects if payer has insufficient funds on settle", async () => {
    const { payer, payee } = await createFundedWalletPair(10);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 100,
      interval: "monthly",
    });

    await expect(settleAgreement(agreement.id)).rejects.toThrow(
      InsufficientFundsError
    );
  });

  it("settleDueAgreements finds and settles due subscriptions", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 25,
      interval: "daily",
    });

    // Backdate nextDueAt to make it due
    await db
      .update(agreements)
      .set({ nextDueAt: new Date(Date.now() - 60000) })
      .where(sql`${agreements.id} = ${agreement.id}`);

    const result = await settleDueAgreements();
    expect(result.settled).toBe(1);
    expect(result.errors).toHaveLength(0);

    // Verify payment happened
    const payerWallet = await getWallet(payer.id);
    expect(parseFloat(payerWallet.balance)).toBe(975);
  });
});

// ── Usage ──

describe("Usage agreements", () => {
  it("creates usage agreement", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "usage",
      amount: 0.5, // per-unit rate
      unit: "api_call",
      interval: "monthly",
    });

    expect(agreement.type).toBe("usage");
    expect(agreement.unit).toBe("api_call");
    expect(parseFloat(agreement.amount)).toBe(0.5);
  });

  it("reportUsage inserts records", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "usage",
      amount: 1,
      unit: "task",
      interval: "weekly",
    });

    const record1 = await reportUsage(agreement.id, 10);
    const record2 = await reportUsage(agreement.id, 5);

    expect(record1.agreementId).toBe(agreement.id);
    expect(parseFloat(record1.quantity)).toBe(10);
    expect(record1.settledAt).toBeNull();

    expect(record2.agreementId).toBe(agreement.id);
    expect(parseFloat(record2.quantity)).toBe(5);
  });

  it("settleAgreement sums unsettled usage, charges correct amount, marks records settled", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "usage",
      amount: 2, // $2 per unit
      unit: "api_call",
      interval: "monthly",
    });

    await reportUsage(agreement.id, 10);
    await reportUsage(agreement.id, 5);

    // Settle: 15 units * $2 = $30
    const settled = await settleAgreement(agreement.id);

    const payerWallet = await getWallet(payer.id);
    const payeeWallet = await getWallet(payee.id);
    expect(parseFloat(payerWallet.balance)).toBe(970);
    expect(parseFloat(payeeWallet.balance)).toBe(30);

    // nextDueAt should have advanced
    expect(settled.nextDueAt.getTime()).toBeGreaterThan(
      agreement.nextDueAt.getTime()
    );

    // Usage records should be marked as settled
    const records = await db
      .select()
      .from(usageRecords)
      .where(sql`${usageRecords.agreementId} = ${agreement.id}`);
    for (const record of records) {
      expect(record.settledAt).not.toBeNull();
    }
  });

  it("zero usage results in zero charge but still advances nextDueAt", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "usage",
      amount: 2,
      unit: "api_call",
      interval: "weekly",
    });

    // No usage reported — settle should still advance
    const settled = await settleAgreement(agreement.id);

    // Balances unchanged
    const payerWallet = await getWallet(payer.id);
    expect(parseFloat(payerWallet.balance)).toBe(1000);

    // nextDueAt advanced
    expect(settled.nextDueAt.getTime()).toBeGreaterThan(
      agreement.nextDueAt.getTime()
    );
  });
});

// ── Retainer ──

describe("Retainer agreements", () => {
  it("creates retainer and transfers full amount to payee immediately", async () => {
    const { payer, payee } = await createFundedWalletPair(500);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "retainer",
      amount: 200,
      interval: "monthly",
    });

    expect(agreement.type).toBe("retainer");

    // Payer should have 300, payee should have 200
    const payerWallet = await getWallet(payer.id);
    const payeeWallet = await getWallet(payee.id);
    expect(parseFloat(payerWallet.balance)).toBe(300);
    expect(parseFloat(payeeWallet.balance)).toBe(200);
  });

  it("rejects if payer has insufficient funds for retainer", async () => {
    const { payer, payee } = await createFundedWalletPair(50);

    await expect(
      createAgreement({
        payerWalletId: payer.id,
        payeeWalletId: payee.id,
        type: "retainer",
        amount: 200,
        interval: "monthly",
      })
    ).rejects.toThrow(InsufficientFundsError);
  });

  it("cancelAgreement refunds remaining balance", async () => {
    const { payer, payee } = await createFundedWalletPair(500);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "retainer",
      amount: 200,
      interval: "monthly",
    });

    // After creation: payer=300, payee=200
    // No drawdowns happened, so cancel should refund the full 200 back
    const cancelled = await cancelAgreement(agreement.id);
    expect(cancelled.status).toBe("cancelled");
    const payerWallet = await getWallet(payer.id);
    const payeeWallet = await getWallet(payee.id);

    // Payer should get refund: 300 + 200 = 500
    expect(parseFloat(payerWallet.balance)).toBe(500);
    // Payee should be back to 0
    expect(parseFloat(payeeWallet.balance)).toBe(0);
  });
});

// ── General ──

describe("General agreement operations", () => {
  it("rejects creation with same payer and payee", async () => {
    const payer = await createWallet("self-agreement");
    await fundWallet(payer.id, 1000, `fund-${payer.id}`);

    await expect(
      createAgreement({
        payerWalletId: payer.id,
        payeeWalletId: payer.id,
        type: "subscription",
        amount: 50,
        interval: "monthly",
      })
    ).rejects.toThrow(InvalidAgreementError);
  });

  it("cancelAgreement sets status to cancelled", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 50,
      interval: "monthly",
    });

    const cancelled = await cancelAgreement(agreement.id);
    expect(cancelled.status).toBe("cancelled");
  });

  it("getAgreement throws for non-existent ID", async () => {
    await expect(
      getAgreement("00000000-0000-0000-0000-000000000000")
    ).rejects.toThrow(AgreementNotFoundError);
  });

  it("listAgreements filters by walletId", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);
    const other = await createWallet("other-wallet");

    await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 50,
      interval: "monthly",
    });

    // payer should see the agreement
    const payerAgreements = await listAgreements({ walletId: payer.id });
    expect(payerAgreements).toHaveLength(1);

    // payee should also see the agreement
    const payeeAgreements = await listAgreements({ walletId: payee.id });
    expect(payeeAgreements).toHaveLength(1);

    // other should see nothing
    const otherAgreements = await listAgreements({ walletId: other.id });
    expect(otherAgreements).toHaveLength(0);
  });

  it("listAgreements filters by type", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 50,
      interval: "monthly",
    });

    await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "usage",
      amount: 1,
      unit: "api_call",
      interval: "monthly",
    });

    const subs = await listAgreements({ type: "subscription" });
    expect(subs).toHaveLength(1);
    expect(subs[0].type).toBe("subscription");

    const usageAgreements = await listAgreements({ type: "usage" });
    expect(usageAgreements).toHaveLength(1);
    expect(usageAgreements[0].type).toBe("usage");
  });

  it("listAgreements filters by status", async () => {
    const { payer, payee } = await createFundedWalletPair(1000);

    const agreement = await createAgreement({
      payerWalletId: payer.id,
      payeeWalletId: payee.id,
      type: "subscription",
      amount: 50,
      interval: "monthly",
    });

    await cancelAgreement(agreement.id);

    const active = await listAgreements({ status: "active" });
    expect(active).toHaveLength(0);

    const cancelled = await listAgreements({ status: "cancelled" });
    expect(cancelled).toHaveLength(1);
  });
});

