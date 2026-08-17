/**
 * Step 2.17B — canonical qualification manifest + fail-closed profile validation.
 *
 * Single machine-readable source for the FROZEN authority matrix (approved by
 * the Quantitative Targets Authority Decision; DO NOT EDIT). Harness profiles
 * and run.ts resolve qualification parameters from here so commands cannot
 * drift from the approved values.
 *
 * Canonical semantic rule:
 *   APPROVED BUSINESS TARGET ≠ OBSERVED HARNESS MEASUREMENT
 *   ≠ VERIFIED CAPABILITY ≠ PRODUCTION CAPACITY CLAIM ≠ FUTURE SCALING TARGET
 */

export const QUALIFICATION = {
  warmupMs: 300_000, // 5 min
  steady: { rps: 50, durationMs: 900_000, concurrency: 500 }, // 15 min @ 50 RPS
  peak: { rps: 100, durationMs: 900_000, concurrency: 500 }, // 15 min @ 100 RPS
  burst: { rps: 200, durationMs: 60_000, concurrency: 1_000 }, // 60 s @ 200 RPS
  soak: { rps: 50, durationMs: 1_800_000, concurrency: 250 }, // 30 min @ 50 RPS / 250
  payment: { steadyRps: 2, burstRps: 10, concurrency: 50 },
  bookingOrder: { steadyRps: 6, burstRps: 20 },
  login: { qualRps: 2, burstRps: 5 },
  eventbus: { steadyPerSec: 100, burst: 1_000, recovery: 5_000, recoveryWorkers: 2 },
  apps: 2,
  workers: 2,
  /**
   * Canonical Step 2.17 worker configuration — never overridden in final mode.
   * Step 2.17B remediation (Workstream A): idle interval reduced 2000 → 500ms.
   * Proven root cause: at 100 ev/s a 2000ms poll creates a sawtooth backlog
   * floor of ~200 (100 ev/s × 2 s) — mathematically unable to pass the frozen
   * gate max backlog ≤100. 500ms ⇒ floor ≤50 with headroom, while idle load is
   * still negligible (2 polls/s). workerBatch unchanged (100).
   */
  canonical: { workerIntervalMs: 500, workerBatch: 100 },
} as const;

export type DatasetClass = "SMALL" | "REPRESENTATIVE" | "STRESS";

export const DATASET_CLASSES: DatasetClass[] = ["SMALL", "REPRESENTATIVE", "STRESS"];

export interface DatasetCounts {
  users: number;
  products: number;
  customers: number;
  quotes: number;
  orderChains: number;
  paymentCapableOrders: number;
  ledger: number;
  eventBusSeed: number;
}

/**
 * Approved REPRESENTATIVE dataset (authority §19). SMALL is a deterministic
 * tiny slice; STRESS scales the envelope up for characterization. All counts
 * are synthetic, run-prefixed and dependency-tracked — never production data.
 */
export function datasetCountsFor(cls: DatasetClass, scale = 1): DatasetCounts {
  const s = Math.max(0.01, Math.min(1, scale));
  const mul = (n: number): number => Math.max(1, Math.round(n * s));
  switch (cls) {
    case "SMALL":
      return { users: 8, products: 6, customers: 10, quotes: 8, orderChains: 8, paymentCapableOrders: 8, ledger: 20, eventBusSeed: 30 };
    case "REPRESENTATIVE":
      return {
        users: mul(1_000),
        products: mul(500),
        customers: mul(1_000),
        quotes: mul(1_000),
        orderChains: mul(1_000),
        paymentCapableOrders: mul(500),
        ledger: mul(5_000),
        eventBusSeed: mul(5_000),
      };
    case "STRESS":
      return {
        users: mul(5_000),
        products: mul(2_500),
        customers: mul(5_000),
        quotes: mul(5_000),
        orderChains: mul(5_000),
        paymentCapableOrders: mul(2_500),
        ledger: mul(25_000),
        eventBusSeed: mul(10_000),
      };
  }
}

