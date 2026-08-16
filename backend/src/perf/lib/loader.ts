/**
 * Step 2.17B — concurrent HTTP load generator.
 *
 * Deterministic, dependency-free (Node global fetch). A pool of workers issues
 * requests for a configured duration; an explicit warm-up phase runs first and
 * is excluded from measurement. Only status + duration are recorded per sample
 * — never headers, bodies, tokens or raw Idempotency-Key values.
 */

import { classifyOutcome, outcomeLabel, type OutcomeClass } from "./classify";
import { computeLatencyStats, mulberry32, type LatencyStats } from "./percentile";

export interface LoadRequest {
  label: string;
  method: "GET" | "POST";
  path: string;
  headers?: Record<string, string>;
  body?: unknown;
  expected: number[];
}

export type MakeRequest = (iteration: number) => Promise<LoadRequest> | LoadRequest;

export interface LoadSample {
  label: string;
  status: number | null;
  durationMs: number;
  outcome: OutcomeClass;
}

export interface LabelResult {
  count: number;
  stats: LatencyStats;
  outcomes: Record<OutcomeClass, number>;
}

export interface LoadResult {
  samples: LoadSample[];
  byLabel: Record<string, LabelResult>;
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
}

export interface LoadOptions {
  baseUrl: string;
  concurrency: number;
  durationMs: number;
  warmupMs: number;
  makeRequest: MakeRequest;
  requestTimeoutMs?: number;
  seed?: number;
}

interface Agg {
  labels: Map<string, { durations: number[]; outcomes: Record<OutcomeClass, number> }>;
  totals: Record<OutcomeClass, number>;
}

function emptyOutcomes(): Record<OutcomeClass, number> {
  return { expected: 0, unexpected4xx: 0, unexpected409: 0, unexpected429: 0, unexpected5xx: 0, timeout: 0, transportError: 0 };
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
      headers: { ...(opts.req.headers ?? {}) },
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

export async function runLoad(opts: LoadOptions): Promise<LoadResult> {
  const { baseUrl, concurrency, durationMs, warmupMs, makeRequest } = opts;
  const requestTimeoutMs = opts.requestTimeoutMs ?? 10_000;
  const rand = mulberry32(opts.seed ?? 1);

  const measurementStart = Date.now() + warmupMs;
  const deadline = measurementStart + durationMs;
  let iteration = 0;

  const samples: LoadSample[] = [];
  const agg: Agg = { labels: new Map(), totals: emptyOutcomes() };

  const record = (s: LoadSample): void => {
    let l = agg.labels.get(s.label);
    if (!l) {
      l = { durations: [], outcomes: emptyOutcomes() };
      agg.labels.set(s.label, l);
    }
    l.durations.push(s.durationMs);
    l.outcomes[s.outcome] += 1;
    agg.totals[s.outcome] += 1;
    samples.push(s);
  };

  // Warm-up phase: every worker issues warmupCount requests (excluded from
  // measurement) so connections/Prisma/pools are initialized.
  const warmupCount = Math.max(1, Math.ceil(warmupMs / Math.max(1, concurrency * 40)));
  const warmupWorker = async (): Promise<void> => {
    for (let i = 0; i < warmupCount; i++) {
      const req = await makeRequest(iteration++);
      await executeOnce({ baseUrl, req, requestTimeoutMs }).catch(() => undefined);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => warmupWorker()));

  // Measurement phase.
  const worker = async (): Promise<void> => {
    while (Date.now() < deadline) {
      const req = await makeRequest(iteration++);
      const sample = await executeOnce({ baseUrl, req, requestTimeoutMs });
      if (Date.now() >= measurementStart) record(sample);
      // Small jitter keeps workers from stampeding in lockstep.
      if (rand() < 0.1) await new Promise((r) => setTimeout(r, 1));
    }
  };
  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  const actualMeasurementMs = Math.max(1, deadline - measurementStart);
  const byLabel: Record<string, LabelResult> = {};
  for (const [label, l] of agg.labels) {
    byLabel[label] = {
      count: l.durations.length,
      stats: computeLatencyStats(l.durations),
      outcomes: l.outcomes,
    };
  }

  const totalRequests = samples.length;
  return {
    samples,
    byLabel,
    totalRequests,
    expected: agg.totals.expected,
    unexpected4xx: agg.totals.unexpected4xx,
    unexpected409: agg.totals.unexpected409,
    unexpected429: agg.totals.unexpected429,
    unexpected5xx: agg.totals.unexpected5xx,
    timeouts: agg.totals.timeout,
    transportErrors: agg.totals.transportError,
    requestsPerSec: Math.round((totalRequests / actualMeasurementMs) * 1000),
    successfulPerSec: Math.round((agg.totals.expected / actualMeasurementMs) * 1000),
    measurementMs: actualMeasurementMs,
  };
}

/** Text summary of a load result (for console + summary.json). */
export function summarizeLoad(r: LoadResult): string {
  const lines: string[] = [
    `total=${r.totalRequests} expected=${r.expected} unexpected5xx=${r.unexpected5xx} unexpected409=${r.unexpected409} unexpected429=${r.unexpected429} unexpected4xx=${r.unexpected4xx} timeouts=${r.timeouts} transport=${r.transportErrors}`,
    `throughput=${r.requestsPerSec} req/s (successful ${r.successfulPerSec}/s)`,
  ];
  for (const [label, l] of Object.entries(r.byLabel)) {
    const s = l.stats;
    lines.push(
      `  ${label}: n=${s.count} p50=${s.p50.toFixed(1)}ms p95=${s.p95.toFixed(1)}ms p99=${s.p99.toFixed(1)}ms max=${s.max.toFixed(1)}ms outcomes=${Object.entries(l.outcomes)
        .filter(([, v]) => v > 0)
        .map(([k, v]) => `${outcomeLabel(k as OutcomeClass)}=${v}`)
        .join(" ")}`,
    );
  }
  return lines.join("\n");
}
