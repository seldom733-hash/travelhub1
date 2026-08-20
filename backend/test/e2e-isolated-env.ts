/**
 * Jest custom TestEnvironment for per-suite PostgreSQL database isolation.
 *
 * Each E2E suite gets its own PostgreSQL database:
 *   1. CREATE DATABASE <suite_name>
 *   2. prisma migrate deploy
 *   3. Inject suite URL into host process.env AND Jest VM this.global.process.env
 *   4. On teardown: terminate connections, drop DB, restore exact previous env
 *
 * Cleanup failures are promoted to suite failures (not silently swallowed).
 */
import NodeEnvironment from "jest-environment-node";
import { execSync } from "child_process";
import * as path from "path";
import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import { extractDatabaseName, maintenanceUrl, replaceDbName, shortHash } from "./e2e-db-config";
import { Client } from "pg";

const BACKEND_DIR = path.resolve(__dirname, "..");

/** Execute a SQL statement against a PostgreSQL database via Node.js pg client. */
async function pgExec(url: string, sql: string): Promise<void> {
  const client = new Client({ connectionString: url, connectionTimeoutMillis: 10_000 });
  try {
    await client.connect();
    await client.query(sql);
  } finally {
    await client.end().catch(() => {});
  }
}

/** Saved env state for exact restoration. */
interface SavedEnv {
  hostDatabaseUrl: string | undefined;
  hostTestDatabaseUrl: string | undefined;
  vmDatabaseUrl: string | undefined;
  vmTestDatabaseUrl: string | undefined;
  hostSuiteDbName: string | undefined;
  vmSuiteDbName: string | undefined;
  hostSuiteHash: string | undefined;
  vmSuiteHash: string | undefined;
}

export default class IsolatedDbEnvironment extends NodeEnvironment {
  private suiteDbName: string | null = null;
  private suiteDbUrl: string | null = null;
  private savedEnv: SavedEnv | null = null;
  private readonly testPath: string;
  private readonly pathHash: string;

  constructor(config: JestEnvironmentConfig, context: EnvironmentContext) {
    super(config, context);
    // EnvironmentContext.testPath is non-optional in the type definition
    this.testPath = context.testPath;
    this.pathHash = shortHash(this.testPath);
  }

  override async setup(): Promise<void> {
    await super.setup();

    const baseTestUrl =
      process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/travelhub1_test";

    const baseName = extractDatabaseName(baseTestUrl);
    if (!baseName) throw new Error(`[e2e-env] Cannot parse DB name from ${baseTestUrl}`);

    // Suite DB name: lowercase ASCII, ≤63 chars, ends with _test
    const prefix = baseName.replace(/_test$/i, "");
    const suiteName = `${prefix}_${this.pathHash}_${process.pid}_test`;
    this.validateDbName(suiteName);

    this.suiteDbName = suiteName;
    this.suiteDbUrl = replaceDbName(baseTestUrl, suiteName);

    // Save exact env state for restoration
    this.savedEnv = {
      hostDatabaseUrl: process.env.DATABASE_URL,
      hostTestDatabaseUrl: process.env.TEST_DATABASE_URL,
      vmDatabaseUrl: this.global.process.env.DATABASE_URL,
      vmTestDatabaseUrl: this.global.process.env.TEST_DATABASE_URL,
      hostSuiteDbName: process.env.E2E_SUITE_DB_NAME,
      vmSuiteDbName: this.global.process.env.E2E_SUITE_DB_NAME,
      hostSuiteHash: process.env.E2E_SUITE_TEST_PATH_HASH,
      vmSuiteHash: this.global.process.env.E2E_SUITE_TEST_PATH_HASH,
    };

    // Create fresh DB + apply migrations via Node.js pg client (no psql binary needed)
    const admin = maintenanceUrl(this.suiteDbUrl);
    const t0 = Date.now();
    this.log(`Creating suite DB "${suiteName}"`);
    await pgExec(admin, `DROP DATABASE IF EXISTS "${suiteName}"`);
    await pgExec(admin, `CREATE DATABASE "${suiteName}"`);
    this.log(`DB created in ${Date.now() - t0}ms`);

    const t1 = Date.now();
    execSync("npx prisma migrate deploy", {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: this.suiteDbUrl, TEST_DATABASE_URL: this.suiteDbUrl },
      timeout: 120_000,
    });
    this.log(`Migrations applied in ${Date.now() - t1}ms`);

