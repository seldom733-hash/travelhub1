/**
 * Step 2.17B — profile registry + fail-closed CLI configuration.
 *
 * All numeric profile values are EXPLORATORY / HARNESS VALIDATION PROFILES.
 * They are NOT production SLOs and NOT production capacity targets.
 * Qualification profiles (qual-*) resolve from the frozen authority manifest
 * (lib/qualification.ts). Malformed configuration fails closed (exit non-zero,
 * no run).
 */

import { QUALIFICATION, DATASET_CLASSES, resolveQualificationProfile, type DatasetClass } from "./qualification";

export type ProfileName =
  | "smoke"
  | "baseline"
  | "steady"
  | "peak"
  | "burst"
  | "soak"
  | "stress"
  | "qual-steady"
  | "qual-peak"
  | "qual-burst"
  | "qual-soak"
  | "paycreate"
  | "payment-steady"
  | "payment-burst"
  | "payment-concurrency"
  | "booking-order-steady"
  | "booking-order-burst"
  | "login-qualification"
  | "login-burst"
  | "eventbus-steady"
  | "eventbus-burst"
  | "eventbus-recovery"
  | "multi-instance";

export type ProfileKind = "load" | "paycreate" | "payment" | "booking" | "login" | "eventbus" | "multi";

export interface LoadProfile {
  kind: "load";
  name: ProfileName;
  description: string;
  /** Default pacing rate (0 = max-effort). CLI --rps overrides. */
  rps: number;
  durationMs: number;
  warmupMs: number;
  concurrency: number;
  /** Request templates: method/path/auth/expected statuses/route class. */
  steps: Array<{
    label: string;
    method: "GET" | "POST";
    path: string;
    /** public | admin | sm | fin | login */
    auth: "public" | "admin" | "sm" | "fin" | "login";
    expected: number[];
    /** Approved route class A–F for class-level metrics. */
    routeClass: "A" | "B" | "C" | "D" | "E" | "F";
    body?: () => Record<string, unknown>;
  }>;
}

export interface SpecialProfile {
  kind: "paycreate" | "payment" | "booking" | "login" | "eventbus" | "multi";
  name: ProfileName;
  description: string;
  durationMs?: number;
}

export type Profile = LoadProfile | SpecialProfile;

const load = (p: Omit<LoadProfile, "kind">): LoadProfile => ({ kind: "load", ...p });

const qSteady = resolveQualificationProfile("steady");
const qPeak = resolveQualificationProfile("peak");
const qBurst = resolveQualificationProfile("burst");
const qSoak = resolveQualificationProfile("soak");

