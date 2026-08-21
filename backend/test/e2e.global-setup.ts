/**
 * Jest `globalSetup`: prepares the isolated test database for e2e.
 *
 * Strategy:
 *  1. Drop + recreate the test DB (apply real Prisma migrations)
 *  2. Create a template DB from the test DB (for per-suite fast cloning)
 *
 * The template DB is created ONCE per jest invocation, then each suite
 * creates its own DB from the template (instant, no migrations needed).
 */
import { execSync } from "child_process";
import * as path from "path";
import { Client } from "pg";
import {
  extractDatabaseName,
  maintenanceUrl,
  replaceDbName,
  resolveTestDatabaseUrl,
} from "./e2e-db-config";

const BACKEND_DIR = path.resolve(__dirname, "..");
const TEMPLATE_DB_NAME = "template_travelhub_test";

/** Execute SQL against a PostgreSQL database via Node.js pg client. */
async function pgExec(url: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 15_000 });
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end().catch(() => {});
  }
}

export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  const dbName = extractDatabaseName(url);
  if (!dbName) throw new Error(`[e2e] Cannot parse database name from ${url}`);
  const admin = maintenanceUrl(url);

  process.stdout.write(`[e2e] Preparing isolated test DB "${dbName}" (${url})\n`);

  // 1. Terminate connections, drop + recreate the test database.
  await pgExec(
    admin,
    `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid != pg_backend_pid()`,
  );
  await pgExec(admin, `DROP DATABASE IF EXISTS "${dbName}"`);
  await pgExec(admin, `CREATE DATABASE "${dbName}"`);
  process.stdout.write(`[e2e] Database "${dbName}" created.\n`);

  // 2. Apply the real Prisma migrations to the test database.
  process.stdout.write("[e2e] Applying Prisma migrations (prisma migrate deploy)...\n");
  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url },
  });

  // 3. Create template database from the migrated test database.
  //    The template DB is used by e2e-isolated-env.ts for instant per-suite cloning.
  //    We connect via the maintenance DB (admin), not the template itself.
  process.stdout.write(`[e2e] Creating template database "${TEMPLATE_DB_NAME}"...\n`);
  await pgExec(admin, `DROP DATABASE IF EXISTS "${TEMPLATE_DB_NAME}"`);
  await pgExec(
    admin,
    `CREATE DATABASE "${TEMPLATE_DB_NAME}" TEMPLATE "${dbName}"`,
  );
  process.stdout.write(`[e2e] Template "${TEMPLATE_DB_NAME}" created.\n`);

  process.stdout.write("[e2e] Test DB + template ready.\n");
}
