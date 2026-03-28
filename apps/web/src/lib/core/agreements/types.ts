export class AgreementNotFoundError extends Error {
  constructor(agreementId: string) {
    super(`Agreement not found: ${agreementId}`);
    this.name = "AgreementNotFoundError";
  }
}

export class InvalidAgreementError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "InvalidAgreementError";
  }
}

export type AgreementType = "subscription" | "usage" | "retainer";
export type AgreementInterval = "daily" | "weekly" | "monthly";
export type AgreementStatus = "active" | "paused" | "cancelled" | "completed";

export interface CreateAgreementParams {
  payerWalletId: string;
  payeeWalletId: string;
  type: AgreementType;
  amount: number;
  unit?: string;
  interval: AgreementInterval;
  metadata?: Record<string, unknown>;
}

export interface ListAgreementsFilters {
  walletId?: string;
  type?: AgreementType;
  status?: AgreementStatus;
}

export const VALID_TYPES: AgreementType[] = ["subscription", "usage", "retainer"];
