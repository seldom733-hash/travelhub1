/**
 * Jest custom TestEnvironment for per-suite PostgreSQL database isolation.
 *
 * Strategy: CREATE DATABASE + prisma migrate deploy per suite (idempotent, ~2-3s).
 * Combined with require cache reset to prevent NestJS @Global() module leakage.
 */
import NodeEnvironment from "jest-environment-node";
import { execFileSync, execSync } from "child_process";
import * as path from "path";
import type { JestEnvironmentConfig } from "@jest/environment";
import { extractDatabaseName, maintenanceUrl, replaceDbName, shortHash } from "./e2e-db-config";

const BACKEND_DIR = path.resolve(__dirname, "..");
const psql = process.platform === "win32" ? "psql.exe" : "psql";
const PG_ENV = { ...process.env, PGCONNECT_TIMEOUT: "10" };

export default class IsolatedDbEnvironment extends NodeEnvironment {
  private suiteDbName: string | null = null;
  private suiteDbUrl: string | null = null;
  private baseTestUrl: string | null = null;

  constructor(config: JestEnvironmentConfig, context: any) {
    super(config, context);
  }

  override async setup(): Promise<void> {
    await super.setup();

    const baseTestUrl =
      process.env.TEST_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/travelhub1_test";
    this.baseTestUrl = baseTestUrl;

    const baseName = extractDatabaseName(baseTestUrl);
    if (!baseName) throw new Error(`[e2e-env] Cannot parse DB name from ${baseTestUrl}`);

    // Suite DB: <prefix>_<hash>_<pid>_test (must end with _test)
    const testPath = (this as any).testPath ?? "unknown";
    const pathHash = shortHash(testPath);
    const prefix = baseName.replace(/_test$/i, "");
    const suiteName = `${prefix}_${pathHash}_${process.pid}_test`;
    if (!/test$/i.test(suiteName)) {
      throw new Error(`[e2e-env] Suite DB "${suiteName}" does not end with "test"`);
    }
    this.suiteDbName = suiteName;
    this.suiteDbUrl = replaceDbName(baseTestUrl, suiteName);

    const admin = maintenanceUrl(this.suiteDbUrl);

    // 1. Create fresh DB + apply migrations
    this.log(`Creating suite DB "${suiteName}"`);
    this.psqlExec(admin, `DROP DATABASE IF EXISTS "${suiteName}" WITH (FORCE)`);
    this.psqlExec(admin, `CREATE DATABASE "${suiteName}"`);

    execSync("npx prisma migrate deploy", {
      cwd: BACKEND_DIR,
      stdio: "pipe",
      env: { ...process.env, DATABASE_URL: this.suiteDbUrl!, TEST_DATABASE_URL: this.suiteDbUrl! },
      timeout: 60_000,
    });

    // 2. Override env vars BEFORE any import (setupFiles haven't run yet)
    process.env.DATABASE_URL = this.suiteDbUrl!;
    process.env.TEST_DATABASE_URL = this.suiteDbUrl!;
    this.log(`Suite DB ready: ${suiteName}`);
  }

  override async teardown(): Promise<void> {
    // 1. Terminate connections + drop suite DB
    if (this.suiteDbName) {
      this.log(`Dropping suite DB "${this.suiteDbName}"`);
      try {
        const admin = maintenanceUrl(this.suiteDbUrl!);
        this.psqlExec(admin, `SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${this.suiteDbName}'`);
        this.psqlExec(admin, `DROP DATABASE IF EXISTS "${this.suiteDbName}" WITH (FORCE)`);
      } catch (err) {
        this.log(`WARNING: Failed to drop suite DB: ${(err as Error).message}`);
      }
    }

    // 2. Restore base URL
    if (this.baseTestUrl) {
      process.env.DATABASE_URL = this.baseTestUrl;
      process.env.TEST_DATABASE_URL = this.baseTestUrl;
    }

    // 3. Reset require cache for app source modules and NestJS internals.
    // This forces fresh module instantiation for the next suite, preventing
    // @Global() module singleton leakage (Prisma, EventBus, Security).
    // Note: EventBusService now has onModuleDestroy to clear handlers,
    // but the module reference cache still needs clearing for fresh providers.
    for (const key of Object.keys(require.cache)) {
      if (
        key.includes("/src/") ||
        key.includes("/generated/") ||
        (key.includes("/node_modules/@nestjs/") && !key.includes("/common/"))
      ) {
        delete require.cache[key];
      }
    }

    await super.teardown();
  }

  private psqlExec(targetUrl: string, sql: string): void {
    execFileSync(psql, [maintenanceUrl(targetUrl), "-v", "ON_ERROR_STOP=1", "-c", sql], {
      stdio: "pipe",
      env: PG_ENV,
      timeout: 30_000,
    });
  }

  private log(msg: string): void {
    process.stdout.write(`[e2e-env] ${msg}\n`);
  }
}
