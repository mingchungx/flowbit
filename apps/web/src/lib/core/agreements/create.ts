import { db } from "@/lib/db";
import { agreements } from "@/lib/db/schema";
import { getWallet, sendPayment, InsufficientFundsError } from "../ledger";
import { InvalidAgreementError, VALID_TYPES } from "./types";
import type { CreateAgreementParams } from "./types";
import { computeNextDueAt } from "./helpers";

export async function createAgreement(params: CreateAgreementParams) {
  const {
    payerWalletId,
    payeeWalletId,
    type,
    amount,
    unit,
    interval,
    metadata,
  } = params;

  // Validate type
  if (!VALID_TYPES.includes(type)) {
    throw new InvalidAgreementError(
      `Invalid agreement type: ${type}. Must be one of: ${VALID_TYPES.join(", ")}`
    );
  }

  // Validate payer != payee
  if (payerWalletId === payeeWalletId) {
    throw new InvalidAgreementError(
      "Payer and payee wallets must be different"
    );
  }

  // Validate both wallets exist (will throw WalletNotFoundError if not)
  await getWallet(payerWalletId);
  await getWallet(payeeWalletId);

  // For retainer: verify payer has sufficient balance
  if (type === "retainer") {
    const payer = await getWallet(payerWalletId);
    if (parseFloat(payer.balance) < amount) {
      throw new InsufficientFundsError(payerWalletId, payer.balance, amount);
    }
  }

  const nextDueAt = computeNextDueAt(interval);

  // Insert the agreement
  const [agreement] = await db
    .insert(agreements)
    .values({
      payerWalletId,
      payeeWalletId,
      type,
      amount: amount.toString(),
      unit: unit || null,
      interval,
      nextDueAt,
      status: "active",
      metadata: metadata || {},
    })
    .returning();

  // For retainer: immediately transfer the full amount
  if (type === "retainer") {
    await sendPayment({
      from: payerWalletId,
      to: payeeWalletId,
      amount,
      idempotencyKey: `agreement_${agreement.id}_retainer_initial`,
      memo: `Retainer escrow for agreement ${agreement.id}`,
    });
  }

  return agreement;
}
