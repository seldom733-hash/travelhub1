/**
 * Jest custom TestEnvironment for per-suite PostgreSQL database isolation.
 *
 * Strategy: template-based isolation
 *   1. globalSetup creates base DB with migrations, then creates a template DB
 *   2. Each suite CREATEs its DB from the template (instant, no migrations)
 *   3. Teardown drops the suite DB
 *
 * This keeps per-suite isolation while avoiding 76×60 migration overhead.
 */
import NodeEnvironment from "jest-environment-node";
import * as path from "path";
import type { EnvironmentContext, JestEnvironmentConfig } from "@jest/environment";
import { Client } from "pg";
import { extractDatabaseName, maintenanceUrl, replaceDbName, shortHash } from "./e2e-db-config";

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

    // Create suite DB from template (instant — no migrations needed)
    const admin = maintenanceUrl(this.suiteDbUrl);
    const t0 = Date.now();
    this.log(`Creating suite DB "${suiteName}" from template "${TEMPLATE_DB_NAME}"`);
    await pgExec(admin, `DROP DATABASE IF EXISTS "${suiteName}"`);
    await pgExec(admin, `CREATE DATABASE "${suiteName}" TEMPLATE "${TEMPLATE_DB_NAME}"`);
    this.log(`DB created from template in ${Date.now() - t0}ms`);

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
    let cleanupError: Error | null = null;
    if (this.suiteDbName && this.suiteDbUrl) {
      this.log(`Dropping suite DB "${this.suiteDbName}"`);
      try {
        const admin = maintenanceUrl(this.suiteDbUrl);
        await pgExec(
          admin,
          `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.suiteDbName}' AND pid != pg_backend_pid()`,
        ).catch(() => {});
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
      this.restoreEnv(
        "E2E_SUITE_TEST_PATH_HASH",
        this.savedEnv.hostSuiteHash,
        this.savedEnv.vmSuiteHash,
      );
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
    if (name.length > 63) {
      throw new Error(`[e2e-env] Suite DB name "${name}" exceeds 63 characters (${name.length})`);
    }
    if (!/^[a-z0-9_]+$/.test(name)) {
      throw new Error(
        `[e2e-env] Suite DB name "${name}" contains invalid characters (only lowercase ASCII, digits, _ allowed)`,
      );
    }
    if (!/test$/.test(name)) {
      throw new Error(`[e2e-env] Suite DB name "${name}" does not end with "_test"`);
    }
    const forbidden = ["postgres", "template0", "template1", "travelhub1", "travelhub1_test"];
    if (forbidden.includes(name)) {
      throw new Error(`[e2e-env] Suite DB name "${name}" matches a protected name`);
    }
  }

  private log(msg: string): void {
    process.stdout.write(`[e2e-env] ${msg}\n`);
  }
}