export const PROFILES: Record<ProfileName, Profile> = {
  smoke: load({
    name: "smoke",
    description: "Harness correctness smoke — tiny load, fast",
    rps: 0,
    durationMs: 5_000,
    warmupMs: 500,
    concurrency: 2,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
    ],
  }),
  baseline: load({
    name: "baseline",
    description: "Representative single-scenario reference",
    rps: 0,
    durationMs: 10_000,
    warmupMs: 1_000,
    concurrency: 5,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200], routeClass: "B" },
      { label: "crm.customers", method: "GET", path: "/api/v1/customers", auth: "admin", expected: [200], routeClass: "B" },
    ],
  }),
  steady: load({
    name: "steady",
    description: "Sustained mixed workload (exploratory)",
    rps: 0,
    durationMs: 15_000,
    warmupMs: 1_500,
    concurrency: 10,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200], routeClass: "B" },
      { label: "finance.ledger", method: "GET", path: "/api/v1/finance/ledger-transactions", auth: "fin", expected: [200], routeClass: "B" },
    ],
  }),
  peak: load({
    name: "peak",
    description: "Expected-peak mix (exploratory)",
    rps: 0,
    durationMs: 10_000,
    warmupMs: 1_000,
    concurrency: 25,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
    ],
  }),
  burst: load({
    name: "burst",
    description: "Short high-intensity spike (exploratory)",
    rps: 0,
    durationMs: 5_000,
    warmupMs: 500,
    concurrency: 40,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
    ],
  }),
  soak: load({
    name: "soak",
    description: "Short exploratory soak (NOT production endurance qualification)",
    rps: 0,
    durationMs: 60_000,
    warmupMs: 2_000,
    concurrency: 10,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
    ],
  }),
  stress: load({
    name: "stress",
    description: "Controlled ramp to saturation (opt-in, bounded, characterization only)",
    rps: 0,
    durationMs: 15_000,
    warmupMs: 1_000,
    concurrency: 60,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
    ],
  }),
  "qual-steady": load({
    name: "qual-steady",
    description: "FINAL QUALIFICATION steady — 15 min @ 50 RPS (frozen authority)",
    rps: qSteady.rps,
    durationMs: qSteady.durationMs,
    warmupMs: qSteady.warmupMs,
    concurrency: qSteady.concurrency,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200], routeClass: "B" },
      { label: "finance.ledger", method: "GET", path: "/api/v1/finance/ledger-transactions", auth: "fin", expected: [200], routeClass: "B" },
      { label: "crm.customers", method: "GET", path: "/api/v1/customers", auth: "admin", expected: [200], routeClass: "B" },
    ],
  }),
  "qual-peak": load({
    name: "qual-peak",
    description: "FINAL QUALIFICATION peak — 15 min @ 100 RPS (frozen authority)",
    rps: qPeak.rps,
    durationMs: qPeak.durationMs,
    warmupMs: qPeak.warmupMs,
    concurrency: qPeak.concurrency,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "public.categories", method: "GET", path: "/api/v1/public/categories", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
      { label: "sales.quotes", method: "GET", path: "/api/v1/sales/quotes", auth: "sm", expected: [200], routeClass: "B" },
      { label: "finance.ledger", method: "GET", path: "/api/v1/finance/ledger-transactions", auth: "fin", expected: [200], routeClass: "B" },
    ],
  }),
  "qual-burst": load({
    name: "qual-burst",
    description: "FINAL QUALIFICATION burst — 60 s @ 200 RPS (frozen authority)",
    rps: qBurst.rps,
    durationMs: qBurst.durationMs,
    warmupMs: 10_000,
    concurrency: qBurst.concurrency,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
    ],
  }),
  "qual-soak": load({
    name: "qual-soak",
    description: "FINAL QUALIFICATION soak — 30 min @ 50 RPS / 250 (frozen authority)",
    rps: qSoak.rps,
    durationMs: qSoak.durationMs,
    warmupMs: qSoak.warmupMs,
    concurrency: qSoak.concurrency,
    steps: [
      { label: "public.products", method: "GET", path: "/api/v1/public/products?limit=5", auth: "public", expected: [200], routeClass: "A" },
      { label: "auth.session", method: "GET", path: "/api/v1/auth/session", auth: "public", expected: [200], routeClass: "A" },
      { label: "sales.list", method: "GET", path: "/api/v1/sales/sales", auth: "sm", expected: [200], routeClass: "B" },
      { label: "finance.ledger", method: "GET", path: "/api/v1/finance/ledger-transactions", auth: "fin", expected: [200], routeClass: "B" },
    ],
  }),
  paycreate: {
    kind: "paycreate",
    name: "paycreate",
    description: "payment.create — external idempotency concurrency scenario (one-shot)",
  },
  "payment-steady": {
    kind: "payment",
    name: "payment-steady",
    description: "payment.create paced steady — 2 RPS (frozen authority)",
    durationMs: 60_000,
  },
  "payment-burst": {
    kind: "payment",
    name: "payment-burst",
    description: "payment.create paced burst — 10 RPS (frozen authority)",
    durationMs: 20_000,
  },
  "payment-concurrency": {
    kind: "payment",
    name: "payment-concurrency",
    description: "payment.create concurrency ceiling — 50 concurrent (frozen authority)",
    durationMs: 30_000,
  },
  "booking-order-steady": {
    kind: "booking",
    name: "booking-order-steady",
    description: "Booking/Order chain paced steady — 6 orders/s (frozen authority)",
    durationMs: 60_000,
  },
  "booking-order-burst": {
    kind: "booking",
    name: "booking-order-burst",
    description: "Booking/Order chain paced burst — 20 orders/s (frozen authority)",
    durationMs: 15_000,
  },
  "login-qualification": {
    kind: "login",
    name: "login-qualification",
    description: "auth/login paced — 2 RPS (frozen authority)",
    durationMs: 60_000,
  },
  "login-burst": {
    kind: "login",
    name: "login-burst",
    description: "auth/login paced burst — 5 RPS (frozen authority)",
    durationMs: 20_000,
  },
  "eventbus-steady": {
    kind: "eventbus",
    name: "eventbus-steady",
    description: "EventBus generation-under-processing — 100 events/s (frozen authority)",
    durationMs: 30_000,
  },
  "eventbus-burst": {
    kind: "eventbus",
    name: "eventbus-burst",
    description: "EventBus burst — configurable seed (default 1,000, frozen authority)",
    durationMs: 30_000,
  },
  "eventbus-recovery": {
    kind: "eventbus",
    name: "eventbus-recovery",
    description: "EventBus recovery — 5,000 backlog / 2 workers / canonical config (frozen authority)",
  },
  "multi-instance": {
    kind: "multi",
    name: "multi-instance",
    description: "2 app + 2 worker HTTP topology with shared PostgreSQL (frozen authority)",
    durationMs: 60_000,
  },
};

export const PROFILE_NAMES = Object.keys(PROFILES) as ProfileName[];

