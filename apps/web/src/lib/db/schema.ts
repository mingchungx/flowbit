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

export const wallets = pgTable(
  "wallets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    address: varchar("address", { length: 42 }).notNull(),
    privateKey: text("private_key").notNull(),
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
