import { db } from "@/lib/db";
import { usageRecords } from "@/lib/db/schema";
import { InvalidAgreementError } from "./types";
import { getAgreement } from "./query";

export async function reportUsage(agreementId: string, quantity: number) {
  const agreement = await getAgreement(agreementId);

  if (agreement.type !== "usage") {
    throw new InvalidAgreementError(
      `Cannot report usage for agreement type: ${agreement.type}`
    );
  }

  if (agreement.status !== "active") {
    throw new InvalidAgreementError(
      `Cannot report usage for agreement with status: ${agreement.status}`
    );
  }

  const [record] = await db
    .insert(usageRecords)
    .values({
      agreementId,
      quantity: quantity.toString(),
    })
    .returning();

  return record;
}
