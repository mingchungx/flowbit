import { db } from "@/lib/db";
import { agreements } from "@/lib/db/schema";
import { eq, and, or, sql } from "drizzle-orm";
import { AgreementNotFoundError } from "./types";
import type { ListAgreementsFilters } from "./types";

export async function getAgreement(id: string) {
  const [agreement] = await db
    .select()
    .from(agreements)
    .where(eq(agreements.id, id));

  if (!agreement) {
    throw new AgreementNotFoundError(id);
  }

  return agreement;
}

export async function listAgreements(filters: ListAgreementsFilters = {}) {
  const conditions = [];

  if (filters.walletId) {
    conditions.push(
      or(
        eq(agreements.payerWalletId, filters.walletId),
        eq(agreements.payeeWalletId, filters.walletId)
      )
    );
  }

  if (filters.type) {
    conditions.push(eq(agreements.type, filters.type));
  }

  if (filters.status) {
    conditions.push(eq(agreements.status, filters.status));
  }

  const query = db.select().from(agreements);

  if (conditions.length > 0) {
    return query
      .where(and(...conditions))
      .orderBy(sql`${agreements.createdAt} DESC`);
  }

  return query.orderBy(sql`${agreements.createdAt} DESC`);
}
