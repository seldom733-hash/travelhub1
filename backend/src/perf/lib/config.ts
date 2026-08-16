/**
 * Step 2.17B — profile registry + fail-closed CLI configuration.
 *
 * All numeric profile values are EXPLORATORY / HARNESS VALIDATION PROFILES.
 * They are NOT production SLOs and NOT production capacity targets.
 * Malformed configuration fails closed (exit non-zero, no run).
 */

export type ProfileName =
  | "smoke"
  | "baseline"
  | "steady"
  | "peak"
  | "burst"
  | "soak"
  | "stress"
  | "paycreate"
  | "eventbus-recovery";

export type ProfileKind = "load" | "paycreate" | "eventbus";

export interface LoadProfile {
  kind: "load";
  name: ProfileName;
  description: string;
  durationMs: number;
  warmupMs: number;
  concurrency: number;
  /** Request templates: method/path/auth/expected statuses. */
  steps: Array<{
    label: string;
    method: "GET" | "POST";
    path: string;
    /** public | admin | sm | fin | login */
    auth: "public" | "admin" | "sm" | "fin" | "login";
    expected: number[];
    /** optional body factory (e.g. login credentials) */
    body?: () => Record<string, unknown>;
  }>;
}

export interface SpecialProfile {
  kind: "paycreate" | "eventbus";
  name: ProfileName;
  description: string;
  durationMs?: number;
}

export type Profile = LoadProfile | SpecialProfile;

const load = (p: Omit<LoadProfile, "kind">): LoadProfile => ({ kind: "load", ...p });

export const PROFILES: Record<ProfileName, Profile> = {
  smoke: load({
    name: "smoke",
    description: "Harness correctness smoke — tiny load, fast",
    durationMs: 5_000,
    warmupMs: 500,
    concurrency: 2,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200] },
    ],
  }),
  baseline: load({
    name: "baseline",
    description: "Representative single-scenario reference",
    durationMs: 10_000,
    warmupMs: 1_000,
    concurrency: 5,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200] },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200] },
      { label: "crm.customers", method: "GET", path: "/api/v1/customers", auth: "admin", expected: [200] },
    ],
  }),
  steady: load({
    name: "steady",
    description: "Sustained mixed workload",
    durationMs: 15_000,
    warmupMs: 1_500,
    concurrency: 10,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200] },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200] },
      { label: "finance.ledger", method: "GET", path: "/api/v1/finance/ledger-transactions", auth: "fin", expected: [200] },
    ],
  }),
  peak: load({
    name: "peak",
    description: "Expected-peak mix (exploratory)",
    durationMs: 10_000,
    warmupMs: 1_000,
    concurrency: 25,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200] },
    ],
  }),
  burst: load({
    name: "burst",
    description: "Short high-intensity spike",
    durationMs: 5_000,
    warmupMs: 500,
    concurrency: 40,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
    ],
  }),
  soak: load({
    name: "soak",
    description: "Short exploratory soak (NOT production endurance qualification)",
    durationMs: 60_000,
    warmupMs: 2_000,
    concurrency: 10,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200] },
    ],
  }),
  stress: load({
    name: "stress",
    description: "Controlled ramp to saturation (opt-in, bounded)",
    durationMs: 15_000,
    warmupMs: 1_000,
    concurrency: 60,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200] },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200] },
    ],
  }),
  paycreate: {
    kind: "paycreate",
    name: "paycreate",
    description: "payment.create — external idempotency concurrency scenario",
  },
  "eventbus-recovery": {
    kind: "eventbus",
    name: "eventbus-recovery",
    description: "EventBus burst PENDING → worker recovery drain + multi-instance",
  },
};

export const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[];

export interface RunConfig {
  profile: ProfileName;
  runId: string;
  outDir: string;
  dbUrl?: string;
  concurrency?: number;
  durationMs?: number;
  allowNonLocal: boolean;
  stress: boolean;
  requestTimeoutMs: number;
  drainTimeoutMs: number;
  seed: number;
}

export interface ParseResult {
  ok: true;
  config: RunConfig;
}

export interface ParseFailure {
  ok: false;
  errors: string[];
}

