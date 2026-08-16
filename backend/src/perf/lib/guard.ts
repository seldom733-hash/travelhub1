/**
 * Step 2.17B — safe-target guard (CRITICAL, fail-closed).
 *
 * The harness must refuse obvious production targets by default:
 *  - NODE_ENV=production → refuse (production load is forbidden this pass);
 *  - DATABASE_URL pointing at a non-local host → refuse unless --allow-non-local;
 *  - database name that is protected/canonical (postgres, template*, *prod*,
 *    canonical dev `travelhub1`) → refuse ALWAYS (cleanup safety);
 *  - STRESS profile without explicit opt-in (--stress) → refuse;
 *  - malformed DATABASE_URL → refuse.
 *
 * The guard runs BEFORE any seed/load action.
 */

export const PROTECTED_DB_NAMES = new Set(["postgres", "template0", "template1"]);

export const CANONICAL_DEV_DB_NAMES = new Set(["travelhub1"]);

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

export interface GuardInput {
  dbUrl?: string;
  nodeEnv?: string;
  allowNonLocal?: boolean;
  stress?: boolean;
  profile?: string;
  remoteBaseUrl?: string;
}

/** Extract the database name from a postgresql:// URL. Returns null if unparseable. */
export function extractDbName(url: string): string | null {
  const m = url.match(/\/\/([^/]+)\/([^/?]+)(?:\?|$)/);
  return m ? m[2] : null;
}

/** Extract the host from a postgresql:// URL. Returns null if unparseable. */
export function extractDbHost(url: string): string | null {
  const m = url.match(/\/\/([^/@]+)@([^/:]+)(?::\d+)?\//);
  if (m) return m[2];
  const m2 = url.match(/\/\/([^/:@]+)(?::\d+)?\//);
  return m2 ? m2[1] : null;
}

export function isProductionLikeDbName(name: string): boolean {
  return /_prod\b|_production\b|-prod\b|_prod$/i.test(name) || name === "production";
}

export function isProtectedDbName(name: string): boolean {
  return PROTECTED_DB_NAMES.has(name) || CANONICAL_DEV_DB_NAMES.has(name) || isProductionLikeDbName(name);
}

/**
 * Return the list of guard violations. Empty array = safe to proceed.
 * Caller MUST refuse execution when the array is non-empty.
 */
export function guardViolations(input: GuardInput): string[] {
  const violations: string[] = [];

  // Production environment is unconditionally refused this pass.
  const nodeEnv = (input.nodeEnv ?? "").toLowerCase();
  if (nodeEnv === "production") {
    violations.push("NODE_ENV=production — production load is forbidden in this pass");
  }

  // Stress profile requires explicit opt-in.
  if (input.profile === "stress" && !input.stress) {
    violations.push("profile=stress requires explicit --stress opt-in");
  }

  // Remote base URL must be local unless explicitly acknowledged.
  if (input.remoteBaseUrl && !input.remoteBaseUrl.startsWith("http://127.0.0.1") && !input.remoteBaseUrl.startsWith("http://localhost")) {
    if (!input.allowNonLocal) {
      violations.push(`remote base URL '${input.remoteBaseUrl}' is non-local — requires --allow-non-local`);
    }
  }

  // Database safety.
  if (input.dbUrl) {
    const url = input.dbUrl.trim();
    if (!url.startsWith("postgresql://") && !url.startsWith("postgres://")) {
      violations.push("DATABASE_URL must be a postgresql:// URL");
    } else {
      const dbName = extractDbName(url);
      if (!dbName) {
        violations.push("Cannot parse database name from DATABASE_URL");
      } else if (isProtectedDbName(dbName)) {
        violations.push(`database '${dbName}' is protected/canonical — harness never touches it`);
      }
      const host = extractDbHost(url);
      if (host && !LOCAL_HOSTS.has(host)) {
        if (!input.allowNonLocal) {
          violations.push(`database host '${host}' is non-local — requires --allow-non-local`);
        }
      }
    }
  }

  return violations;
}
