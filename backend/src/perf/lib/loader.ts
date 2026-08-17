/**
 * Step 2.17B — concurrent HTTP load generator (max-effort + arrival-rate paced).
 *
 * Deterministic, dependency-free (Node global fetch).
 *
 * Two modes:
 *  - max-effort: a pool of workers issues requests as fast as the concurrency
 *    ceiling allows (exploratory/stress characterization only);
 *  - paced:      requests are STARTED on a monotonic wall-clock schedule
 *    (scheduled_start(n) = phase_start + n / target_rps). Completion never
 *    drives the schedule. Used by final qualification.
 *
 * An explicit warm-up phase runs first and is excluded from measurement. In
 * paced mode the warm-up itself is paced at the target rate (representative
 * traffic), in max-effort mode it is a bounded burst.
 *
 * Only status + duration are recorded per sample — never headers, bodies,
 * tokens or raw Idempotency-Key values. Multi-instance topology: requests are
 * distributed round-robin across baseUrls; per-instance counts are reported.
 */

import { classifyOutcome, outcomeLabel, type OutcomeClass } from "./classify";
import { computeLatencyStats, mulberry32, type LatencyStats } from "./percentile";
import { scheduledStartMs, sleep, type PacingMetrics } from "./pacer";

export type RouteClass = "A" | "B" | "C" | "D" | "E" | "F";

export interface LoadRequest {
  label: string;
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  expected: number[];
  /** Approved route class (A public reads … F login) for class-level metrics. */
  routeClass?: RouteClass;
}

export type MakeRequest = (iteration: number) => Promise<LoadRequest> | LoadRequest;

export interface LoadSample {
  label: string;
  status: number | null;
  durationMs: number;
  outcome: OutcomeClass;
  routeClass?: RouteClass;
}

export interface LabelResult {
  count: number;
  stats: LatencyStats;
  outcomes: Record<OutcomeClass, number>;
}

export type LoadMode = "paced" | "max-effort";

export interface LoadResult {
  mode: LoadMode;
  samples: LoadSample[];
  byLabel: Record<string, LabelResult>;
  /** Route-class aggregates (A–F + "UNCLASSIFIED" when no routeClass set). */
  byRouteClass: Record<string, LabelResult>;
  totalRequests: number;
  expected: number;
  unexpected4xx: number;
  unexpected409: number;
  unexpected429: number;
  unexpected5xx: number;
  timeouts: number;
  transportErrors: number;
  requestsPerSec: number;
  successfulPerSec: number;
  measurementMs: number;
  /** Paced-mode scheduling evidence (absent in max-effort mode). */
  pacing?: PacingMetrics;
  /** Requests issued per base URL (multi-instance distribution). */
  perBaseUrl: Record<string, number>;
  /** Warm-up phase evidence (separated from measurement). */
  warmup: { durationMs: number; requests: number };
  /** Expected vs unexpected status counts (structured result contract). */
  expectedStatuses: number;
  unexpectedStatuses: number;
}

export interface LoadOptions {
  baseUrl: string;
  /** Additional application instance URLs (multi-instance topology). */
  baseUrls?: string[];
  concurrency: number;
  durationMs: number;
  warmupMs: number;
  makeRequest: MakeRequest;
  requestTimeoutMs?: number;
  seed?: number;
  mode?: LoadMode;
  /** Required when mode === "paced". */
  targetRps?: number;
}

interface Agg {
  labels: Map<string, { durations: number[]; outcomes: Record<OutcomeClass, number> }>;
  classes: Map<string, { durations: number[]; outcomes: Record<OutcomeClass, number> }>;
  totals: Record<OutcomeClass, number>;
}

function emptyOutcomes(): Record<OutcomeClass, number> {
  return { expected: 0, unexpected4xx: 0, unexpected409: 0, unexpected429: 0, unexpected5xx: 0, timeout: 0, transportError: 0 };
}

function emptyLabelResult(): LabelResult {
  return { count: 0, stats: computeLatencyStats([]), outcomes: emptyOutcomes() };
}

