import {
  pgTable,
  uuid,
  varchar,
  decimal,
  timestamp,
  boolean,
  jsonb,
  index,
  uniqueIndex,
  text,
} from "drizzle-orm/pg-core";

export const apiKeys = pgTable(
  "api_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    keyHash: varchar("key_hash", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    scope: varchar("scope", { length: 10 }).notNull(), // "agent" or "admin"
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [uniqueIndex("api_keys_hash_idx").on(table.keyHash)]
);

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    privateKey: text("private_key").notNull(),
    ownerKeyId: uuid("owner_key_id").references(() => apiKeys.id),
    currency: varchar("currency", { length: 10 }).notNull().default("USDC"),
    balance: decimal("balance", { precision: 18, scale: 6 })
      .notNull()
      .default("0"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("wallets_created_at_idx").on(table.createdAt),
    uniqueIndex("wallets_address_idx").on(table.address),
    index("wallets_owner_key_idx").on(table.ownerKeyId),
  ]
);

export const transactions = pgTable(
  "transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    idempotencyKey: varchar("idempotency_key", { length: 255 }).notNull(),
    fromWalletId: uuid("from_wallet_id").references(() => wallets.id),
    toWalletId: uuid("to_wallet_id")
      .references(() => wallets.id)
      .notNull(),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    memo: varchar("memo", { length: 500 }),
    status: varchar("status", { length: 20 }).notNull().default("completed"),
    txHash: varchar("tx_hash", { length: 66 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("transactions_idempotency_key_idx").on(table.idempotencyKey),
    index("transactions_from_wallet_idx").on(table.fromWalletId),
    index("transactions_to_wallet_idx").on(table.toWalletId),
    index("transactions_created_at_idx").on(table.createdAt),
  ]
);

export const ledgerEntries = pgTable(
  "ledger_entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    transactionId: uuid("transaction_id")
      .references(() => transactions.id)
      .notNull(),
    walletId: uuid("wallet_id")
      .references(() => wallets.id)
      .notNull(),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    direction: varchar("direction", { length: 10 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("ledger_entries_wallet_idx").on(table.walletId),
    index("ledger_entries_transaction_idx").on(table.transactionId),
  ]
);

export const policies = pgTable(
  "policies",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    walletId: uuid("wallet_id")
      .references(() => wallets.id)
      .notNull(),
    type: varchar("type", { length: 50 }).notNull(),
    params: jsonb("params").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [index("policies_wallet_idx").on(table.walletId)]
);

export const agreements = pgTable(
  "agreements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    payerWalletId: uuid("payer_wallet_id")
      .references(() => wallets.id)
      .notNull(),
    payeeWalletId: uuid("payee_wallet_id")
      .references(() => wallets.id)
      .notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    amount: decimal("amount", { precision: 18, scale: 6 }).notNull(),
    unit: varchar("unit", { length: 50 }),
    interval: varchar("interval", { length: 20 }).notNull(),
    nextDueAt: timestamp("next_due_at").notNull(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    metadata: jsonb("metadata").default({}),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("agreements_payer_wallet_idx").on(table.payerWalletId),
    index("agreements_payee_wallet_idx").on(table.payeeWalletId),
    index("agreements_status_next_due_idx").on(table.status, table.nextDueAt),
  ]
);

export const usageRecords = pgTable(
  "usage_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    agreementId: uuid("agreement_id")
      .references(() => agreements.id)
      .notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 6 }).notNull(),
    reportedAt: timestamp("reported_at").defaultNow().notNull(),
    settledAt: timestamp("settled_at"),
  },
  (table) => [
    index("usage_records_agreement_idx").on(table.agreementId),
    index("usage_records_agreement_unsettled_idx").on(
      table.agreementId,
      table.settledAt
    ),
  ]
);
