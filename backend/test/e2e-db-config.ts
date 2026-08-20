/**
 * E2E test database configuration — shared by globalSetup (DB prepare + migrations)
 * and setupFiles (env injection into every spec worker).
 *
 * SAFETY (Step 1.0 requirement):
 *  - e2e ALWAYS runs against an isolated test database;
 *  - the database NAME MUST END WITH "test" (suffix rule, e.g. `travelhub1_test`)
 *    — otherwise we refuse to start. A substring check would accidentally admit
 *    names like "contest"/"latest"; the suffix rule cannot.
 *    This makes it impossible to run destructive e2e against the dev/prod
 *    database (`travelhub1` does not end with "test" and is rejected).
 */

const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travelhub1_test";
/** Dev database — e2e must NEVER touch it. */
const DEV_DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/travelhub1";

/**
 * Resolve the test database URL to use for e2e.
 * Priority: TEST_DATABASE_URL env → local default (travelhub1_test).
 * Throws if the resolved URL is unsafe (not a "test"-named database or == dev DB).
 */
export function resolveTestDatabaseUrl(): string {
  const url = (process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL).trim();
  if (url.length === 0) {
    throw new Error("[e2e] TEST_DATABASE_URL is empty — refusing to run e2e without an isolated test DB.");
  }
  assertSafeTestUrl(url);
  return url;
}

/** Extract the database name from a postgresql:// URL. Returns null if unparseable. */
export function extractDatabaseName(url: string): string | null {
  const m = url.match(/\/([^/?]+)(?:\?|$)/);
  return m ? m[1] : null;
}

/** Same credentials/host, but connected to the maintenance "postgres" database. */
export function maintenanceUrl(url: string): string {
  return url.replace(/\/([^/?]+)(?:\?|$)/, "/postgres");
}

/** Replace the database name in a postgresql:// URL. */
export function replaceDbName(url: string, newDbName: string): string {
  return url.replace(/\/([^/?]+)(?:\?|$)/, `/${newDbName}`);
}

/** Short deterministic hash for a string (used for suite DB names). */
export function shortHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    const char = input.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 8);
}

function assertSafeTestUrl(url: string): void {
  if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
    throw new Error(`[e2e] TEST_DATABASE_URL must be a postgresql:// URL, got: ${url}`);
  }
  const dbName = extractDatabaseName(url);
  if (!dbName) {
    throw new Error(`[e2e] Cannot parse database name from TEST_DATABASE_URL: ${url}`);
  }
  if (!/test$/i.test(dbName)) {
    throw new Error(
      `[e2e] Refusing to run: database "${dbName}" does not end with "test". ` +
        `E2E must run against an isolated test DB (e.g. ${DEFAULT_TEST_DATABASE_URL}).`,
    );
  }
  if (url === DEV_DATABASE_URL) {
    throw new Error("[e2e] Refusing to run e2e against the dev database (travelhub1). Use an isolated test DB.");
  }
}