async function executeOnce(opts: {
  baseUrl: string;
  req: LoadRequest;
  requestTimeoutMs: number;
}): Promise<LoadSample> {
  const start = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.requestTimeoutMs);
  let status: number | null = null;
  let timedOut = false;
  try {
    const res = await fetch(`${opts.baseUrl}${opts.req.path}`, {
      method: opts.req.method,
      headers: {
        ...(opts.req.headers ?? {}),
        ...(opts.req.body !== undefined && !Object.keys(opts.req.headers ?? {}).some((k) => k.toLowerCase() === "content-type")
          ? { "Content-Type": "application/json" }
          : {}),
      },
      body: opts.req.body !== undefined ? JSON.stringify(opts.req.body) : undefined,
      signal: controller.signal,
      redirect: "manual",
    });
    status = res.status;
    // Drain the body so the connection can be reused.
    await res.arrayBuffer().catch(() => undefined);
  } catch (err) {
    const isAbort = (err as { name?: string })?.name === "AbortError";
    timedOut = isAbort;
    // keep-alive / fetch errors — classify as transport when not a timeout.
  } finally {
    clearTimeout(timer);
  }
  const durationMs = performance.now() - start;
  const { outcome } = classifyOutcome(status, timedOut, opts.req.expected);
  return { label: opts.req.label, status, durationMs, outcome };
}

function finalize(
  samples: LoadSample[],
  agg: Agg,
  measurementMs: number,
  mode: LoadMode,
  perBaseUrl: Record<string, number>,
  warmup: { durationMs: number; requests: number },
  pacing?: PacingMetrics,
): LoadResult {
  const byLabel: Record<string, LabelResult> = {};
  for (const [label, l] of agg.labels) {
    byLabel[label] = {
      count: l.durations.length,
      stats: computeLatencyStats(l.durations),
      outcomes: l.outcomes,
    };
  }
  const byRouteClass: Record<string, LabelResult> = {};
  for (const [cls, l] of agg.classes) {
    byRouteClass[cls] = {
      count: l.durations.length,
      stats: computeLatencyStats(l.durations),
      outcomes: l.outcomes,
    };
  }

  const totalRequests = samples.length;
  const unexpectedStatuses = agg.totals.unexpected4xx + agg.totals.unexpected409 + agg.totals.unexpected429 + agg.totals.unexpected5xx;
  return {
    mode,
    samples,
    byLabel,
    byRouteClass,
    totalRequests,
    expected: agg.totals.expected,
    unexpected4xx: agg.totals.unexpected4xx,
    unexpected409: agg.totals.unexpected409,
    unexpected429: agg.totals.unexpected429,
    unexpected5xx: agg.totals.unexpected5xx,
    timeouts: agg.totals.timeout,
    transportErrors: agg.totals.transportError,
    requestsPerSec: Math.round((totalRequests / Math.max(1, measurementMs)) * 1000),
    successfulPerSec: Math.round((agg.totals.expected / Math.max(1, measurementMs)) * 1000),
    measurementMs,
    pacing,
    perBaseUrl,
    warmup,
    expectedStatuses: agg.totals.expected,
    unexpectedStatuses,
  };
}

/**
 * Paced window: start requests on the monotonic schedule, enforce the
 * concurrency ceiling, collect start evidence. If `record` is true the
 * samples are aggregated; warm-up windows pass record=false.
 */
