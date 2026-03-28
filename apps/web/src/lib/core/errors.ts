export class InsufficientFundsError extends Error {
  constructor(walletId: string, balance: string, amount: number) {
    super(
      `Wallet ${walletId} has insufficient funds: balance ${balance}, attempted ${amount}`
    );
    this.name = "InsufficientFundsError";
  }
}

export class PolicyViolationError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PolicyViolationError";
  }
}

export class WalletNotFoundError extends Error {
  constructor(walletId: string) {
    super(`Wallet not found: ${walletId}`);
    this.name = "WalletNotFoundError";
  }
}

export class DuplicateTransactionError extends Error {
  constructor(idempotencyKey: string) {
    super(
      `Transaction with idempotency key already exists: ${idempotencyKey}`
    );
    this.name = "DuplicateTransactionError";
  }
}
