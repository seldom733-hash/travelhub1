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
import { execFileSync, execSync } from "child_process";
import * as path from "path";
import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import { extractDatabaseName, maintenanceUrl, replaceDbName, shortHash } from "./e2e-db-config";

const BACKEND_DIR = path.resolve(__dirname, "..");
const psql = process.platform === "win32" ? "psql.exe" : "psql";

/**
 * Build psql-friendly env from a postgresql:// URL.
 * psql does NOT parse connection URIs — it needs PGHOST/PGPORT/PGUSER/PGPASSWORD
 * as separate env vars (or .pgpass). CI has no .pgpass, so we must extract them.
 */
function pgEnvFromUrl(url: string): Record<string, string> {
  const parsed = new URL(url);
  return {
    ...process.env,
    PGHOST: parsed.hostname || "localhost",
    PGPORT: parsed.port || "5432",
    PGUSER: parsed.username || "postgres",
    PGPASSWORD: parsed.password || "",
    PGDATABASE: parsed.pathname.replace(/^\//, "") || "postgres",
    PGCONNECT_TIMEOUT: "10",
  };
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

    // Create fresh DB + apply migrations
    const admin = maintenanceUrl(this.suiteDbUrl);
    this.log(`Creating suite DB "${suiteName}"`);
    this.psqlExec(admin, `DROP DATABASE IF EXISTS "${suiteName}" WITH (FORCE)`);
    this.psqlExec(admin, `CREATE DATABASE "${suiteName}"`);

    execSync("npx prisma migrate deploy", {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: this.suiteDbUrl, TEST_DATABASE_URL: this.suiteDbUrl },
      timeout: 60_000,
    });

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
        this.psqlExec(admin, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.suiteDbName}'`);
        this.psqlExec(admin, `DROP DATABASE IF EXISTS "${this.suiteDbName}" WITH (FORCE)`);
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

  private psqlExec(targetUrl: string, sql: string): void {
    // targetUrl is already the maintenance URL (postgres DB);
    // extract PG* env vars from it so psql can authenticate.
    const env = pgEnvFromUrl(targetUrl);
    execFileSync(psql, ["-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: "pipe",
      env,
      timeout: 30_000,
    });
  }

  private log(msg: string): void {
    process.stdout.write(`[e2e-env] ${msg}\n`);
  }
}
