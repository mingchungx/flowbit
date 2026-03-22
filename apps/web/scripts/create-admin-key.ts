/**
 * Bootstrap script: creates the first admin API key.
 *
 * Usage:
 *   pnpm db:create-admin-key
 *   # or
 *   tsx scripts/create-admin-key.ts [key-name]
 *
 * The key is printed once and never stored in plaintext.
 * Save it securely — it cannot be recovered.
 */

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes, createHash } from "crypto";

const connectionString =
  process.env.DATABASE_URL ||
  "postgres://flowbit:flowbit@localhost:5432/flowbit";

async function main() {
  const name = process.argv[2] || "bootstrap-admin";

  const client = postgres(connectionString);
  const db = drizzle(client);

  const prefix = "fb_admin_";
  const random = randomBytes(24).toString("base64url");
  const raw = `${prefix}${random}`;
  const hash = createHash("sha256").update(raw).digest("hex");

  await db.execute(
    // Use raw SQL to avoid importing schema (standalone script)
    {
      sql: `INSERT INTO api_keys (key_hash, name, scope) VALUES ($1, $2, $3)`,
      params: [hash, name, "admin"],
    } as never
  );

  console.log("\n=== Admin API Key Created ===");
  console.log(`Name:  ${name}`);
  console.log(`Key:   ${raw}`);
  console.log("\nSave this key now. It cannot be recovered.\n");

  await client.end();
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});
