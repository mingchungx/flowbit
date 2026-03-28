import { db } from "@/lib/db";
import { agreements, usageRecords } from "@/lib/db/schema";
import { eq, and, lte, sql, isNull, ne } from "drizzle-orm";
import { sendPayment } from "../ledger";
import { InvalidAgreementError } from "./types";
import type { AgreementInterval } from "./types";
import { computeNextDueAt } from "./helpers";
import { getAgreement } from "./query";

export async function settleAgreement(id: string) {
  const agreement = await getAgreement(id);

  if (agreement.type === "subscription") {
    // Execute sendPayment for the fixed amount
    await sendPayment({
      from: agreement.payerWalletId,
      to: agreement.payeeWalletId,
      amount: parseFloat(agreement.amount),
      idempotencyKey: `agreement_${id}_${agreement.nextDueAt.toISOString()}`,
      memo: `Subscription payment for agreement ${id}`,
    });

    // Advance nextDueAt
    const newNextDueAt = computeNextDueAt(
      agreement.interval as AgreementInterval,
      agreement.nextDueAt
    );
    const [updated] = await db
      .update(agreements)
      .set({
        nextDueAt: newNextDueAt,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, id))
      .returning();

    return updated;
  }

  if (agreement.type === "usage") {
    // Sum unsettled usage records
    const unsettledResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(${usageRecords.quantity}), 0)`,
      })
      .from(usageRecords)
      .where(
        and(
          eq(usageRecords.agreementId, id),
          isNull(usageRecords.settledAt)
        )
      );

    const totalQuantity = parseFloat(unsettledResult[0].total);
    const perUnitRate = parseFloat(agreement.amount);
    const chargeAmount = totalQuantity * perUnitRate;

    // Only send payment if there is a non-zero charge
    if (chargeAmount > 0) {
      await sendPayment({
        from: agreement.payerWalletId,
        to: agreement.payeeWalletId,
        amount: chargeAmount,
        idempotencyKey: `agreement_${id}_${agreement.nextDueAt.toISOString()}`,
        memo: `Usage payment for agreement ${id}: ${totalQuantity} units`,
      });
    }

    // Mark all unsettled records as settled
    await db
      .update(usageRecords)
      .set({ settledAt: new Date() })
      .where(
        and(
          eq(usageRecords.agreementId, id),
          isNull(usageRecords.settledAt)
        )
      );

    // Advance nextDueAt
    const newNextDueAt = computeNextDueAt(
      agreement.interval as AgreementInterval,
      agreement.nextDueAt
    );
    const [updated] = await db
      .update(agreements)
      .set({
        nextDueAt: newNextDueAt,
        updatedAt: new Date(),
      })
      .where(eq(agreements.id, id))
      .returning();

    return updated;
  }

  if (agreement.type === "retainer") {
    // No periodic settlement needed for retainers
    return agreement;
  }

  throw new InvalidAgreementError(
    `Unknown agreement type: ${agreement.type}`
  );
}

export async function settleDueAgreements() {
  const now = new Date();

  // Find all active agreements that are due and not retainers
  const dueAgreements = await db
    .select()
    .from(agreements)
    .where(
      and(
        eq(agreements.status, "active"),
        lte(agreements.nextDueAt, now),
        ne(agreements.type, "retainer")
      )
    );

  let settled = 0;
  const errors: Array<{ agreementId: string; error: string }> = [];

  for (const agreement of dueAgreements) {
    try {
      await settleAgreement(agreement.id);
      settled++;
    } catch (error) {
      errors.push({
        agreementId: agreement.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { settled, errors };
}
