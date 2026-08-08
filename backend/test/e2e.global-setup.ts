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
import { execFileSync, execSync } from "child_process";
import * as path from "path";
import { extractDatabaseName, maintenanceUrl, resolveTestDatabaseUrl } from "./e2e-db-config";

const BACKEND_DIR = path.resolve(__dirname, "..");
const PG_ENV = { ...process.env, PGCONNECT_TIMEOUT: "10" };
const psql = process.platform === "win32" ? "psql.exe" : "psql";

export default async function globalSetup(): Promise<void> {
  const url = resolveTestDatabaseUrl();
  const dbName = extractDatabaseName(url);
  if (!dbName) throw new Error(`[e2e] Cannot parse database name from ${url}`);
  const admin = maintenanceUrl(url);

  process.stdout.write(`[e2e] Preparing isolated test DB "${dbName}" (${url})\n`);

  // 1. Drop + recreate the test database. WITH (FORCE) terminates leftover connections.
  try {
    execFileSync(psql, [admin, "-v", "ON_ERROR_STOP=1", "-c", `DROP DATABASE IF EXISTS "${dbName}" WITH (FORCE)`], {
      stdio: "inherit",
      env: PG_ENV,
    });
    execFileSync(psql, [admin, "-v", "ON_ERROR_STOP=1", "-c", `CREATE DATABASE "${dbName}"`], {
      stdio: "inherit",
      env: PG_ENV,
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        "[e2e] psql was not found on PATH. PostgreSQL client tools (psql) are required to create the isolated test DB.",
      );
    }
    throw err;
  }

  // 2. Apply the real Prisma migrations (prisma.config.ts reads process.env first,
  //    so DATABASE_URL below overrides backend/.env — the dev DB is never touched).
  //    execSync (shell) is required on Windows to launch npx.cmd.
  process.stdout.write("[e2e] Applying Prisma migrations (prisma migrate deploy)...\n");
  execSync("npx prisma migrate deploy", {
    cwd: BACKEND_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url, TEST_DATABASE_URL: url },
  });

  process.stdout.write("[e2e] Test DB ready.\n");
}