async function runPacedWindow(opts: {
  baseUrls: string[];
  targetRps: number;
  durationMs: number;
  concurrency: number;
  requestTimeoutMs: number;
  makeRequest: MakeRequest;
  record: boolean;
  agg: Agg;
  samples: LoadSample[];
  perBaseUrl: Record<string, number>;
  iteration: { n: number };
}): Promise<{
  scheduled: number;
  started: number;
  completed: number;
  maxConcurrencyObserved: number;
  lagMs: number;
  startOffsetsMs: number[];
}> {
  const { baseUrls, targetRps, durationMs, concurrency, requestTimeoutMs, makeRequest, record, agg, samples, perBaseUrl, iteration } = opts;
  const windowStart = Date.now();
  const scheduled = Math.floor((durationMs / 1000) * targetRps);
  let started = 0;
  let completed = 0;
  let inFlight = 0;
  let maxConcurrencyObserved = 0;
  let lagTotal = 0;
  let lagCount = 0;
  const startOffsetsMs: number[] = [];

  const recordSample = (s: LoadSample, baseUrl: string): void => {
    perBaseUrl[baseUrl] = (perBaseUrl[baseUrl] ?? 0) + 1;
    if (!record) return;
    let l = agg.labels.get(s.label);
    if (!l) {
      l = { durations: [], outcomes: emptyOutcomes() };
      agg.labels.set(s.label, l);
    }
    const cls = s.routeClass ?? "UNCLASSIFIED";
    let c = agg.classes.get(cls);
    if (!c) {
      c = { durations: [], outcomes: emptyOutcomes() };
      agg.classes.set(cls, c);
    }
    l.durations.push(s.durationMs);
    l.outcomes[s.outcome] += 1;
    c.durations.push(s.durationMs);
    c.outcomes[s.outcome] += 1;
    agg.totals[s.outcome] += 1;
    samples.push(s);
  };

  const startOne = async (n: number): Promise<void> => {
    const scheduledStart = scheduledStartMs({ targetRps, durationMs, windowStartMs: windowStart }, n);
    const delay = scheduledStart - Date.now();
    if (delay > 0) await sleep(delay);
    const actualStart = Date.now();
    started++;
    startOffsetsMs.push(actualStart - windowStart);
    lagTotal += Math.max(0, actualStart - scheduledStart);
    lagCount++;
    inFlight++;
    maxConcurrencyObserved = Math.max(maxConcurrencyObserved, inFlight);
    const baseUrl = baseUrls[n % baseUrls.length];
    try {
      // Warm-up and measurement windows MUST share one monotonically increasing
      // identity stream: the previous code passed the window-relative `n` (which
      // restarts at 0 for every window), so paced warm-up and measurement issued
      // IDENTICAL idempotency keys (e.g. `pay-0`, `pay-1` …) — warm-up slots were
      // counted as reached but reused in measurement, making the idempotency-slot
      // correctness check formally fail even when the system is fully correct.
      // `iteration.n` is the per-run global counter (also used by max-effort mode).
      const req = await makeRequest(iteration.n++);
      const sample = await executeOnce({ baseUrl, req, requestTimeoutMs });
      recordSample({ ...sample, routeClass: req.routeClass }, baseUrl);
    } finally {
      inFlight--;
      completed++;
    }
  };

  const windowDeadline = windowStart + durationMs;
  let next = 0;
  // Dispatch loop: wait until the next scheduled start, then fire (async).
  while (next < scheduled) {
    const waitMs = scheduledStartMs({ targetRps, durationMs, windowStartMs: windowStart }, next) - Date.now();
    if (waitMs > 0) await sleep(waitMs);
    if (Date.now() >= windowDeadline) break;
    // Enforce concurrency ceiling — if the app cannot keep up, starts stall and
    // the achieved start rate (and thus load validity) reports it honestly.
    while (inFlight >= concurrency && Date.now() < windowDeadline + 1_000) {
      await sleep(2);
    }
    if (inFlight >= concurrency) break;
    void startOne(next);
    next++;
  }
  // Drain: wait until every dispatched request has finished (the last dispatch
  // may still be inside its pre-start sleep when the dispatch loop exits).
  while (completed < next) await sleep(10);
  const lagMs = lagCount > 0 ? lagTotal / lagCount : 0;
  return { scheduled, started, completed, maxConcurrencyObserved, lagMs, startOffsetsMs };
}