const KNOWN_FLAGS = new Set([
  "--profile",
  "--run-id",
  "--out",
  "--db-url",
  "--concurrency",
  "--duration",
  "--warmup",
  "--request-timeout",
  "--drain-timeout",
  "--seed",
  "--allow-non-local",
  "--stress",
  "--help",
]);

function parsePositiveInt(name: string, raw: string | undefined, def: number): number {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error(`${name} must be a positive integer, got '${raw}'`);
  }
  return n;
}

export function parseArgs(argv: string[]): ParseResult | ParseFailure {
  const errors: string[] = [];
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      errors.push(`unexpected positional argument '${arg}'`);
      continue;
    }
    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    if (!KNOWN_FLAGS.has(name)) {
      errors.push(`unknown flag '${name}'`);
      continue;
    }
    if (name === "--help") {
      flags.add(name);
      continue;
    }
    if (name === "--allow-non-local" || name === "--stress") {
      if (eq !== -1) {
        errors.push(`${name} is a boolean flag and takes no value`);
      } else {
        flags.add(name);
      }
      continue;
    }
    let value: string | undefined;
    if (eq !== -1) {
      value = arg.slice(eq + 1);
    } else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) {
      value = argv[++i];
    }
    if (value === undefined || value.trim() === "") {
      errors.push(`${name} requires a value`);
      continue;
    }
    values[name] = value;
  }

  if (flags.has("--help")) {
    // Help is handled by the caller; return a minimal valid shape.
    return {
      ok: true,
      config: {
        profile: "smoke",
        runId: "help",
        outDir: "artifacts/performance/help",
        allowNonLocal: false,
        stress: false,
        requestTimeoutMs: 10_000,
        drainTimeoutMs: 90_000,
        seed: 1,
      },
    };
  }

  const profile = (values["--profile"] ?? "smoke") as ProfileName;
  if (!PROFILE_NAMES.includes(profile)) {
    errors.push(`unknown profile '${profile}' — allowed: ${PROFILE_NAMES.join(", ")}`);
  }

  try {
    const concurrency = parsePositiveInt("--concurrency", values["--concurrency"], 5);
    const durationMs = parsePositiveInt("--duration", values["--duration"], 10_000);
    const requestTimeoutMs = parsePositiveInt("--request-timeout", values["--request-timeout"], 10_000);
    const drainTimeoutMs = parsePositiveInt("--drain-timeout", values["--drain-timeout"], 90_000);
    const seed = parsePositiveInt("--seed", values["--seed"], 1);
    const runId = values["--run-id"] ?? defaultRunId();
    const outDir = values["--out"] ?? `artifacts/performance/${runId}`;
    if (errors.length > 0) return { ok: false, errors };
    return {
      ok: true,
      config: {
        profile,
        runId,
        outDir,
        dbUrl: values["--db-url"],
        concurrency,
        durationMs,
        allowNonLocal: flags.has("--allow-non-local"),
        stress: flags.has("--stress"),
        requestTimeoutMs,
        drainTimeoutMs,
        seed,
      },
    };
  } catch (err) {
    errors.push(String((err as Error)?.message ?? err));
    return { ok: false, errors };
  }
}

export function defaultRunId(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const ts = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.random().toString(36).slice(2, 8);
  return `perf-${ts}-${rand}`;
}

export function usage(): string {
  return [
    "Usage: ts-node src/perf/run.ts --profile=<name> [options]",
    "",
    `Profiles: ${PROFILE_NAMES.join(", ")}`,
    "",
    "Options:",
    "  --run-id=<id>            run identifier (default: perf-<timestamp>-<rand>)",
    "  --out=<dir>              result directory (default: artifacts/performance/<run-id>)",
    "  --db-url=<url>           DATABASE_URL override (default: env DATABASE_URL)",
    "  --concurrency=<n>        concurrency override (load profiles)",
    "  --duration=<ms>          duration override (load profiles)",
    "  --request-timeout=<ms>   per-request timeout (default 10000)",
    "  --drain-timeout=<ms>     EventBus drain bound (default 90000)",
    "  --seed=<n>               deterministic seed (default 1)",
    "  --allow-non-local        acknowledge non-local DB/base URL",
    "  --stress                 explicit opt-in for the stress profile",
    "",
    "All numeric profiles are EXPLORATORY — NOT production SLOs, NOT capacity targets.",
  ].join("\n");
}