    // Inject suite URL into BOTH host and VM scopes
    process.env.DATABASE_URL = this.suiteDbUrl;
    process.env.TEST_DATABASE_URL = this.suiteDbUrl;
    process.env.E2E_SUITE_DB_NAME = suiteName;
    process.env.E2E_SUITE_TEST_PATH_HASH = this.pathHash;
    this.global.process.env.DATABASE_URL = this.suiteDbUrl;
    this.global.process.env.TEST_DATABASE_URL = this.suiteDbUrl;
    this.global.process.env.E2E_SUITE_DB_NAME = suiteName;
    this.global.process.env.E2E_SUITE_TEST_PATH_HASH = this.pathHash;

    this.log(`Suite DB ready: ${suiteName}`);
  }

  override async teardown(): Promise<void> {
    // 1. Terminate connections + drop suite DB (capture error for authoritative cleanup)
    let cleanupError: Error | null = null;
    if (this.suiteDbName && this.suiteDbUrl) {
      this.log(`Dropping suite DB "${this.suiteDbName}"`);
      try {
        const admin = maintenanceUrl(this.suiteDbUrl);
        // Terminate connections via maintenance DB (postgres) — never via suite DB
        // which would kill our own connection.
        await pgExec(admin, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.suiteDbName}' AND pid != pg_backend_pid()`).catch(() => {});
        await pgExec(admin, `DROP DATABASE IF EXISTS "${this.suiteDbName}"`);
        this.log(`Suite DB "${this.suiteDbName}" dropped successfully`);
      } catch (err) {
        cleanupError = new Error(`Failed to drop suite DB "${this.suiteDbName}": ${(err as Error).message}`);
        this.log(`ERROR: ${cleanupError.message}`);
      }
    }

    // 2. Restore exact previous env state
    if (this.savedEnv) {
      this.restoreEnv("DATABASE_URL", this.savedEnv.hostDatabaseUrl, this.savedEnv.vmDatabaseUrl);
      this.restoreEnv("TEST_DATABASE_URL", this.savedEnv.hostTestDatabaseUrl, this.savedEnv.vmTestDatabaseUrl);
      this.restoreEnv("E2E_SUITE_DB_NAME", this.savedEnv.hostSuiteDbName, this.savedEnv.vmSuiteDbName);
      this.restoreEnv("E2E_SUITE_TEST_PATH_HASH", this.savedEnv.hostSuiteHash, this.savedEnv.vmSuiteHash);
    }

    // 3. Always call super.teardown()
    await super.teardown();

    // 4. Promote cleanup failure AFTER environment teardown
    if (cleanupError) {
      throw cleanupError;
    }
  }

  private restoreEnv(key: string, hostVal: string | undefined, vmVal: string | undefined): void {
    if (hostVal === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = hostVal;
    }
    if (vmVal === undefined) {
      delete this.global.process.env[key];
    } else {
      this.global.process.env[key] = vmVal;
    }
  }

  private validateDbName(name: string): void {
    // PostgreSQL identifier limit is 63 bytes
    if (name.length > 63) {
      throw new Error(`[e2e-env] Suite DB name "${name}" exceeds 63 characters (${name.length})`);
    }
    // Must contain only lowercase ASCII letters, digits, underscores
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error(`[e2e-env] Suite DB name "${name}" contains invalid characters (only lowercase ASCII, digits, _ allowed)`);
    }
    // Must end with _test
    if (!/test$/.test(name)) {
      throw new Error(`[e2e-env] Suite DB name "${name}" does not end with "_test"`);
    }
    // Must not match common dangerous names
    const forbidden = ["postgres", "template0", "template1", "travelhub1", "travelhub1_test"];
    if (forbidden.includes(name)) {
      throw new Error(`[e2e-env] Suite DB name "${name}" matches a protected name`);
    }
  }

  private async pgExec(url: string, sql: string): Promise<void> {
    await pgExec(url, sql);
  }

  private log(msg: string): void {
    process.stdout.write(`[e2e-env] ${msg}\n`);
  }
}