export async function runLoad(opts: LoadOptions): Promise<LoadResult> {
  const { baseUrl, concurrency, durationMs, warmupMs, makeRequest } = opts;
  const mode: LoadMode = opts.mode === "paced" ? "paced" : "max-effort";
  const targetRps = opts.targetRps ?? 0;
  const requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  const rand = mulberry32(opts.seed ?? 1);
  const baseUrls = opts.baseUrls && opts.baseUrls.length > 0 ? opts.baseUrls : [baseUrl];

  const samples: LoadSample[] = [];
  const agg: Agg = { labels: new Map(), classes: new Map(), totals: emptyOutcomes() };
  const perBaseUrl: Record<string, number> = {};
  const iteration = { n: 0 };

  let warmup: { durationMs: number; requests: number } = { durationMs: warmupMs, requests: 0 };

  if (mode === "paced") {
    if (targetRps <= 0) throw new Error("paced mode requires targetRps > 0");
    // Warm-up: paced at the target rate, excluded from measurement.
    if (warmupMs > 0) {
      const w = await runPacedWindow({
        baseUrls,
        targetRps,
        durationMs: warmupMs,
        concurrency,
        requestTimeoutMs,
        makeRequest,
        record: false,
        agg,
        samples,
        perBaseUrl,
        iteration,
      });
      warmup = { durationMs: warmupMs, requests: w.started };
    }
    const measurementStart = Date.now();
    const m = await runPacedWindow({
      baseUrls,
      targetRps,
      durationMs,
      concurrency,
      requestTimeoutMs,
      makeRequest,
      record: true,
      agg,
      samples,
      perBaseUrl,
      iteration,
    });
    const measuredMs = Date.now() - measurementStart;
    const achievedStartRate = m.started > 1 ? (m.started - 1) / (Math.max(1e-3, (m.startOffsetsMs[m.startOffsetsMs.length - 1] - m.startOffsetsMs[0]) / 1000)) : m.started > 0 ? m.started / (Math.max(1, measuredMs) / 1000) : 0;
    const achievedCompletionRate = m.completed / (Math.max(1, measuredMs) / 1000);
    // Burst windows are short fixed-count phases — validity compares started vs
    // scheduled totals; sustained windows compare the achieved start rate.
    const isBurst = durationMs <= 60_000;
    const { valid, detail } = (() => {
      const scheduled = m.scheduled;
      if (m.started === 0) return { valid: false, detail: `LOAD_APPLICATION_VALID=FAIL — 0 requests started (scheduled=${scheduled})` };
      if (isBurst) {
        const diffPct = (Math.abs(m.started - scheduled) / Math.max(1, scheduled)) * 100;
        return { valid: diffPct <= 5, detail: `burst started=${m.started} scheduled=${scheduled} diffPct=${diffPct.toFixed(2)}% (tolerance ±5%)` };
      }
      const diffPct = (Math.abs(achievedStartRate - targetRps) / targetRps) * 100;
      return { valid: diffPct <= 5, detail: `sustained achievedStartRate=${achievedStartRate.toFixed(2)}/s target=${targetRps}/s diffPct=${diffPct.toFixed(2)}% (tolerance ±5%)` };
    })();
    const pacing: PacingMetrics = {
      targetRps,
      scheduledOperations: m.scheduled,
      startedOperations: m.started,
      completedOperations: m.completed,
      achievedStartRate,
      achievedCompletionRate,
      schedulerLagMs: m.lagMs,
      maxConcurrencyObserved: m.maxConcurrencyObserved,
      loadApplicationValid: valid,
      loadValidityDetail: detail,
    };
    const result = finalize(samples, agg, measuredMs, mode, perBaseUrl, warmup, pacing);
    return result;
  }

  // ---- max-effort mode (exploratory / stress) ----
  const measurementStart = Date.now() + warmupMs;
  const deadline = measurementStart + durationMs;
  let maxConcurrencyObserved = 0;
  let inFlight = 0;

  const warmupCount = Math.max(1, Math.ceil(warmupMs / Math.max(1, concurrency * 40)));
  const warmupWorker = async (): Promise<void> => {
    for (let i = 0; i < warmupCount; i++) {
      const req = await makeRequest(iteration.n++);
      await executeOnce({ baseUrl: baseUrls[iteration.n % baseUrls.length], req, requestTimeoutMs }).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => warmupWorker()));
  warmup = { durationMs: warmupMs, requests: warmupCount * concurrency };

  const worker = async (): Promise<void> => {
    while (Date.now() < deadline) {
      // Increment FIRST (synchronous) so concurrent workers never claim the same
      // iteration — otherwise duplicate request identity (order+key) corrupts
      // payment/booking scenario semantics under max-effort concurrency.
      const n = iteration.n++;
      const req = await makeRequest(n);
      const base = baseUrls[n % baseUrls.length];
      inFlight++;
      maxConcurrencyObserved = Math.max(maxConcurrencyObserved, inFlight);
      perBaseUrl[base] = (perBaseUrl[base] ?? 0) + 1;
      try {
        const sample = await executeOnce({ baseUrl: base, req, requestTimeoutMs });
        if (Date.now() >= measurementStart) recordMaxEffort(sample, req, agg, samples);
      } finally {
        inFlight--;
      }
      // Small jitter keeps workers from stampeding in lockstep.
      if (rand() < 0.1) await new Promise((r) => setTimeout(r, 1));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const actualMeasurementMs = Math.max(1, deadline - measurementStart);
  const result = finalize(samples, agg, actualMeasurementMs, mode, perBaseUrl, warmup);
  // max-effort mode: loadApplicationValid is not applicable (no target rate).
  return result;
}

function recordMaxEffort(sample: LoadSample, req: LoadRequest, agg: Agg, samples: LoadSample[]): void {
  const s: LoadSample = { ...sample, routeClass: req.routeClass };
  let l = agg.labels.get(s.label);
  if (!l) {
    l = { durations: [], outcomes: emptyOutcomes() };
    agg.labels.set(s.label, l);
  }
  const cls = s.routeClass ?? "UNCLASSIFIED";
  let c = agg.classes.get(cls);
  if (!c) {
    c = { durations: [], outcomes: emptyOutcomes() };
    agg.classes.set(cls, c);
  }
  l.durations.push(s.durationMs);
  l.outcomes[s.outcome] += 1;
  c.durations.push(s.durationMs);
  c.outcomes[s.outcome] += 1;
  agg.totals[s.outcome] += 1;
  samples.push(s);
}

/** Text summary of a load result (for console + summary.json). */
export function summarizeLoad(r: LoadResult): string {
  const lines: string[] = [
    `mode=${r.mode} total=${r.totalRequests} expected=${r.expected} unexpected5xx=${r.unexpected5xx} unexpected409=${r.unexpected409} unexpected429=${r.unexpected429} unexpected4xx=${r.unexpected4xx} timeouts=${r.timeouts} transport=${r.transportErrors}`,
    `throughput=${r.requestsPerSec} req/s (successful ${r.successfulPerSec}/s)`,
  ];
  if (r.pacing) {
    lines.push(
      `pacing target=${r.pacing.targetRps}/s started=${r.pacing.startedOperations} scheduled=${r.pacing.scheduledOperations} achievedStart=${r.pacing.achievedStartRate.toFixed(1)}/s achievedCompletion=${r.pacing.achievedCompletionRate.toFixed(1)}/s lag=${r.pacing.schedulerLagMs.toFixed(1)}ms maxConc=${r.pacing.maxConcurrencyObserved} valid=${r.pacing.loadApplicationValid}`,
    );
  }
  for (const [cls, l] of Object.entries(r.byRouteClass)) {
    const s = l.stats;
    if (l.count === 0) continue;
    lines.push(
      `  class ${cls}: n=${s.count} p50=${s.p50.toFixed(1)}ms p95=${s.p95.toFixed(1)}ms p99=${s.p99.toFixed(1)}ms max=${s.max.toFixed(1)}ms outcomes=${Object.entries(l.outcomes)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${outcomeLabel(k as OutcomeClass)}=${v}`)
        .join(" ")}`,
    );
  }
  return lines.join("\n");
}

export { emptyLabelResult };