export interface FinalConfigInput {
  finalMode: boolean;
  profile: string;
  targetRps?: number;
  /** Undefined = resolve from the profile default in run.ts. */
  durationMs?: number;
  concurrency?: number;
  warmupMs?: number;
  dataset: string;
  apps: number;
  workers: number;
  workerIntervalEnv?: string;
  workerBatchEnv?: string;
  pspEnvVars: Array<{ name: string; value?: string }>;
}

export interface FinalValidationIssue {
  code: string;
  message: string;
}

/**
 * Fail-closed validation of a final-mode qualification configuration.
 * Any issue → refuse to run (exit non-zero, no seed/load).
 */
export function validateQualificationConfig(input: FinalConfigInput): FinalValidationIssue[] {
  const issues: FinalValidationIssue[] = [];
  if (!input.finalMode) return issues; // exploratory mode: exploratory rules only

  if (input.targetRps !== undefined && input.targetRps <= 0) {
    issues.push({ code: "RPS", message: "final mode requires --rps > 0" });
  }
  if (input.durationMs !== undefined && input.durationMs <= 0) {
    issues.push({ code: "DURATION", message: "final mode requires --duration > 0" });
  }
  if (input.concurrency !== undefined && input.concurrency <= 0) {
    issues.push({ code: "CONCURRENCY", message: "final mode requires --concurrency > 0" });
  }
  if (!DATASET_CLASSES.includes(input.dataset as DatasetClass)) {
    issues.push({ code: "DATASET", message: `final mode requires --dataset ∈ {${DATASET_CLASSES.join(", ")}}, got '${input.dataset}'` });
  }
  // Topology: the approved qualification matrix is 2 app + 2 worker instances.
  if (input.apps !== QUALIFICATION.apps) {
    issues.push({ code: "APPS", message: `final mode requires ${QUALIFICATION.apps} application instances, got ${input.apps}` });
  }
  if (input.workers !== QUALIFICATION.workers) {
    issues.push({ code: "WORKERS", message: `final mode requires ${QUALIFICATION.workers} worker instances, got ${input.workers}` });
  }
  // Canonical worker timing: forbidden overrides in final mode.
  const iv = input.workerIntervalEnv !== undefined && input.workerIntervalEnv !== "" ? Number(input.workerIntervalEnv) : QUALIFICATION.canonical.workerIntervalMs;
  const bt = input.workerBatchEnv !== undefined && input.workerBatchEnv !== "" ? Number(input.workerBatchEnv) : QUALIFICATION.canonical.workerBatch;
  if (!Number.isInteger(iv) || iv <= 0 || iv !== QUALIFICATION.canonical.workerIntervalMs) {
    issues.push({
      code: "WORKER_INTERVAL",
      message: `final mode forbids OUTBOX_WORKER_INTERVAL_MS override — canonical is ${QUALIFICATION.canonical.workerIntervalMs}ms, got '${input.workerIntervalEnv ?? "(unset)"}'`,
    });
  }
  if (!Number.isInteger(bt) || bt <= 0 || bt !== QUALIFICATION.canonical.workerBatch) {
    issues.push({
      code: "WORKER_BATCH",
      message: `final mode forbids OUTBOX_WORKER_BATCH override — canonical is ${QUALIFICATION.canonical.workerBatch}, got '${input.workerBatchEnv ?? "(unset)"}'`,
    });
  }
  // PSP network must never be reachable from the harness.
  const psp = input.pspEnvVars.find((v) => v.value !== undefined && v.value.trim() !== "");
  if (psp) {
    issues.push({ code: "PSP", message: `final mode forbids PSP connectivity env '${psp.name}' — PSP subset is DEFERRED` });
  }
  return issues;
}

/** Resolve a qualification load profile from the manifest (frozen authority). */
export function resolveQualificationProfile(
  name: "steady" | "peak" | "burst" | "soak",
): { rps: number; durationMs: number; concurrency: number; warmupMs: number } {
  const p = QUALIFICATION[name];
  return { rps: p.rps, durationMs: p.durationMs, concurrency: p.concurrency, warmupMs: QUALIFICATION.warmupMs };
}
