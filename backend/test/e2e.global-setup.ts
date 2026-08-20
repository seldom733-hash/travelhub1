/**
 * Jest `globalSetup`: prepares the isolated test database for e2e.
 *  - drops + recreates the test DB (guarded: name must contain "test");
 *  - applies the REAL Prisma migrations from prisma/migrations (migrate deploy);
 *  - fails loudly on any error (ON_ERROR_STOP + execFileSync throws).
 *
 * Runs once per jest invocation, before any test file. Dropping + recreating at
 * the START guarantees every run starts from a deterministic, empty state even
 * after a crashed run. globalTeardown leaves the DB for post-mortem inspection.
 *
 * CONCURRENCY: only one e2e run at a time against the same test DB is supported
 * (two simultaneous runs would drop each other's database).
 */
import { execSync } from "child_process";
import * as path from "path";
import { Client } from "pg";
import { extractDatabaseName, maintenanceUrl, resolveTestDatabaseUrl } from "./e2e-db-config";

const BACKEND_DIR = path.resolve(__dirname, "..");

/** Execute a SQL statement against PostgreSQL via Node.js pg client (no psql binary needed). */
async function pgExec(url: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
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

  // 1. Terminate existing connections, then drop + recreate the test database.
  await pgExec(admin, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${dbName}' AND pid != pg_backend_pid()`);
  await pgExec(admin, `DROP DATABASE IF EXISTS "${dbName}"`);
  await pgExec(admin, `CREATE DATABASE "${dbName}"`);
  process.stdout.write(`[e2e] Database "${dbName}" recreated.\n`);

  // 2. Apply the real Prisma migrations.
  process.stdout.write("[e2e] Applying Prisma migrations (prisma migrate deploy)...\n");
  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url },
  });

  process.stdout.write("[e2e] Test DB ready.\n");
}
