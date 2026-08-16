/**
 * Step 2.17B — arrival-rate pacing (H1 remediation).
 *
 * Final qualification requires driving load AT a target rate (25/50/100/200 RPS),
 * not merely saturating with a fixed concurrency pool. This module provides:
 *
 *  - monotonic scheduling: scheduled_start(n) = phase_start + n / target_rate
 *  - load-validity classification: sustained start-rate ±5% of target, or
 *    burst started-vs-scheduled ±5% of total (harness validity tolerance,
 *    NOT a business SLO);
 *  - concurrency-ceiling enforcement is done by the caller (loader).
 *
 * Pacing is based on WALL CLOCK start times, never on completed requests —
 * completion-rate pacing conflates latency with arrival rate.
 */

export interface PacedSpec {
  /** Requests per second to START. Must be > 0. */
  targetRps: number;
  /** Duration of the measured window (ms). Must be > 0. */
  durationMs: number;
  /** Phase-relative epoch when the window begins (ms since epoch). */
  windowStartMs: number;
}

export interface PacingMetrics {
  targetRps: number;
  scheduledOperations: number;
  startedOperations: number;
  completedOperations: number;
  /** Achieved START rate over the actual start interval (req/s). */
  achievedStartRate: number;
  /** Achieved COMPLETION rate over the measured window (req/s). */
  achievedCompletionRate: number;
  /** Mean positive scheduling lag: how late starts actually were vs schedule (ms). */
  schedulerLagMs: number;
  maxConcurrencyObserved: number;
  /** True when load was genuinely applied at the requested rate. */
  loadApplicationValid: boolean;
  loadValidityDetail: string;
}

/** Absolute epoch ms at which request n is scheduled to start. */
export function scheduledStartMs(spec: PacedSpec, n: number): number {
  return spec.windowStartMs + (n / spec.targetRps) * 1000;
}

/** Total operations the window calls for (floor). */
export function scheduledOperationsFor(spec: PacedSpec): number {
  return Math.floor((spec.durationMs / 1000) * spec.targetRps);
}

export interface PacingEvidence {
  /** Actual wall-clock start of each started request (ms since window start). */
  startOffsetsMs: number[];
  /** Whether the window was a burst (fixed-count validity) or sustained. */
  burst: boolean;
  startedOperations: number;
  completedOperations: number;
  maxConcurrencyObserved: number;
}

/**
 * Classify whether load was genuinely applied at the requested rate.
 *
 * Sustained window: |achievedStartRate - targetRps| / targetRps <= 0.05.
 * Burst window:      |started - scheduled| / scheduled <= 0.05.
 * Zero-started runs always FAIL.
 */
export function classifyPacingValidity(spec: PacedSpec, evidence: PacingEvidence): { valid: boolean; detail: string } {
  const scheduled = scheduledOperationsFor(spec);
  if (evidence.startedOperations === 0) {
    return { valid: false, detail: `LOAD_APPLICATION_VALID=FAIL — 0 requests started (scheduled=${scheduled})` };
  }
  if (evidence.burst) {
    const diff = Math.abs(evidence.startedOperations - scheduled);
    const pct = scheduled > 0 ? (diff / scheduled) * 100 : 100;
    const valid = pct <= 5;
    return {
      valid,
      detail: `burst started=${evidence.startedOperations} scheduled=${scheduled} diffPct=${pct.toFixed(2)}% (tolerance ±5%) → ${valid ? "VALID" : "FAIL"}`,
    };
  }
  const first = evidence.startOffsetsMs[0] ?? 0;
  const last = evidence.startOffsetsMs[evidence.startOffsetsMs.length - 1] ?? 0;
  const spanSec = Math.max(1e-3, (last - first) / 1000);
  const achieved = (evidence.startedOperations - 1) / spanSec;
  const pct = Math.abs(achieved - spec.targetRps) / spec.targetRps * 100;
  const valid = pct <= 5;
  return {
    valid,
    detail: `sustained achievedStartRate=${achieved.toFixed(2)}/s target=${spec.targetRps}/s diffPct=${pct.toFixed(2)}% (tolerance ±5%) → ${valid ? "VALID" : "FAIL"}`,
  };
}

/** Deterministic pure check used by tests — same math as classifyPacingValidity. */
export function pacingValidityFor(targetRps: number, started: number, scheduled: number, burst: boolean): boolean {
  const spec: PacedSpec = { targetRps, durationMs: (scheduled / targetRps) * 1000, windowStartMs: 0 };
  const startOffsets = burst ? Array.from({ length: started }, (_, i) => (i / targetRps) * 1000) : Array.from({ length: started }, (_, i) => (i / targetRps) * 1000);
  return classifyPacingValidity(spec, {
    burst,
    startOffsetsMs: startOffsets,
    startedOperations: started,
    completedOperations: started,
    maxConcurrencyObserved: 1,
  }).valid;
}

/** Sleep helper (shared by loader). */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