export interface RunConfig {
  profile: ProfileName;
  runId: string;
  outDir: string;
  dbUrl?: string;
  /** Overrides — undefined means «use the profile default» (resolved in run.ts). */
  concurrency?: number;
  durationMs?: number;
  warmupMs?: number;
  targetRps?: number;
  dataset: DatasetClass;
  datasetScale: number;
  apps: number;
  workers: number;
  seedEvents: number;
  finalMode: boolean;
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
  "--rps",
  "--dataset",
  "--dataset-scale",
  "--apps",
  "--workers",
  "--seed-events",
  "--request-timeout",
  "--drain-timeout",
  "--seed",
  "--final",
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

function parseNonNegative(name: string, raw: string | undefined, def: number): number {
  if (raw === undefined) return def;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${name} must be a non-negative number, got '${raw}'`);
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
    if (name === "--allow-non-local" || name === "--stress" || name === "--final") {
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
    return {
      ok: true,
      config: {
        profile: "smoke",
        runId: "help",
        outDir: "artifacts/performance/help",
        concurrency: undefined,
        durationMs: undefined,
        warmupMs: undefined,
        dataset: "SMALL",
        datasetScale: 1,
        apps: 1,
        workers: 0,
        seedEvents: 250,
        finalMode: false,
        allowNonLocal: false,
        stress: false,
        requestTimeoutMs: 10_000,
        drainTimeoutMs: 180_000,
        seed: 1,
      },
    };
  }

  const profile = (values["--profile"] ?? "smoke") as ProfileName;
  if (!PROFILE_NAMES.includes(profile)) {
    errors.push(`unknown profile '${profile}' — allowed: ${PROFILE_NAMES.join(", ")}`);
  }

  const datasetRaw = (values["--dataset"] ?? "SMALL").toUpperCase();
  if (!DATASET_CLASSES.includes(datasetRaw as DatasetClass)) {
    errors.push(`unknown dataset '${datasetRaw}' — allowed: ${DATASET_CLASSES.join(", ")}`);
  }

  try {
    // Duration/concurrency/warm-up are profile-aware: undefined here means
    // «use the profile default» — resolved in run.ts against the profile.
    const concurrency = values["--concurrency"] !== undefined ? parsePositiveInt("--concurrency", values["--concurrency"], 1) : undefined;
    const durationMs = values["--duration"] !== undefined ? parsePositiveInt("--duration", values["--duration"], 1) : undefined;
    const warmupMs = values["--warmup"] !== undefined ? parseNonNegative("--warmup", values["--warmup"], 0) : undefined;
    const targetRps = values["--rps"] !== undefined ? parsePositiveInt("--rps", values["--rps"], 1) : undefined;
    const datasetScale = parseNonNegative("--dataset-scale", values["--dataset-scale"], 1);
    if (datasetScale <= 0 || datasetScale > 1) {
      errors.push("--dataset-scale must be in (0, 1]");
    }
    const apps = parsePositiveInt("--apps", values["--apps"], 1);
    const workers = parsePositiveInt("--workers", values["--workers"], 0);
    const seedEvents = parsePositiveInt("--seed-events", values["--seed-events"], 250);
    const requestTimeoutMs = parsePositiveInt("--request-timeout", values["--request-timeout"], 10_000);
    const drainTimeoutMs = parsePositiveInt("--drain-timeout", values["--drain-timeout"], 180_000);
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
        warmupMs,
        targetRps,
        dataset: datasetRaw as DatasetClass,
        datasetScale,
        apps,
        workers,
        seedEvents,
        finalMode: flags.has("--final"),
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
    "  --concurrency=<n>        concurrency ceiling override",
    "  --duration=<ms>          duration override (load/scenario profiles)",
    "  --warmup=<ms>            warm-up duration (paced at target rate; default 1000)",
    "  --rps=<n>                target arrival rate for paced load (0/max-effort otherwise)",
    "  --dataset=<CLASS>        SMALL | REPRESENTATIVE | STRESS (default SMALL)",
    "  --dataset-scale=<0..1>   scale factor for dataset counts (validation aid)",
    "  --apps=<n>               application instances (multi-instance topology)",
    "  --workers=<n>            worker instances (multi-instance / EventBus recovery)",
    "  --seed-events=<n>        EventBus burst/recovery seed count (default 250)",
    "  --final                  final qualification mode (fail-closed validation)",
    "  --request-timeout=<ms>   per-request timeout (default 10000)",
    "  --drain-timeout=<ms>     EventBus drain bound (default 180000)",
    "  --seed=<n>               deterministic seed (default 1)",
    "  --allow-non-local        acknowledge non-local DB/base URL",
    "  --stress                 explicit opt-in for the stress profile",
    "",
    "All numeric profiles are EXPLORATORY — NOT production SLOs, NOT capacity targets.",
    `Frozen qualification targets: ${QUALIFICATION.steady.rps}/${QUALIFICATION.peak.rps}/${QUALIFICATION.burst.rps} RPS, warm-up ${QUALIFICATION.warmupMs / 60000} min, soak ${QUALIFICATION.soak.durationMs / 60000} min @ ${QUALIFICATION.soak.rps} RPS.`,
  ].join("\n");
}
