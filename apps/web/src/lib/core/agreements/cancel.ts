import { db } from "@/lib/db";
import { agreements, transactions } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { sendPayment } from "../ledger";
import { getAgreement } from "./query";

export async function cancelAgreement(id: string) {
  const agreement = await getAgreement(id);

  // For retainer: calculate remaining balance and refund
  if (agreement.type === "retainer") {
    // Sum drawdowns from the retainer (excluding the initial escrow transfer).
    // Drawdowns are transactions from payer to payee with memo referencing the
    // agreement id, but NOT the initial escrow transfer.
    const initialKey = `agreement_${id}_retainer_initial`;
    const drawdowns = await db
      .select({
        total: sql<string>`COALESCE(SUM(${transactions.amount}), 0)`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.fromWalletId, agreement.payerWalletId),
          eq(transactions.toWalletId, agreement.payeeWalletId),
          sql`${transactions.memo} LIKE ${"%" + agreement.id + "%"}`,
          sql`${transactions.idempotencyKey} != ${initialKey}`
        )
      );

    const totalDrawn = parseFloat(drawdowns[0].total);
    const retainerAmount = parseFloat(agreement.amount);
    const remaining = retainerAmount - totalDrawn;

    if (remaining > 0) {
      await sendPayment({
        from: agreement.payeeWalletId,
        to: agreement.payerWalletId,
        amount: remaining,
        idempotencyKey: `agreement_${id}_refund`,
        memo: `Retainer refund for agreement ${id}`,
      });
    }
  }

  const [updated] = await db
    .update(agreements)
    .set({
      status: "cancelled",
      updatedAt: new Date(),
    })
    .where(eq(agreements.id, id))
    .returning();

  return updated;
}
